import { create } from 'zustand';
import type { OverviewData, SystemMetrics, Agent, Workflow, Run, Session } from '../lib/types';

export interface AppStore {
  overview: OverviewData | null;
  system: SystemMetrics | null;
  agents: Agent[] | null;
  pipeline: any[] | null;
  activity: any[] | null;
  wfAgents: any[] | null;
  alerts: any | null;
  workflows: Workflow[] | null;
  runs: Run[] | null;
  sessions: Session[] | null;
  initialLoading: boolean;
}

export const useAppStore = create<AppStore>(() => ({
  overview: null,
  system: null,
  agents: null,
  pipeline: null,
  activity: null,
  wfAgents: null,
  alerts: null,
  workflows: null,
  runs: null,
  sessions: null,
  initialLoading: true,
}));
