import { create } from 'zustand';

export interface RefinementState {
  features: { name: string; enabled: boolean }[];
  designDirection: 'minimal' | 'detailed' | 'playful' | 'corporate';
  userGoals: string;
  mobilePlatform: 'both' | 'ios' | 'android';
}

interface PrdState {
  id: string | null;
  title: string;
  platform: 'web' | 'mobile';
  urls: string[];
  description: string;
  prdContent: string;
  prdVersion: number;
  score: number | null;
  scoreDetails: any;
  costEstimate: any;
  analysis: any;
  research: any;
  chatHistory: { role: string; content: string }[];
  mockupScreens: any[];
  runId: string | null;
  // UI state
  activeTab: 'prd' | 'mockup' | 'analysis';
  loading: Record<string, boolean>;
  loadingStartedAt: Record<string, number>; // timestamp when loading started
  logs: string[];
  analyses: any[];
  editMode: boolean;
  projectName: string;
  workflow: string;
  showHistory: boolean;
  showTemplates: boolean;
  // Faz 2: Screen gallery
  stitchProjectId: string | null;
  screenCoverage: { covered: string[]; missing: string[]; coverage: number } | null;
  lightboxScreenId: string | null;
  // Refinement panel (post-analysis, pre-generation)
  refinements: RefinementState | null;
}

interface PrdActions {
  setState: (updates: Partial<PrdState>) => void;
  addLog: (msg: string) => void;
  setLoading: (key: string, val: boolean) => void;
  reset: () => void;
}

const initialState: PrdState = {
  id: null,
  skipAutoLoad: false,
  title: '',
  platform: 'web',
  urls: [''],
  description: '',
  prdContent: '',
  prdVersion: 0,
  score: null,
  scoreDetails: null,
  costEstimate: null,
  analysis: null,
  research: null,
  chatHistory: [],
  mockupScreens: [],
  runId: null,
  activeTab: 'prd',
  loading: {},
  loadingStartedAt: {},
  logs: [],
  analyses: [],
  editMode: false,
  projectName: '',
  workflow: 'feature-dev',
  showHistory: false,
  showTemplates: false,
  stitchProjectId: null,
  screenCoverage: null,
  lightboxScreenId: null,
  refinements: null,
};

export const usePrdStore = create<PrdState & PrdActions>((set) => ({
  ...initialState,
  setState: (updates) => set((s) => ({ ...s, ...updates })),
  addLog: (msg) => set((s) => ({ logs: [...s.logs, `[${new Date().toLocaleTimeString('tr-TR')}] ${msg}`] })),
  setLoading: (key, val) => set((s) => ({
    loading: { ...s.loading, [key]: val },
    loadingStartedAt: { ...s.loadingStartedAt, [key]: val ? (s.loadingStartedAt[key] || Date.now()) : 0 },
  })),
  reset: () => set({ ...initialState, skipAutoLoad: true, urls: [''], logs: [] }),
}));
