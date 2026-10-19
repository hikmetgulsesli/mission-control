import { clearPendingControlLaunchV1, readPendingControlLaunchV1, writePendingControlLaunchV1 } from './control-evidence';
import type { ControlJobKindV1, ControlJobReceiptV1, PendingControlLaunchV1 } from './control-evidence';

const PENDING_JOB_KEY = 'mission-control.controls.pending-job.v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Launch = (request: PendingControlLaunchV1) => Promise<{ receipt: ControlJobReceiptV1; replay: boolean }>;

export function isControlReceiptTerminalV1(receipt: ControlJobReceiptV1): boolean {
  return receipt.finishedAt !== null && ['completed','failed','blocked','cancelled'].includes(receipt.state);
}

/** Owns launch intent across reload and async selection changes. No network call occurs in construction or reads. */
export class ControlJobSessionV1 {
  pending: PendingControlLaunchV1 | null;
  pendingJobId: string | null;
  selectedJobId: string | null;
  kind: ControlJobKindV1;
  selectionHash: string | null = null;
  private confirmation: { kind: ControlJobKindV1; selectionHash: string } | null = null;
  private selectionVersion = 0;
  private inFlight = false;

  constructor(private readonly store: Store | null, private readonly launchRequest: Launch,
    selectedJobId: string | null, private readonly newKey: () => string = () => crypto.randomUUID()) {
    this.pending = readPendingControlLaunchV1(store ?? undefined);
    this.kind = this.pending?.kind ?? 'activation_preflight';
    this.selectedJobId = selectedJobId;
    let jobId: string | null = null;
    try { jobId = store?.getItem(PENDING_JOB_KEY) ?? null; } catch { /* pending body remains available */ }
    this.pendingJobId = this.pending && jobId && UUID.test(jobId) ? jobId : null;
  }

  setSelection(selectionHash: string | null): void {
    if (this.selectionHash === selectionHash) return;
    this.selectionHash = selectionHash;
    this.confirmation = null;
    this.selectionVersion++;
  }

  setKind(kind: ControlJobKindV1): void {
    if (this.kind === kind) return;
    this.kind = kind;
    this.confirmation = null;
  }

  confirm(): void {
    this.confirmation = this.selectionHash ? { kind: this.kind, selectionHash: this.selectionHash } : null;
  }

  clearConfirmation(): void { this.confirmation = null; }

  isConfirmed(): boolean {
    return this.confirmation !== null && this.confirmation.kind === this.kind
      && this.confirmation.selectionHash === this.selectionHash;
  }

  chooseJob(jobId: string): void {
    if (this.selectedJobId !== jobId) this.selectionVersion++;
    this.selectedJobId = jobId;
  }

  async launch(): Promise<{ receipt: ControlJobReceiptV1; replay: boolean; reveal: boolean }> {
    if (this.inFlight) throw new Error('CONTROL_REQUEST_BUSY');
    if (!this.selectionHash || !this.isConfirmed()) throw new Error('CONTROL_CONFIRMATION_STALE');
    if (this.pending && (this.pending.kind !== this.kind || this.pending.expectedSelectionHash !== this.selectionHash))
      throw new Error('CONTROL_PENDING_SELECTION_STALE');
    const request = this.pending ?? {
      kind: this.kind,
      expectedSelectionHash: this.selectionHash,
      idempotencyKey: this.newKey(),
    };
    if (!this.pending) {
      if (!this.store) throw new Error('CONTROL_PENDING_STORAGE_UNAVAILABLE');
      writePendingControlLaunchV1(this.store, request);
      this.pending = request;
    }
    const version = this.selectionVersion;
    this.inFlight = true;
    try {
      const result = await this.launchRequest(request);
      if (result.receipt.kind !== request.kind || result.receipt.selectionHash !== request.expectedSelectionHash)
        throw new Error('CONTROL_RESPONSE_INVALID');
      this.pendingJobId = result.receipt.jobId;
      try { this.store?.setItem(PENDING_JOB_KEY, result.receipt.jobId); } catch { /* exact request remains persisted */ }
      const reveal = this.selectionVersion === version;
      if (reveal) this.selectedJobId = result.receipt.jobId;
      this.clearConfirmation();
      return { ...result, reveal };
    } finally { this.inFlight = false; }
  }

  acceptReceipt(receipt: ControlJobReceiptV1): void {
    if (this.pendingJobId !== receipt.jobId || !isControlReceiptTerminalV1(receipt)
      || !this.pending || receipt.kind !== this.pending.kind
      || receipt.selectionHash !== this.pending.expectedSelectionHash) return;
    if (this.store) {
      try { clearPendingControlLaunchV1(this.store); this.store.removeItem(PENDING_JOB_KEY); }
      catch { return; }
    }
    this.pending = null;
    this.pendingJobId = null;
  }

  prepareNew(): void {
    if (this.store) {
      clearPendingControlLaunchV1(this.store);
      this.store.removeItem(PENDING_JOB_KEY);
    }
    this.pending = null;
    this.pendingJobId = null;
    this.clearConfirmation();
  }
}
