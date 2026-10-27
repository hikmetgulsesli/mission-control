import assert from 'node:assert/strict';
import test from 'node:test';
import { file, filesHarness, flush, select } from './fixtures/files-selection-lifecycle';

for (const stale of ['success', 'failure']) test(`file A ${stale} after B succeeds cannot replace B`, async () => {
  const h = filesHarness(); h.tree().onSelectFile('/A'); h.tree().onSelectFile('/B');
  h.request('filesRead', '/B').resolve(file('/B', 'B content')); await flush();
  stale === 'success' ? h.request('filesRead', '/A').resolve(file('/A')) : h.request('filesRead', '/A').reject(new Error('A failed')); await flush();
  assert.equal(h.tree().selectedFile, '/B'); assert.equal(h.viewer().file.content, 'B content'); assert.equal(h.viewer().error, null); assert.equal(h.viewer().loading, false);
  assert.deepEqual(h.calls.map(c => c.args[0]), ['/A', '/B']); h.unmount();
});
test('old failure/finally cannot finish replacement loading or overwrite its error', async () => {
  const h = filesHarness(); h.tree().onSelectFile('/A'); h.tree().onSelectFile('/B');
  h.request('filesRead', '/A').reject(new Error('old')); await flush(); assert.equal(h.viewer().error, null); assert.equal(h.viewer().loading, true);
  h.request('filesRead', '/B').reject(new Error('current')); await flush(); assert.equal(h.viewer().error, 'current'); assert.equal(h.viewer().loading, false); h.unmount();
});
test('selection clears old content immediately; A to B to A distinguishes the first A', async () => {
  const h = filesHarness(); await select(h, '/old'); h.tree().onSelectFile('/A'); assert.equal(h.viewer().file, null);
  h.tree().onSelectFile('/B'); h.tree().onSelectFile('/A'); h.request('filesRead', '/A').resolve(file('/A', 'first A')); await flush();
  assert.equal(h.viewer().file, null); assert.equal(h.viewer().loading, true);
  h.request('filesRead', '/A', 1).resolve(file('/A', 'last A')); await flush(); h.request('filesRead', '/B').resolve(file('/B')); await flush();
  assert.equal(h.viewer().file.content, 'last A'); h.unmount();
});
test('navigation invalidates reads and unmount permits no late state setter', async () => {
  const h = filesHarness(); h.tree().onSelectFile('/A'); h.tree().onNavigate('/other/'); h.request('filesRead', '/A').resolve(file('/A')); await flush();
  assert.equal(h.tree().selectedFile, null); assert.equal(h.viewer().file, null); assert.equal(h.viewer().loading, false);
  h.tree().onSelectFile('/B'); h.unmount(); h.request('filesRead', '/B').reject(new Error('late')); await flush(); assert.equal(h.postUnmountSetters(), 0); assert.equal(h.timers.size, 0);
});
test('unsaved select/navigation cancel keeps draft; acceptance executes intended edit using accepted content', async () => {
  const h = filesHarness(); await select(h, '/A', 'A text'); h.viewer().onStartEdit(); h.viewer().onEditChange('A draft');
  h.tree().onSelectFile('/B'); assert.equal(h.confirm().open, true); assert.equal(h.calls.length, 1); h.confirm().onCancel();
  assert.equal(h.viewer().editContent, 'A draft'); assert.equal(h.tree().selectedFile, '/A');
  h.tree().onNavigate('/other/'); h.confirm().onCancel(); assert.equal(h.tree().currentPath, '/root/');
  h.context('/B', 'Edit'); assert.equal(h.confirm().open, true); assert.equal(h.calls.length, 1); h.confirm().onConfirm();
  h.request('filesRead', '/B').resolve(file('/B', 'B text')); await flush(); assert.equal(h.viewer().editMode, true); assert.equal(h.viewer().editContent, 'B text'); assert.equal(h.timers.size, 0);
  h.tree().onNavigate('/other/'); h.confirm().onConfirm(); assert.equal(h.tree().currentPath, '/other/'); assert.equal(h.tree().selectedFile, null); h.unmount();
});
test('context Edit uses new read directly and superseded edit intent cannot start editing B', async () => {
  const h = filesHarness(); await select(h, '/old', 'old text'); h.context('/A', 'Edit'); h.request('filesRead', '/A').resolve(file('/A', 'A text')); await flush();
  assert.equal(h.viewer().editMode, true); assert.equal(h.viewer().editContent, 'A text'); assert.equal(h.timers.size, 0);
  h.viewer().onCancel(); h.context('/C', 'Edit'); h.tree().onSelectFile('/B'); h.request('filesRead', '/B').resolve(file('/B', 'B text')); await flush();
  h.request('filesRead', '/C').resolve(file('/C')); await flush(); h.tick(); assert.equal(h.viewer().editMode, false); assert.equal(h.viewer().file.content, 'B text'); h.unmount();
});
for (const phase of ['write', 'readback']) test(`save A ${phase} completion cannot replace B or end B draft`, async () => {
  const h = filesHarness(); await select(h, '/A', 'A text'); h.viewer().onStartEdit(); h.viewer().onEditChange('A draft'); const saved = h.viewer().onSave();
  assert.deepEqual(h.calls.find(c => c.method === 'filesWrite')?.args, ['/A', 'A draft']);
  if (phase === 'readback') { h.request('filesWrite', '/A').resolve({}); await flush(); }
  h.tree().onSelectFile('/B'); h.confirm().onConfirm(); h.request('filesRead', '/B').resolve(file('/B', 'B text')); await flush(); h.viewer().onStartEdit(); h.viewer().onEditChange('B draft');
  if (phase === 'write') { h.request('filesWrite', '/A').resolve({}); await flush(); }
  const readback = h.calls.filter(c => c.method === 'filesRead' && c.args[0] === '/A')[1]; if (readback) readback.result.resolve(file('/A', 'A saved'));
  await saved; await flush(); assert.equal(h.tree().selectedFile, '/B'); assert.equal(h.viewer().file.content, 'B text'); assert.equal(h.viewer().editMode, true); assert.equal(h.viewer().editContent, 'B draft');
  assert.equal(h.calls.filter(c => c.method === 'filesWrite').length, 1); assert.equal(h.toasts.length, 0); h.unmount();
});
test('current save retains captured write, accepts readback, ends editing; undo/cancel/download remain', async () => {
  const h = filesHarness(); await select(h, '/A', 'initial'); h.viewer().onStartEdit(); h.viewer().onEditChange('draft'); h.viewer().onUndo(); assert.equal(h.viewer().editContent, 'initial');
  h.viewer().onEditChange('saved'); const saving = h.viewer().onSave(); assert.equal(h.viewer().saving, true); h.request('filesWrite', '/A').resolve({}); await flush(); h.request('filesRead', '/A', 1).resolve(file('/A', 'saved')); await saving;
  assert.equal(h.viewer().file.content, 'saved'); assert.equal(h.viewer().editMode, false); assert.equal(h.viewer().saving, false); assert.equal(h.refreshes(), 1);
  h.viewer().onStartEdit(); h.viewer().onCancel(); assert.equal(h.viewer().editContent, ''); h.viewer().onDownload(); assert.deepEqual(h.downloads, [['/api/files/download?path=%2FA', '_blank']]); h.unmount();
});
for (const action of ['Rename', 'Delete']) test(`late ${action} cannot retarget/clear replacement, including repeated A`, async () => {
  const h = filesHarness(); await select(h, '/A'); h.context('/A', action); if (action === 'Rename') h.input('renamed');
  const operation = h.button(action === 'Rename' ? 'Save' : 'Delete'); h.tree().onSelectFile('/B'); h.tree().onSelectFile('/A'); h.request('filesRead', '/A', 1).resolve(file('/A', 'replacement')); await flush();
  h.request(action === 'Rename' ? 'filesRename' : 'filesDelete', '/A').resolve({}); await flush();
  for (const c of h.calls.filter(c => c.method === 'filesRead' && c.args[0] === '/renamed')) c.result.resolve(file('/renamed')); await operation;
  assert.equal(h.tree().selectedFile, '/A'); assert.equal(h.viewer().file.content, 'replacement');
  assert.equal(h.calls.filter(c => c.method === (action === 'Rename' ? 'filesRename' : 'filesDelete')).length, 1); h.request('filesRead', '/B').resolve(file('/B')); await flush(); h.unmount();
});
test('rename readback after selection replacement is ignored; successful current rename and delete work', async () => {
  const h = filesHarness(); await select(h, '/A'); h.context('/A', 'Rename'); h.input('renamed'); const renamed = h.button('Save');
  assert.deepEqual(h.calls.find(c => c.method === 'filesRename')?.args, ['/A', '/renamed']); h.request('filesRename', '/A').resolve({}); await flush();
  h.tree().onSelectFile('/B'); h.request('filesRead', '/B').resolve(file('/B')); await flush(); h.request('filesRead', '/renamed').resolve(file('/renamed')); await renamed;
  assert.equal(h.tree().selectedFile, '/B'); assert.equal(h.viewer().file.path, '/B');
  h.context('/B', 'Rename'); h.input('current'); const current = h.button('Save'); h.request('filesRename', '/B').resolve({}); await flush(); h.request('filesRead', '/current').resolve(file('/current', 'renamed text')); await current;
  assert.equal(h.tree().selectedFile, '/current'); assert.equal(h.viewer().file.content, 'renamed text'); h.context('/current', 'Delete'); const deleted = h.button('Delete'); h.request('filesDelete', '/current').resolve({}); await deleted;
  assert.equal(h.tree().selectedFile, null); assert.equal(h.viewer().file, null); assert.equal(h.viewer().editMode, false); h.unmount();
});
test('new-file completion cannot steal a newer selection; current creation reads and edits accepted content', async () => {
  const h = filesHarness(); h.tree().onNewFile(); h.input('new.txt'); const created = h.button('Create'); assert.deepEqual(h.calls[0].args, ['/root/new.txt', '']);
  h.tree().onSelectFile('/B'); h.request('filesRead', '/B').resolve(file('/B')); await flush(); h.request('filesWrite', '/root/new.txt').resolve({}); await flush();
  const staleRead = h.calls.find(c => c.method === 'filesRead' && c.args[0] === '/root/new.txt'); if (staleRead) staleRead.result.resolve(file('/root/new.txt')); await created; await flush();
  assert.equal(h.tree().selectedFile, '/B'); assert.equal(h.viewer().file.path, '/B'); assert.equal(h.viewer().editMode, false);
  h.tree().onNewFile(); h.input('current.txt'); const current = h.button('Create'); h.request('filesWrite', '/root/current.txt').resolve({}); await flush(); h.request('filesRead', '/root/current.txt').resolve(file('/root/current.txt', 'accepted new content')); await current; await flush();
  assert.equal(h.tree().selectedFile, '/root/current.txt'); assert.equal(h.viewer().editMode, true); assert.equal(h.viewer().editContent, 'accepted new content'); assert.equal(h.timers.size, 0);
  assert.deepEqual(h.calls.filter(c => c.method === 'filesWrite').map(c => c.args), [['/root/new.txt', ''], ['/root/current.txt', '']]); h.unmount();
});
test('unmount during save write suppresses readback, UI setters and follow-up refresh', async () => {
  const h = filesHarness(); await select(h, '/A'); h.viewer().onStartEdit(); const saved = h.viewer().onSave(); h.unmount(); h.request('filesWrite', '/A').resolve({}); await flush();
  const readback = h.calls.filter(c => c.method === 'filesRead')[1]; if (readback) readback.result.resolve(file('/A')); await saved;
  assert.equal(h.postUnmountSetters(), 0); assert.equal(h.refreshes(), 0); assert.equal(h.calls.length, 2);
});
for (const stale of ['success', 'failure']) test(`late A ${stale} preserves B read error`, async () => {
  const h = filesHarness(); h.tree().onSelectFile('/A'); h.tree().onSelectFile('/B'); h.request('filesRead', '/B').reject(new Error('B failure')); await flush();
  stale === 'success' ? h.request('filesRead', '/A').resolve(file('/A')) : h.request('filesRead', '/A').reject(new Error('A failure')); await flush();
  assert.equal(h.viewer().file, null); assert.equal(h.viewer().error, 'B failure'); assert.equal(h.viewer().loading, false); h.unmount();
});
test('directory context New File navigation invalidates pending file read and respects unsaved confirmation', async () => {
  const h = filesHarness(); h.tree().onSelectFile('/A'); h.context('/other', 'New File', true); h.request('filesRead', '/A').resolve(file('/A')); await flush();
  assert.equal(h.tree().currentPath, '/other/'); assert.equal(h.tree().selectedFile, null); assert.equal(h.viewer().file, null);
  h.button('Cancel'); await select(h, '/B'); h.viewer().onStartEdit(); h.viewer().onEditChange('draft'); h.context('/last', 'New File', true);
  assert.equal(h.confirm().open, true); h.confirm().onCancel(); assert.equal(h.tree().currentPath, '/other/'); assert.equal(h.viewer().editContent, 'draft'); h.unmount();
});
test('new-file read/edit intent is discarded after a later selection and after unmount', async () => {
  for (const unmount of [false, true]) {
    const h = filesHarness(); h.tree().onNewFile(); h.input('new.txt'); const operation = h.button('Create'); h.request('filesWrite', '/root/new.txt').resolve({}); await flush();
    if (unmount) h.unmount(); else { h.tree().onSelectFile('/B'); h.request('filesRead', '/B').resolve(file('/B')); await flush(); }
    h.request('filesRead', '/root/new.txt').resolve(file('/root/new.txt')); await operation; await flush();
    if (unmount) assert.equal(h.postUnmountSetters(), 0); else { assert.equal(h.viewer().file.path, '/B'); assert.equal(h.viewer().editMode, false); h.unmount(); }
    assert.equal(h.timers.size, 0);
  }
});

for (const phase of ['write', 'readback']) {
  for (const change of ['type', 'cancel-reedit', 'undo']) {
    test(`save ${phase} completion preserves same-selection ${change} revision and settles saving`, async () => {
      const h = filesHarness();
      await select(h, '/A', 'initial');
      h.viewer().onStartEdit();
      h.viewer().onEditChange('submitted');
      const saved = h.viewer().onSave();
      assert.equal(h.viewer().saving, true);
      assert.deepEqual(h.calls.find(c => c.method === 'filesWrite')?.args, ['/A', 'submitted']);
      if (phase === 'readback') {
        h.request('filesWrite', '/A').resolve({ success: true });
        await flush();
        assert.equal(h.calls.filter(c => c.method === 'filesRead').length, 2);
      }
      if (change === 'cancel-reedit') {
        h.viewer().onCancel();
        h.viewer().onStartEdit();
      }
      if (change === 'undo') h.viewer().onUndo();
      else h.viewer().onEditChange('newer unsaved draft');
      assert.equal(h.viewer().saving, true);
      const expectedDraft = change === 'undo' ? 'initial' : 'newer unsaved draft';
      if (phase === 'write') {
        h.request('filesWrite', '/A').resolve({ success: true });
        await flush();
      }
      // Settle any read emitted by the old implementation to expose its actual completion.
      const readback = h.calls.filter(c => c.method === 'filesRead')[1];
      if (readback) readback.result.resolve(file('/A', 'submitted'));
      await saved;
      await flush();
      assert.equal(h.tree().selectedFile, '/A');
      assert.equal(h.viewer().editMode, true, 'later edit session stays open');
      assert.equal(h.viewer().editContent, expectedDraft);
      assert.equal(h.viewer().file.content, 'initial', 'obsolete readback is not accepted');
      assert.equal(h.viewer().saving, false, 'completed save settles despite losing edit ownership');
      assert.equal(h.viewer().hasChanges, change !== 'undo');
      assert.equal(h.calls.filter(c => c.method === 'filesRead').length, phase === 'readback' ? 2 : 1);
      assert.deepEqual(h.calls.filter(c => c.method === 'filesWrite').map(c => c.args), [['/A', 'submitted']]);
      assert.deepEqual(h.toasts, []);
      h.unmount();
    });
  }
}

test('older save finally cannot settle a newer save on the same selection', async () => {
  const h = filesHarness();
  await select(h, '/A', 'initial');
  h.viewer().onStartEdit();
  h.viewer().onEditChange('first submitted');
  const first = h.viewer().onSave();
  h.viewer().onEditChange('second submitted');
  const second = h.viewer().onSave();
  h.request('filesWrite', '/A').resolve({ success: true });
  await flush();
  const oldReadback = h.calls.filter(c => c.method === 'filesRead')[1];
  if (oldReadback) oldReadback.result.resolve(file('/A', 'first submitted'));
  await first;
  assert.equal(h.viewer().saving, true, 'newer save still pending');
  assert.equal(h.viewer().editMode, true);
  assert.equal(h.viewer().editContent, 'second submitted');
  h.request('filesWrite', '/A', 1).resolve({ success: true });
  await flush();
  const currentReadback = h.calls.filter(c => c.method === 'filesRead').at(-1)!;
  currentReadback.result.resolve(file('/A', 'second submitted'));
  await second;
  assert.equal(h.viewer().file.content, 'second submitted');
  assert.equal(h.viewer().editMode, false);
  assert.equal(h.viewer().saving, false);
  assert.equal(h.calls.filter(c => c.method === 'filesRead').length, 2);
  assert.deepEqual(h.calls.filter(c => c.method === 'filesWrite').map(c => c.args), [['/A', 'first submitted'], ['/A', 'second submitted']]);
  h.unmount();
});

test('create completion after dialog dismissal cannot replace a newer draft on the same file', async () => {
  const h = filesHarness();
  await select(h, '/A', 'initial');
  h.tree().onNewFile();
  h.input('new.txt');
  const created = h.button('Create');
  h.button('Cancel');
  h.viewer().onStartEdit();
  h.viewer().onEditChange('newer A draft');
  h.request('filesWrite', '/root/new.txt').resolve({ success: true });
  await flush();
  const oldFollowup = h.calls.find(c => c.method === 'filesRead' && c.args[0] === '/root/new.txt');
  if (oldFollowup) oldFollowup.result.resolve(file('/root/new.txt', ''));
  await created;
  await flush();
  assert.equal(h.tree().selectedFile, '/A');
  assert.equal(h.viewer().file.content, 'initial');
  assert.equal(h.viewer().editMode, true);
  assert.equal(h.viewer().editContent, 'newer A draft');
  assert.equal(h.viewer().saving, false);
  assert.equal(h.confirm().open, false, 'obsolete auto-selection is discarded');
  assert.deepEqual(h.calls.map(c => [c.method, ...c.args]), [['filesRead', '/A'], ['filesWrite', '/root/new.txt', '']]);
  assert.equal(h.refreshes(), 1, 'submitted creation still refreshes the listing');
  h.tree().onSelectFile('/B');
  assert.equal(h.confirm().open, true);
  h.confirm().onCancel();
  assert.equal(h.viewer().editContent, 'newer A draft');
  h.unmount();
});

test('current create while editing retains explicit confirmation cancel and accepted destination', async () => {
  const h = filesHarness();
  await select(h, '/A', 'initial');
  h.viewer().onStartEdit();
  h.viewer().onEditChange('existing draft');
  h.tree().onNewFile();
  h.input('cancelled.txt');
  const cancelled = h.button('Create');
  h.request('filesWrite', '/root/cancelled.txt').resolve({ success: true });
  await cancelled;
  assert.equal(h.confirm().open, true);
  assert.equal(h.calls.filter(c => c.method === 'filesRead').length, 1);
  h.confirm().onCancel();
  assert.equal(h.tree().selectedFile, '/A');
  assert.equal(h.viewer().editContent, 'existing draft');
  h.tree().onNewFile();
  h.input('accepted.txt');
  const accepted = h.button('Create');
  h.request('filesWrite', '/root/accepted.txt').resolve({ success: true });
  await accepted;
  assert.equal(h.confirm().open, true);
  h.confirm().onConfirm();
  h.request('filesRead', '/root/accepted.txt').resolve(file('/root/accepted.txt', 'accepted content'));
  await flush();
  assert.equal(h.tree().selectedFile, '/root/accepted.txt');
  assert.equal(h.viewer().editMode, true);
  assert.equal(h.viewer().editContent, 'accepted content');
  assert.deepEqual(h.calls.filter(c => c.method === 'filesWrite').map(c => c.args), [['/root/cancelled.txt', ''], ['/root/accepted.txt', '']]);
  h.unmount();
});

test('delete submitted before a new same-file edit session cannot clear its later draft', async () => {
  const h = filesHarness();
  await select(h, '/A', 'initial');
  h.context('/A', 'Delete');
  const deleted = h.button('Delete');
  h.button('Cancel');
  h.viewer().onStartEdit();
  h.viewer().onEditChange('later A draft');
  h.request('filesDelete', '/A').resolve({ success: true });
  await deleted;
  assert.equal(h.tree().selectedFile, '/A');
  assert.equal(h.viewer().file.content, 'initial');
  assert.equal(h.viewer().editMode, true);
  assert.equal(h.viewer().editContent, 'later A draft');
  assert.equal(h.viewer().saving, false);
  assert.deepEqual(h.calls.map(c => [c.method, ...c.args]), [['filesRead', '/A'], ['filesDelete', '/A']]);
  assert.equal(h.refreshes(), 1);
  h.unmount();
});
