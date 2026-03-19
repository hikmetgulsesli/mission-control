export const AGENTS = [
  { id: 'main', name: 'Arya', emoji: '\u{1F99E}', role: 'CEO / Orchestrator', model: 'minimax-m2.5', color: '#ff6600' },
  { id: 'koda', name: 'Koda', emoji: '\u{1F916}', role: 'Lead Dev', model: 'kimi-k2p5', color: '#00ff41' },
  { id: 'flux', name: 'Flux', emoji: '\u26A1', role: 'Senior Architect', model: 'kimi-k2p5', color: '#00ffff' },
  { id: 'atlas', name: 'Atlas', emoji: '\u{1F30D}', role: 'Infra Lead', model: 'kimi-k2p5', color: '#4488ff' },
  { id: 'iris', name: 'Iris', emoji: '\u{1F50D}', role: 'Research Lead', model: 'minimax-m2.5', color: '#ff44ff' },
  { id: 'sentinel', name: 'Sentinel', emoji: '\u{1F6E1}\uFE0F', role: 'QA Lead', model: 'minimax-m2.5', color: '#ffaa00' },
  { id: 'cipher', name: 'Cipher', emoji: '\u{1F4BB}', role: 'Backend Dev', model: 'kimi-k2p5', color: '#44ff88' },
  { id: 'lux', name: 'Lux', emoji: '\u270D\uFE0F', role: 'Content Writer', model: 'minimax-m2.5', color: '#ff8844' },
  { id: 'nexus', name: 'Nexus', emoji: '\u{1F504}', role: 'SRE / Monitoring', model: 'minimax-m2.5', color: '#8844ff' },
  { id: 'prism', name: 'Prism', emoji: '\u{1F3A8}', role: 'UI Designer', model: 'kimi-k2p5', color: '#ff4488' },
] as const;

export const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// Map Setfarm workflow agents to real MC agents
export const WORKFLOW_AGENT_MAP: Record<string, string> = {
  // feature-dev workflow v12.0
  "feature-dev_planner": "flux",
  "feature-dev_designer": "prism",
  "feature-dev_story-writer": "iris",
  "feature-dev_setup": "atlas",
  "feature-dev_developer": "koda",
  "feature-dev_verifier": "sentinel",
  "feature-dev_tester": "nexus",
  "feature-dev_reviewer": "iris",
  "feature-dev_merge": "atlas",
  "feature-dev_security": "sentinel",
  "feature-dev_qa-tester": "sentinel",
  "feature-dev_deployer": "atlas",
  // bug-fix workflow
  "bug-fix_triager": "iris",
  "bug-fix_setup": "atlas",
  "bug-fix_fixer": "cipher",
  "bug-fix_verifier": "sentinel",
  "bug-fix_pr": "koda",
  // security-audit workflow
  "security-audit_scanner": "sentinel",
  "security-audit_tester": "sentinel",
  "security-audit_fixer": "cipher",
  "security-audit_verifier": "iris",
  "security-audit_pr": "koda",
};
