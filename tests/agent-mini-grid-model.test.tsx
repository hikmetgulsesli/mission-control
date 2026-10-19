import React from 'react';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgentMiniGrid } from '../src/components/AgentMiniGrid.js';
import type { ModelIdentity } from '../server/shared/agents.js';

const render = (agents: any[] = [], pipeline: any[] = [], sessions: any[] = []) =>
  renderToStaticMarkup(<AgentMiniGrid agents={agents} pipeline={pipeline} sessions={sessions} />);
const cards = (html: string) => html.split(/(?=<div class="af-agent-card )/).slice(1);
const identity = (rawModelId: string | null, rawProviderId: string | null, provenance: ModelIdentity['provenance']): ModelIdentity =>
  ({ rawModelId, rawProviderId, provenance });

// Replacing runtime identity with catalog metadata would erase these exact raw values.
for (const [provenance, label] of [['observed_session', 'Observed session'], ['configured', 'Configured']] as const) {
  test(`compact cards show exact ${provenance} model/provider ahead of legacy and catalog values`, () => {
    const card = cards(render([{ id: 'main', model: 'legacy-ignored', modelIdentity: identity('vendor/model:raw-v9', 'provider/raw-v2', provenance) }]))[0];
    assert.match(card, />vendor\/model:raw-v9</);
    assert.match(card, />Provider: provider\/raw-v2</);
    assert.ok(card.includes(`>${label}<`));
    assert.doesNotMatch(card, /minimax-m2\.7|legacy-ignored/);
  });
}

test('explicit authoritative null stays unknown even with a legacy model and catalog default', () => {
  const card = cards(render([{ id: 'main', model: 'legacy-ignored', modelIdentity: identity(null, null, 'unknown') }]))[0];
  assert.match(card, />unknown</);
  assert.match(card, />Provider: unknown</);
  assert.match(card, />Unknown provenance</);
  assert.doesNotMatch(card, /minimax-m2\.7|legacy-ignored|Static default/);
});

test('legacy raw model remains exact with unknown provenance and no inferred provider', () => {
  const card = cards(render([{ id: 'main', model: 'openai/raw-legacy' }]))[0];
  assert.match(card, />openai\/raw-legacy</);
  assert.match(card, />Unknown provenance</);
  assert.match(card, />Provider: unknown</);
  assert.doesNotMatch(card, />Provider: openai<|minimax-m2\.7|Static default/);
});

test('catalog-only cards and explicit static fallback visibly identify the model as a default', () => {
  const catalog = cards(render())[0];
  assert.match(catalog, />minimax-m2\.7</);
  assert.match(catalog, />Static default</);
  assert.match(catalog, />Provider: unknown</);
  const explicit = cards(render([{ id: 'main', modelIdentity: identity('raw-static-model', null, 'static_fallback') }]))[0];
  assert.match(explicit, />raw-static-model</);
  assert.match(explicit, />Static default</);
  assert.doesNotMatch(explicit, /minimax-m2\.7/);
});

test('unknown observed IDs follow the fourteen catalog agents once with their safe actual display identity', () => {
  const html = render([
    { id: 'external-worker', name: 'fallback name', identityName: '<External & worker>', identityEmoji: '🔧', modelIdentity: identity('raw-worker-model', 'raw-worker-provider', 'observed_session') },
    { id: 'external-worker', name: 'duplicate' },
    { id: 'main', name: 'Arya' },
    { id: 'id-only-worker' },
  ]);
  const names = [...html.matchAll(/class="af-agent-card__name">([^<]*)</g)].map(match => match[1]);
  assert.deepEqual(names, ['Arya', 'Koda', 'Flux', 'Atlas', 'Iris', 'Sentinel', 'Cipher', 'Lux', 'Nexus', 'Prism', 'Axon', 'Nova', 'Zeta', 'Helix', '&lt;External &amp; worker&gt;', 'id-only-worker']);
  const appended = cards(html)[14];
  assert.match(appended, /🔧/);
  assert.match(appended, />raw-worker-model</);
  assert.match(appended, />Provider: raw-worker-provider</);
  assert.doesNotMatch(html, /<External|>duplicate</);
  assert.match(cards(html)[15], />unknown</);
  assert.match(cards(html)[15], />Unknown provenance</);
});

test('existing workflow, recent activity and session-duration mappings remain visible', () => {
  const html = render([{ id: 'koda', status: 'active' }, { name: 'Iris', lastActive: new Date().toISOString() }],
    [{ status: 'running', workflow: 'feature-dev', steps: [{ status: 'running', agent: 'feature-dev_planner', stepId: 'plan' }, { status: 'running', agent: 'unmapped', stepId: 'deploy' }] }],
    [{ agent: 'arya', duration: 120000 }, { agentId: 'koda', duration: 3600000 }]);
  const rendered = cards(html);
  assert.match(rendered[0], /session-time--green">2m</);
  assert.match(rendered[1], /af-agent-card--active/);
  assert.match(rendered[1], /session-time--red">1h</);
  assert.match(rendered[2], /af-agent-card--workflow/);
  assert.match(rendered[2], /plan \(feature-dev\)/);
  assert.match(rendered[3], /af-agent-card--workflow/);
  assert.match(rendered[3], /deploy \(feature-dev\)/);
  assert.match(rendered[4], /af-agent-card--active/);
  assert.match(rendered[5], /af-agent-card--idle/);
});
