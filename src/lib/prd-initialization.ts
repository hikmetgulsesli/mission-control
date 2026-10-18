import { isSetfarmOperationalActiveRunStatusV1 } from '../../server/shared/setfarm-operational-active-run-status-v1';
import type { usePrdStore } from '../store/prdStore';

export function parsePrdCloneIntent(search: string): { title: string; description: string } | null {
  const query = new URLSearchParams(search);
  if (!query.has('title') && !query.has('description')) return null;
  return { title: query.get('title') ?? '', description: query.get('description') ?? '' };
}

export function findSavedActivePrdRun(rows: unknown, savedRunId: string): string | null {
  if (!savedRunId || !Array.isArray(rows)) return null;
  const saved = rows.find(row => row !== null && typeof row === 'object' && row.id === savedRunId);
  return saved && isSetfarmOperationalActiveRunStatusV1(saved.status) ? savedRunId : null;
}

interface PrdInitializerDependencies {
  store: Pick<typeof usePrdStore, 'getState'>;
  history: () => Promise<unknown>;
  pipeline: () => Promise<unknown>;
  storage: Pick<Storage, 'getItem' | 'removeItem'>;
}

/** Owns one mounted page's navigation and pending history/restore work. */
export function createPrdInitializer({ store, history, pipeline, storage }: PrdInitializerDependencies) {
  let generation = 0;
  let currentNavigation: string | undefined;
  let appliedClone = false;

  return {
    beginNavigation({ key, search }: { key: string; search: string }) {
      const requestGeneration = ++generation;
      if (currentNavigation !== key) {
        currentNavigation = key;
        appliedClone = false;
      }
      const cancel = () => {
        if (generation === requestGeneration) generation++;
      };
      const intent = parsePrdCloneIntent(search);
      if (intent) {
        // An explicit new project takes precedence over both persisted skip flags and history.
        // Keep this across effect cleanup/replay so StrictMode cannot erase subsequent edits.
        if (!appliedClone) {
          appliedClone = true;
          store.getState().reset();
          storage.removeItem('prd_skip_autoload');
          store.getState().setState({ ...intent, skipAutoLoad: false });
        }
        return { cancel, done: Promise.resolve() };
      }

      let baseline = store.getState();
      const isCurrent = () => generation === requestGeneration && store.getState() === baseline;
      // Preserve existing PRDs and unsaved user input when returning to a plain /prd URL.
      if (baseline.id || baseline.skipAutoLoad || storage.getItem('prd_skip_autoload')
        || baseline.title || baseline.description || baseline.prdContent
        || baseline.urls.some(url => url.trim()) || baseline.analysis || baseline.research
        || baseline.mockupScreens.length || baseline.chatHistory.length
        || Object.values(baseline.loading).some(Boolean)) {
        return { cancel, done: Promise.resolve() };
      }

      const done = (async () => {
        try {
          const prds = await history();
          if (!isCurrent() || !Array.isArray(prds)) return;
          const last = prds[0];
          if (!last || typeof last !== 'object' || typeof last.id !== 'string' || !last.id) return;
          const screens = Array.isArray(last.mockup_screens) ? last.mockup_screens : [];
          const stitchProjectId = last.stitch_project_id || screens.find((screen: any) => screen?.projectId)?.projectId || null;
          baseline.setState({
            id: last.id,
            title: last.title || '',
            platform: last.platform || 'web',
            urls: last.urls?.length ? last.urls : [''],
            description: last.description || '',
            prdContent: last.prd_content || '',
            prdVersion: last.prd_version || 0,
            score: last.score,
            scoreDetails: last.score_details,
            costEstimate: last.cost_estimate,
            analysis: last.analysis,
            research: last.research,
            chatHistory: last.chat_history || [],
            stitchProjectId,
            mockupScreens: stitchProjectId ? screens.filter((screen: any) => screen?.projectId === stitchProjectId) : screens,
            runId: null,
            projectName: last.title || '',
          });
          baseline = store.getState();
          if (typeof last.run_id !== 'string' || !last.run_id) return;
          const rows = await pipeline();
          if (!isCurrent()) return;
          const runId = findSavedActivePrdRun(rows, last.run_id);
          if (runId) baseline.setState({ runId });
        } catch {
          // History and active-run lookup are optional; keep the current editable draft on failure.
        }
      })();
      return { cancel, done };
    },
  };
}
