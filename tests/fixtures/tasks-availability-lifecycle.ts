import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { actualFunction, deferred, lifecycle } from './files-selection-lifecycle';

export { flush } from './files-selection-lifecycle';

export function task(id = 'task-1', changes: Record<string, unknown> = {}) {
  return {
    id, title: 'First task', description: 'Task details', assigned_agent: '',
    priority: 'medium', status: 'in_progress', images: [],
    created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z',
    ...changes,
  };
}

// The page and polling hook execute their actual declarations in one lifecycle.
// Only read transport and child boundaries are inert; no task mutation runs.
export function tasksHarness() {
  const life = lifecycle();
  const calls: { method: 'tasks' | 'agents'; result: ReturnType<typeof deferred> }[] = [];
  const api = Object.fromEntries(['tasks', 'agents'].map(method => [method, () => {
    const result = deferred(); calls.push({ method: method as 'tasks' | 'agents', result });
    return result.promise;
  }]));
  const intervals: number[] = [];
  const bindings = {
    ...life.bindings,
    setInterval(fn: () => void, ms: number) { intervals.push(ms); return life.bindings.setInterval(fn); },
  };
  const usePolling = actualFunction('../../src/hooks/usePolling.ts', 'usePolling', bindings);
  const TaskBoard = () => null;
  const TaskDetailModal = () => null;
  const page = actualFunction('../../src/pages/Tasks.tsx', 'Tasks', {
    ...bindings, React, api, usePolling, TaskBoard, TaskDetailModal, console: { error() {} },
  }, true);
  const render = () => life.render<React.ReactElement>(() => page());
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
  const child = (type: any) => nodes().find(node => node.type === type)?.props;
  render();
  return {
    ...life, calls, intervals, render,
    html: () => renderToStaticMarkup(render()),
    board: () => child(TaskBoard), modal: () => child(TaskDetailModal),
    request(method: 'tasks' | 'agents', index = 0) {
      const call = calls.filter(call => call.method === method)[index];
      assert.ok(call, `${method} request ${index} exists`); return call.result;
    },
    button(label: string) {
      const button = nodes().find(node => node.type === 'button' && text(node).trim() === label);
      assert.ok(button, `${label} button exists`); return button.props.onClick();
    },
  };
}
