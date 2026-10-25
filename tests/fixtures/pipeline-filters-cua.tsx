import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../src/components/Toast';
import { SetfarmActivity } from '../../src/pages/SetfarmActivity';
import { useAppStore } from '../../src/store/appStore';
import { api } from '../../src/lib/api';
import { parseOperationalSnapshotResponse, type RunOperationalSnapshotV1 } from '../../src/lib/operational-snapshot';
import '../../src/index.css';

// Complete v1 shape adapted from operational-snapshot-authority.test.ts.
// Deliberately historical evidence keeps canonical actions locked.
function makeSnapshot(): RunOperationalSnapshotV1 {
  return {
    schema: 'setfarm.run-operational-snapshot.v1',
    generatedAt: "2026-07-13T09:59:59.000Z",
    snapshotHash: 'a'.repeat(64),
    source: {
      database: "postgres",
      projection: "complete",
      migrationVersions: [1, 2, 3, 4, 5, 6, 7, 8],
      verifiedReleaseSha: 'b'.repeat(40),
      capabilities: {
        attempts: true,
        claimBinding: true,
        runtimeOwnership: true,
        managerCompletion: true,
        effectLedger: true,
        findingRecovery: true,
        evidenceLedger: true,
        acceptedCandidate: true,
        deploymentReceipt: true,
        projectTransferAck: true,
      },
    },
    run: {
      ref: "setfarm://runs/run-1",
      id: "run-1",
      runNumber: 12,
      protocol: "v3",
      status: "cancelled",
      terminal: true,
      updatedAt: "2026-07-13T09:59:58.000Z",
    },
    summary: {
      lifecycleState: "terminal",
      health: "ok",
      activeClaims: 0,
      activeAttempts: 0,
      activeRuntimes: 0,
      openCompletions: 0,
      mandatoryEffectsPending: 0,
      unpublishedOutbox: 0,
      invariantViolations: 0,
      operatorActions: {
        stop: { allowed: false, reasonCode: "RUN_TERMINAL", stateHash: "c".repeat(64) },
        resume: { allowed: false, reasonCode: "RUN_NOT_RESUMABLE", stateHash: "d".repeat(64) },
      },
    },
    claims: [],
    attempts: [],
    runtimeSessions: [],
    completionRequests: [],
    terminationRequests: [],
    outbox: [],
    invariants: [],
    acceptedCandidate: null,
    deploymentReceipt: null,
    projectTransferAck: null,
  };
}
const snapshot = makeSnapshot();
const knownSnapshot = parseOperationalSnapshotResponse(200, snapshot, 'run-1');
if (knownSnapshot.status !== 'ok') throw new Error('Invalid synthetic operational snapshot');
window.fetch = async () => { throw new Error('Synthetic fixture rejects all network fetches'); };
api.runOperationalSnapshot = async (runId) => {
  if (runId !== 'run-1') throw new Error('Unexpected synthetic run id');
  return knownSnapshot;
};
api.runErrors = async (runId) => {
  if (runId !== 'run-1') throw new Error('Unexpected synthetic run id');
  return [];
};
api.setfarmAgentFeed = async () => [];
useAppStore.setState({
  pipeline: [{ id: 'run-1', runNumber: 12, workflow: 'bug-fix', task: 'Synthetic cancelled searchable task',
    status: 'cancelled', updatedAt: '2026-10-25T00:00:00.000Z',
    steps: [{ stepId: 'fix', agent: 'fixer', status: 'failed', retryCount: 0, type: 'step', abandonedCount: 0 }],
    storyProgress: { completed: 0, total: 1 } }],
  agents: [], activity: [], wfAgents: [], alerts: { counts: { abandoned: 0, timeout: 0, failed: 0 }, recent: [] },
  workflows: [], sessions: [], initialLoading: false,
});
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={['/setfarm']}><ToastProvider>
    <h1 style={{ fontSize: 18, padding: 16 }}>Synthetic pipeline fixture — not live Setfarm evidence</h1>
    <SetfarmActivity />
  </ToastProvider></MemoryRouter>,
);
