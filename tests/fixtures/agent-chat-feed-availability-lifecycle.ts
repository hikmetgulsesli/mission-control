import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { marked } from 'marked';
import { AGENTS } from '../../src/lib/constants';
import { actualFunction, deferred, lifecycle } from './files-selection-lifecycle';

export { flush } from './files-selection-lifecycle';

export function feedEntry(id = 1, changes: Record<string, unknown> = {}) {
  return {
    id, agent_id: 'main', agent_name: 'Main agent', message: 'First safe message',
    session_id: 'fixture-session', created_at: '2026-10-28T00:00:00Z', ...changes,
  };
}

// Actual component/helpers and hook share one lifecycle. Only transport and the
// SSR sanitizer port are inert; safe messages do not qualify Markdown/XSS safety.
export function agentFeedHarness() {
  const life = lifecycle();
  const calls: { limit: number; result: ReturnType<typeof deferred> }[] = [];
  const api = { setfarmAgentFeed(limit: number) {
    const result = deferred(); calls.push({ limit, result }); return result.promise;
  } };
  const intervals: number[] = [];
  const bindings = { ...life.bindings, setInterval(fn: () => void, ms: number) {
    intervals.push(ms); return life.bindings.setInterval(fn);
  } };
  const source = '../../src/components/AgentChatFeed.tsx';
  const usePolling = actualFunction('../../src/hooks/usePolling.ts', 'usePolling', bindings);
  const timeAgo = actualFunction(source, 'timeAgo', {});
  const renderMd = actualFunction(source, 'renderMd', {
    marked, DOMPurify: { sanitize: (value: string) => value },
  });
  const Feed = actualFunction(source, 'AgentChatFeed', {
    React, api, usePolling, timeAgo, renderMd,
    AGENT_LOOKUP: Object.fromEntries(AGENTS.map(agent => [agent.id, agent])),
  }, true);
  const render = () => life.render<React.ReactElement>(() => Feed());
  const nodes = () => {
    const all: React.ReactElement<any>[] = [];
    const walk = (value: any) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (React.isValidElement<any>(value)) { all.push(value); walk(value.props.children); }
    };
    walk(render()); return all;
  };
  const text = (value: any): string => Array.isArray(value) ? value.map(text).join('')
    : React.isValidElement<any>(value) ? text(value.props.children)
      : typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  const retryCallback = () => nodes().find(node => node.type === 'button' && text(node).trim() === 'Retry')?.props.onClick;
  render();
  return {
    ...life, calls, intervals, render, retryCallback,
    html: () => renderToStaticMarkup(render()),
    messages: () => nodes().filter(node => node.props.className === 'agent-chat__msg'),
    request(index = 0) { assert.ok(calls[index], `feed request ${index} exists`); return calls[index].result; },
    retry() { const callback = retryCallback(); assert.ok(callback, 'Retry exists'); return callback(); },
  };
}
