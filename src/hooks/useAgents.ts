import { usePolling } from './usePolling';
import { api } from '../lib/api';
import type { Agent } from '../lib/types';

export function useAgents() {
  return usePolling<Agent[]>(api.agents, 30000);
}
