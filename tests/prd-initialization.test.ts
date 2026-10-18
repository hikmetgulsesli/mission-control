import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { usePrdStore } from '../src/store/prdStore.js';
import {
  createPrdInitializer,
  findSavedActivePrdRun,
  parsePrdCloneIntent,
} from '../src/lib/prd-initialization.js';

const storage = new Map<string, string>();
const session = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => { storage.set(key, value); },
  removeItem: (key: string) => { storage.delete(key); },
};
Object.defineProperty(globalThis, 'sessionStorage', { value: session, configurable: true });

beforeEach(() => {
  usePrdStore.getState().reset();
  usePrdStore.getState().setState({ skipAutoLoad: false });
  storage.clear();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const savedPrd = {
  id: 'saved-prd', title: 'Saved project', platform: 'mobile', urls: ['https://example.test'],
  description: 'Saved description', prd_content: '# Saved content', prd_version: 3,
  score: 70, score_details: { total: 70 }, cost_estimate: { tokenCost: 2 },
  analysis: { title: 'Saved analysis' }, research: { findings: [] },
  chat_history: [{ role: 'user', content: 'Saved chat' }], run_id: 'saved-run',
  stitch_project_id: 'saved-stitch', mockup_screens: [
    { id: 'saved-screen', projectId: 'saved-stitch' }, { id: 'old-screen', projectId: 'old-stitch' },
  ],
};

function setup(history = Promise.resolve([savedPrd]), pipeline: Promise<any[]> = Promise.resolve([])) {
  return createPrdInitializer({
    store: usePrdStore,
    history: () => history,
    pipeline: () => pipeline,
    storage: session,
  });
}

// Catches lost empty values, double decoding, and treating an unrelated query as a clone.
test('clone intent preserves explicit empty fields and decodes text exactly once', () => {
  assert.deepEqual(parsePrdCloneIntent('?title=A101&description=clone'), { title: 'A101', description: 'clone' });
  assert.deepEqual(parsePrdCloneIntent('?title=&description='), { title: '', description: '' });
  assert.deepEqual(parsePrdCloneIntent('?description=only'), { title: '', description: 'only' });
  assert.deepEqual(parsePrdCloneIntent('?title=only'), { title: 'only', description: '' });
  assert.deepEqual(parsePrdCloneIntent('?title=%C3%87ay+%26+%3Ctag%3E&description=%2520%0A%F0%9F%8C%B1'), {
    title: 'Çay & <tag>', description: '%20\n🌱',
  });
  assert.equal(parsePrdCloneIntent(''), null);
  assert.equal(parsePrdCloneIntent('?tab=history'), null);
});

// Catches fallback-to-latest, grouped-response assumptions, and duplicated active-status authority.
test('saved run lookup uses the exact ID and every canonical active transition', () => {
  for (const status of ['running', 'resuming', 'cancelling', 'failing']) {
    assert.equal(findSavedActivePrdRun([{ id: 'other', status: 'running' }, { id: 'saved', status }], 'saved'), 'saved');
  }
  for (const status of ['completed', 'failed', 'cancelled', 'pending', 'RUNNING', null]) {
    assert.equal(findSavedActivePrdRun([{ id: 'saved', status }, { id: 'other', status: 'running' }], 'saved'), null);
  }
  for (const rows of [null, {}, { running: [{ id: 'saved', status: 'running' }] }, [null, 4, {}, { id: 'other', status: 'running' }]]) {
    assert.equal(findSavedActivePrdRun(rows, 'saved'), null);
  }
  assert.equal(findSavedActivePrdRun([{ id: '', status: 'running' }], ''), null);
});

// Catches stale IDs/screens/skip flags surviving an explicit new clone; real store reset is exercised.
test('explicit clone clears the complete prior draft and overrides both skip flags', async () => {
  usePrdStore.getState().setState({
    ...{ id: 'old', title: 'old', description: 'old', prdContent: '# old', runId: 'old-run' },
    skipAutoLoad: true, mockupScreens: [{ id: 'old-screen' }], stitchProjectId: 'old-stitch',
    screenCoverage: { covered: ['old'], missing: [], coverage: 100 }, lightboxScreenId: 'old-screen',
    analysis: { old: true }, research: { old: true }, chatHistory: [{ role: 'user', content: 'old' }],
    showHistory: true, showTemplates: true, activeTab: 'mockup', loading: { mockups: true },
  });
  storage.set('prd_skip_autoload', '1');
  await setup().beginNavigation({ key: 'clone', search: '?title=A101&description=clone' }).done;
  const current = usePrdStore.getState();
  assert.equal(current.title, 'A101');
  assert.equal(current.description, 'clone');
  assert.equal(current.id, null);
  assert.equal(current.runId, null);
  assert.equal(current.prdContent, '');
  assert.deepEqual(current.mockupScreens, []);
  assert.deepEqual(current.chatHistory, []);
  assert.deepEqual(current.loading, {});
  assert.deepEqual(current.urls, ['']);
  assert.equal(current.analysis, null);
  assert.equal(current.research, null);
  assert.equal(current.stitchProjectId, null);
  assert.equal(current.screenCoverage, null);
  assert.equal(current.lightboxScreenId, null);
  assert.equal(current.showHistory, false);
  assert.equal(current.showTemplates, false);
  assert.equal(current.activeTab, 'prd');
  assert.equal(current.skipAutoLoad, false);
  assert.equal(storage.has('prd_skip_autoload'), false);
});

test('same navigation applies clone once, retaining edits across effect cleanup and replay', async () => {
  const initializer = setup();
  const first = initializer.beginNavigation({ key: 'clone', search: '?title=A101&description=clone' });
  await first.done;
  usePrdStore.getState().setState({ title: 'Edited', description: 'Keep me' });
  first.cancel();
  await initializer.beginNavigation({ key: 'clone', search: '?title=A101&description=clone' }).done;
  assert.equal(usePrdStore.getState().title, 'Edited');
  assert.equal(usePrdStore.getState().description, 'Keep me');
  await initializer.beginNavigation({ key: 'second-clone', search: '?title=A101&description=clone' }).done;
  assert.equal(usePrdStore.getState().title, 'A101');
});

test('plain PRD loads history and restores its exact active saved run from the flat API array', async () => {
  await setup(undefined, Promise.resolve([
    { id: 'unrelated-newest', status: 'running' }, { id: 'saved-run', status: 'resuming' },
  ])).beginNavigation({ key: 'plain', search: '' }).done;
  const current = usePrdStore.getState();
  assert.equal(current.id, 'saved-prd');
  assert.equal(current.title, 'Saved project');
  assert.equal(current.description, 'Saved description');
  assert.equal(current.prdContent, '# Saved content');
  assert.equal(current.platform, 'mobile');
  assert.equal(current.prdVersion, 3);
  assert.equal(current.runId, 'saved-run');
  assert.deepEqual(current.mockupScreens, [{ id: 'saved-screen', projectId: 'saved-stitch' }]);
});

test('plain history never substitutes an unrelated or terminal run', async () => {
  await setup(undefined, Promise.resolve([
    { id: 'saved-run', status: 'completed' }, { id: 'unrelated', status: 'running' },
  ])).beginNavigation({ key: 'plain', search: '' }).done;
  assert.equal(usePrdStore.getState().id, 'saved-prd');
  assert.equal(usePrdStore.getState().runId, null);
});

test('a newer explicit clone wins a history request already in flight', async () => {
  const history = deferred<any[]>();
  const initializer = setup(history.promise);
  const previous = initializer.beginNavigation({ key: 'plain', search: '' });
  await initializer.beginNavigation({ key: 'clone', search: '?title=A101&description=clone' }).done;
  history.resolve([savedPrd]);
  await previous.done;
  assert.equal(usePrdStore.getState().title, 'A101');
  assert.equal(usePrdStore.getState().id, null);
  assert.equal(usePrdStore.getState().runId, null);
});

for (const interruption of ['edit', 'reset', 'unmount', 'new-navigation'] as const) {
  test(`late history cannot overwrite ${interruption}`, async () => {
    const history = deferred<any[]>();
    const initializer = setup(history.promise);
    const pending = initializer.beginNavigation({ key: 'plain', search: '' });
    if (interruption === 'edit') usePrdStore.getState().setState({ description: 'Typed while loading' });
    if (interruption === 'reset') usePrdStore.getState().reset();
    if (interruption === 'unmount') pending.cancel();
    if (interruption === 'new-navigation') {
      usePrdStore.getState().reset();
      await initializer.beginNavigation({ key: 'new', search: '' }).done;
    }
    history.resolve([savedPrd]);
    await pending.done;
    assert.equal(usePrdStore.getState().id, null);
    assert.equal(usePrdStore.getState().description, interruption === 'edit' ? 'Typed while loading' : '');
  });
}

for (const interruption of ['edit', 'reset', 'unmount', 'clone'] as const) {
  test(`late active-run restore cannot overwrite ${interruption}`, async () => {
    const pipeline = deferred<any[]>();
    const initializer = setup(undefined, pipeline.promise);
    const pending = initializer.beginNavigation({ key: 'plain', search: '' });
    await Promise.resolve(); // History has loaded; pipeline is still pending.
    assert.equal(usePrdStore.getState().id, 'saved-prd');
    if (interruption === 'edit') usePrdStore.getState().setState({ description: 'Keep edit' });
    if (interruption === 'reset') usePrdStore.getState().reset();
    if (interruption === 'unmount') pending.cancel();
    if (interruption === 'clone') await initializer.beginNavigation({ key: 'clone', search: '?title=New' }).done;
    pipeline.resolve([{ id: 'saved-run', status: 'running' }]);
    await pending.done;
    assert.equal(usePrdStore.getState().runId, null);
    if (interruption === 'edit') assert.equal(usePrdStore.getState().description, 'Keep edit');
    if (interruption === 'clone') assert.equal(usePrdStore.getState().title, 'New');
  });
}

test('plain PRD respects New skip state and preserves an existing unsaved draft', async () => {
  usePrdStore.getState().reset();
  await setup().beginNavigation({ key: 'new', search: '' }).done;
  assert.equal(usePrdStore.getState().id, null);
  usePrdStore.getState().setState({ skipAutoLoad: false, title: 'Unsaved draft' });
  storage.clear();
  await setup().beginNavigation({ key: 'draft', search: '' }).done;
  assert.equal(usePrdStore.getState().title, 'Unsaved draft');
  assert.equal(usePrdStore.getState().id, null);
});

test('empty/malformed history and failed requests retain a usable empty draft', async () => {
  for (const rows of [[], null, {}, [null], [{}]]) {
    await setup(Promise.resolve(rows as any)).beginNavigation({ key: 'plain', search: '' }).done;
    assert.equal(usePrdStore.getState().id, null);
  }
  const history = deferred<any[]>();
  const pending = setup(history.promise).beginNavigation({ key: 'failure', search: '' });
  history.reject(new Error('History unavailable'));
  await pending.done;
  assert.equal(usePrdStore.getState().id, null);
});
