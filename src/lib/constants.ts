export const AGENTS = [
  { id: 'main', name: 'Arya', emoji: '\u{1F99E}', role: 'CEO / Orchestrator', model: 'minimax-m2.5', color: '#ff6600' },
  { id: 'koda', name: 'Koda', emoji: '\u{1F916}', role: 'Lead Dev', model: 'kimi-k2p5', color: '#00ff41' },
  { id: 'kaan', name: 'Kaan', emoji: '\u26A1', role: 'Senior Architect', model: 'kimi-k2p5', color: '#00ffff' },
  { id: 'atlas', name: 'Atlas', emoji: '\u{1F30D}', role: 'Infra Lead', model: 'kimi-k2p5', color: '#4488ff' },
  { id: 'defne', name: 'Defne', emoji: '\u{1F50D}', role: 'Research Lead', model: 'minimax-m2.5', color: '#ff44ff' },
  { id: 'sinan', name: 'Sinan', emoji: '\u{1F6E1}\uFE0F', role: 'QA Lead', model: 'minimax-m2.5', color: '#ffaa00' },
  { id: 'elif', name: 'Elif', emoji: '\u{1F4BB}', role: 'Backend Dev', model: 'kimi-k2p5', color: '#44ff88' },
  { id: 'deniz', name: 'Deniz', emoji: '\u270D\uFE0F', role: 'Content Writer', model: 'minimax-m2.5', color: '#ff8844' },
  { id: 'onur', name: 'Onur', emoji: '\u{1F504}', role: 'SRE / Monitoring', model: 'minimax-m2.5', color: '#8844ff' },
  { id: 'mert', name: 'Mert', emoji: '\u{1F3A8}', role: 'Frontend Dev', model: 'minimax-m2.5', color: '#ff4488' },
] as const;

export const AGENT_MAP = Object.fromEntries(AGENTS.map(a => [a.id, a]));

// Map Antfarm workflow agents to real MC agents
export const WORKFLOW_AGENT_MAP: Record<string, string> = {
  // feature-dev workflow
  "feature-dev_planner": "kaan",
  "feature-dev_setup": "atlas",
  "feature-dev_developer": "koda",
  "feature-dev_verifier": "sinan",
  "feature-dev_tester": "sinan",
  "feature-dev_reviewer": "defne",
  "feature-dev_merge": "atlas",
  // bug-fix workflow
  "bug-fix_triager": "defne",
  "bug-fix_setup": "atlas",
  "bug-fix_fixer": "elif",
  "bug-fix_verifier": "sinan",
  "bug-fix_pr": "koda",
  // security-audit workflow
  "security-audit_scanner": "sinan",
  "security-audit_tester": "sinan",
  "security-audit_fixer": "elif",
  "security-audit_verifier": "defne",
  "security-audit_pr": "koda",
};
