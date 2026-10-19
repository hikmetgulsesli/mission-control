import { clearPendingControlLaunchV1, parsePendingControlLaunchV1, readPendingControlLaunchV1, writePendingControlLaunchV1 } from './control-evidence';
import type { ControlJobKindV1, ControlJobReceiptV1, PendingControlLaunchV1 } from './control-evidence';

const PENDING_JOB_KEY = 'mission-control.controls.pending-job.v1';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Store = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Launch = (request: PendingControlLaunchV1) => Promise<{ receipt: ControlJobReceiptV1; replay: boolean }>;
type BoundJob = PendingControlLaunchV1 & { jobId: string };

function sameRequest(a: PendingControlLaunchV1 | null, b: PendingControlLaunchV1 | null): boolean {
  return a !== null && b !== null && a.kind === b.kind
    && a.expectedSelectionHash === b.expectedSelectionHash
    && a.idempotencyKey === b.idempotencyKey;
}

function readBoundJob(store: Store | null, pending: PendingControlLaunchV1 | null): BoundJob | null {
  if (!store || !pending) return null;
  try {
    const raw = store.getItem(PENDING_JOB_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.keys(value).sort().join('|') !== 'expectedSelectionHash|idempotencyKey|jobId|kind') return null;
    const mapped = value as Record<string,unknown>;
    const request = parsePendingControlLaunchV1({ kind:mapped.kind,expectedSelectionHash:mapped.expectedSelectionHash,idempotencyKey:mapped.idempotencyKey });
    if (!sameRequest(pending,request) || typeof mapped.jobId !== 'string' || !UUID.test(mapped.jobId)) return null;
    return { ...request,jobId:mapped.jobId };
  } catch { return null; }
}

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
  private disposed = false;
  private lifecycleEpoch = 0;

  constructor(private readonly store: Store | null, private readonly launchRequest: Launch,
    selectedJobId: string | null, private readonly newKey: () => string = () => crypto.randomUUID()) {
    this.pending = readPendingControlLaunchV1(store ?? undefined);
    this.kind = this.pending?.kind ?? 'activation_preflight';
    this.selectedJobId = selectedJobId;
    this.pendingJobId = readBoundJob(store,this.pending)?.jobId ?? null;
  }

  activate(): void { this.disposed = false; }
  dispose(): void { this.disposed = true; this.lifecycleEpoch++; this.selectionVersion++; }

  private ownsStoredRequest(request: PendingControlLaunchV1): boolean {
    return !this.disposed && !!this.store && sameRequest(readPendingControlLaunchV1(this.store),request);
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
    if (!this.ownsStoredRequest(request)) throw new Error('CONTROL_PENDING_SELECTION_STALE');
    const version = this.selectionVersion;
    const epoch = this.lifecycleEpoch;
    this.inFlight = true;
    try {
      const result = await this.launchRequest(request);
      if (result.receipt.kind !== request.kind || result.receipt.selectionHash !== request.expectedSelectionHash)
        throw new Error('CONTROL_RESPONSE_INVALID');
      if (this.lifecycleEpoch === epoch && this.ownsStoredRequest(request)) {
        try {
          this.store?.setItem(PENDING_JOB_KEY, JSON.stringify({ ...request, jobId:result.receipt.jobId }));
          this.pendingJobId = result.receipt.jobId;
        } catch { /* exact request remains persisted and retryable */ }
      }
      const reveal = this.lifecycleEpoch === epoch && this.selectionVersion === version && this.ownsStoredRequest(request);
      if (reveal) this.selectedJobId = result.receipt.jobId;
      this.clearConfirmation();
      return { ...result, reveal };
    } finally { this.inFlight = false; }
  }

  acceptReceipt(receipt: ControlJobReceiptV1): void {
    if (this.pendingJobId !== receipt.jobId || !isControlReceiptTerminalV1(receipt)
      || !this.pending || receipt.kind !== this.pending.kind
      || receipt.selectionHash !== this.pending.expectedSelectionHash
      || !this.ownsStoredRequest(this.pending)
      || readBoundJob(this.store,this.pending)?.jobId !== receipt.jobId) return;
    if (this.store) {
      try { this.store.removeItem(PENDING_JOB_KEY); clearPendingControlLaunchV1(this.store); }
      catch { return; }
    }
    this.pending = null;
    this.pendingJobId = null;
  }

  prepareNew(): void {
    const stored = readPendingControlLaunchV1(this.store ?? undefined);
    if (this.disposed || stored && !sameRequest(stored,this.pending) || !stored && this.pending)
      throw new Error('CONTROL_PENDING_SELECTION_STALE');
    if (this.store) {
      this.store.removeItem(PENDING_JOB_KEY);
      clearPendingControlLaunchV1(this.store);
    }
    this.pending = null;
    this.pendingJobId = null;
    this.clearConfirmation();
  }
}
