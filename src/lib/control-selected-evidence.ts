import type { ControlEvidenceEnvelopeV1, ControlJobReceiptV1 } from './control-evidence';

export type SelectedControlEvidenceStateV1 = Readonly<{
  boundJobId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  receipt: ControlJobReceiptV1 | null;
  envelope: ControlEvidenceEnvelopeV1 | null;
  error: string | null;
}>;
export type SelectedControlEvidenceDepsV1 = Readonly<{
  readReceipt: (jobId: string) => Promise<ControlJobReceiptV1>;
  readEvidence: (jobId: string) => Promise<ControlEvidenceEnvelopeV1>;
  publish: (state: SelectedControlEvidenceStateV1) => void;
  acceptedReceipt: (receipt: ControlJobReceiptV1) => void;
}>;
type Scope = { jobId: string; epoch: number };
type EvidenceRead = Scope & { sequence: number; stamp: string };

function terminal(receipt: ControlJobReceiptV1): boolean {
  return receipt.finishedAt !== null && ['completed', 'failed', 'blocked', 'cancelled'].includes(receipt.state);
}
function stamp(receipt: ControlJobReceiptV1): string {
  const refs = receipt.reportRefs;
  return JSON.stringify([receipt.revision, receipt.state, receipt.finishedAt,
    refs.activationHash ?? null, refs.resultHash ?? null, refs.gateHash ?? null, refs.uiReportHash ?? null]);
}
function matches(receipt: ControlJobReceiptV1, envelope: ControlEvidenceEnvelopeV1): boolean {
  const { activation, evaluation, ui } = envelope.evidence;
  const refs = receipt.reportRefs;
  return (activation.availability.state !== 'available' || activation.report !== null && refs.activationHash === activation.report.hash)
    && (evaluation.availability.state !== 'available' || evaluation.report !== null
      && refs.resultHash === evaluation.report.resultHash && (refs.gateHash ?? null) === evaluation.report.gateHash)
    && (ui.availability.state !== 'available' || ui.report !== null && refs.uiReportHash === ui.report.hash);
}
function errorCode(error: unknown): string {
  return error instanceof Error && /^[A-Z0-9_]{1,100}$/.test(error.message) ? error.message : 'CONTROL_RESPONSE_INVALID';
}

/** Owns selected GETs only. Construction and activation are inert; every async result has local provenance. */
export class ControlSelectedEvidenceV1 {
  private active = false;
  private epoch = 0;
  private receiptSequence = 0;
  private settledReceiptSequence = 0;
  private evidenceSequence = 0;
  private state: SelectedControlEvidenceStateV1 = { boundJobId: null, status: 'idle', receipt: null, envelope: null, error: null };

  constructor(private readonly deps: SelectedControlEvidenceDepsV1) {}

  activate(): void { this.active = true; }
  dispose(): void { this.active = false; this.epoch++; }

  select(jobId: string | null, seed?: ControlJobReceiptV1): void {
    this.epoch++;
    this.settledReceiptSequence = this.receiptSequence;
    this.publish({ boundJobId: jobId, status: jobId === null ? 'idle' : 'loading', receipt: null, envelope: null, error: null });
    if (!this.active || jobId === null) return;
    if (seed?.jobId === jobId) this.acceptReceipt(seed);
    else void this.refreshReceipt();
  }

  async refresh(): Promise<void> {
    const outcome = await this.readReceipt(false);
    if (outcome && this.ownsEvidence(outcome)) await this.readEvidence(true);
  }

  async refreshReceipt(): Promise<void> { await this.readReceipt(true); }

  acceptReceipt(receipt: ControlJobReceiptV1): void {
    if (!this.active || receipt.jobId !== this.state.boundJobId) return;
    if (this.adoptReceipt(receipt)) void this.readEvidence(true);
  }

  private publish(state: SelectedControlEvidenceStateV1): void { this.state = state; this.deps.publish(state); }
  private scope(): Scope | null {
    return this.active && this.state.boundJobId !== null ? { jobId: this.state.boundJobId, epoch: this.epoch } : null;
  }
  private ownsScope(scope: Scope): boolean {
    return this.active && this.epoch === scope.epoch && this.state.boundJobId === scope.jobId;
  }
  private evidenceContext(scope: Scope): EvidenceRead | null {
    return this.state.receipt ? { ...scope, sequence: this.evidenceSequence, stamp: stamp(this.state.receipt) } : null;
  }
  private ownsEvidence(read: EvidenceRead): boolean {
    return this.ownsScope(read) && this.evidenceSequence === read.sequence
      && this.state.receipt !== null && stamp(this.state.receipt) === read.stamp;
  }
  private fail(error: string): void {
    this.evidenceSequence++;
    this.publish({ ...this.state, status: 'error', envelope: null, error });
  }

  private adoptReceipt(receipt: ControlJobReceiptV1): boolean {
    const previous = this.state.receipt;
    if (receipt.jobId !== this.state.boundJobId || previous && (receipt.revision < previous.revision
      || terminal(previous) && !terminal(receipt) && receipt.revision <= previous.revision
      || stamp(receipt) === stamp(previous))) return false;
    this.evidenceSequence++;
    this.publish({ ...this.state, receipt, status: 'loading', envelope: null, error: null });
    this.deps.acceptedReceipt(receipt);
    return true;
  }

  private async readReceipt(startEvidence: boolean, gate?: EvidenceRead): Promise<EvidenceRead | null> {
    const scope = this.scope();
    if (!scope) return null;
    const sequence = ++this.receiptSequence;
    try {
      const receipt = await this.deps.readReceipt(scope.jobId);
      if (!this.ownsScope(scope) || gate && !this.ownsEvidence(gate) || sequence < this.settledReceiptSequence) return null;
      this.settledReceiptSequence = sequence;
      if (receipt.jobId !== scope.jobId) throw new Error('CONTROL_RESPONSE_INVALID');
      // Older requests can help while newer ones are pending, but only with a strictly newer revision.
      if (sequence < this.receiptSequence && (!this.state.receipt || receipt.revision <= this.state.receipt.revision)) return null;
      const changed = this.adoptReceipt(receipt);
      if (!this.ownsScope(scope)) return null;
      if (changed && startEvidence) void this.readEvidence(true);
      return this.evidenceContext(scope);
    } catch (error) {
      if (this.ownsScope(scope) && (!gate || this.ownsEvidence(gate))
        && sequence === this.receiptSequence && sequence >= this.settledReceiptSequence) {
        this.settledReceiptSequence = sequence;
        this.fail(errorCode(error));
      }
      return null;
    }
  }

  private async readEvidence(reconcile: boolean): Promise<void> {
    const scope = this.scope();
    if (!scope || !this.state.receipt) return;
    this.evidenceSequence++;
    const read = this.evidenceContext(scope)!;
    this.publish({ ...this.state, status: 'loading', envelope: null, error: null });
    try {
      const envelope = await this.deps.readEvidence(scope.jobId);
      if (!this.ownsEvidence(read)) return;
      if (matches(this.state.receipt!, envelope)) {
        this.publish({ ...this.state, status: 'ready', envelope, error: null });
      } else if (reconcile) {
        // This attempt gets one receipt read and one evidence follow-up, with no recursive reconciliation.
        const outcome = await this.readReceipt(false, read);
        if (outcome && this.ownsEvidence(outcome)) await this.readEvidence(false);
        else if (this.ownsEvidence(read)) this.fail('CONTROL_SELECTED_EVIDENCE_OUT_OF_SYNC');
      } else {
        this.fail('CONTROL_SELECTED_EVIDENCE_OUT_OF_SYNC');
      }
    } catch (error) {
      if (this.ownsEvidence(read)) this.fail(errorCode(error));
    }
  }
}
