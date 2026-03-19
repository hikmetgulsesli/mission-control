/**
 * Centralized agent definitions — single source of truth for all agent metadata.
 * Import from here instead of defining local REAL_AGENTS arrays.
 */

export const AGENT_DEFINITIONS = {
  main: { name: 'Arya', emoji: '\u{1F99E}', role: 'CEO / Orchestrator', model: 'minimax-m2.7', color: '#ff6600' },
  koda: { name: 'Koda', emoji: '\u{1F916}', role: 'Lead Dev', model: 'kimi-k2p5', color: '#00ff41' },
  flux: { name: 'Flux', emoji: '\u26A1', role: 'Senior Architect', model: 'kimi-k2p5', color: '#00ffff' },
  atlas: { name: 'Atlas', emoji: '\u{1F30D}', role: 'Infra Lead', model: 'kimi-k2p5', color: '#4488ff' },
  iris: { name: 'Iris', emoji: '\u{1F50D}', role: 'Research Lead', model: 'minimax-m2.7', color: '#ff44ff' },
  sentinel: { name: 'Sentinel', emoji: '\u{1F6E1}\uFE0F', role: 'QA Lead', model: 'minimax-m2.7', color: '#ffaa00' },
  cipher: { name: 'Cipher', emoji: '\u{1F4BB}', role: 'Backend Dev', model: 'kimi-k2p5', color: '#44ff88' },
  lux: { name: 'Lux', emoji: '\u270D\uFE0F', role: 'Content Writer', model: 'minimax-m2.7', color: '#ff8844' },
  nexus: { name: 'Nexus', emoji: '\u{1F504}', role: 'SRE / Monitoring', model: 'minimax-m2.7', color: '#8844ff' },
  prism: { name: 'Prism', emoji: '\u{1F3A8}', role: 'UI Designer', model: 'kimi-k2p5', color: '#ff4488' },
} as const;

export type AgentId = keyof typeof AGENT_DEFINITIONS;

export const REAL_AGENT_IDS: AgentId[] = Object.keys(AGENT_DEFINITIONS) as AgentId[];

/** Flat array format (same structure as frontend constants.ts AGENTS) */
export const AGENTS_ARRAY = REAL_AGENT_IDS.map(id => ({ id, ...AGENT_DEFINITIONS[id] }));

/** Map from agent ID to full definition */
export const AGENT_MAP = Object.fromEntries(AGENTS_ARRAY.map(a => [a.id, a])) as Record<AgentId, typeof AGENTS_ARRAY[number]>;
