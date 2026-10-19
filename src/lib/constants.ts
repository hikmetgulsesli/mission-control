import { AGENTS_ARRAY } from '../../server/shared/agents.js';

export const AGENTS = AGENTS_ARRAY;
export const AGENT_MAP: Record<string, typeof AGENTS[number] | undefined> = Object.fromEntries(AGENTS.map(agent => [agent.id, agent]));

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
