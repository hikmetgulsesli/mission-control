import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Controls } from '../../src/pages/Controls';
import '../../src/index.css';

// The only driver operations are real React lifetime changes. No report, receipt,
// session, storage, API, or component state injection is exposed here.
let root: Root | null = null;
function mount() {
  if (root) throw new Error('CONTROLS_FIXTURE_ALREADY_MOUNTED');
  root = createRoot(document.getElementById('root')!);
  root.render(<Controls />);
}
function unmount() { root?.unmount(); root = null; }
Object.assign(window, { controlsFixture: Object.freeze({ unmount, remount: () => { unmount(); mount(); } }) });
mount();
