# Mac Mini M4 - Visual QA Station (Setfarm v1.5.48+ Integration)

## Context

The Setfarm pipeline codes projects, builds them, and runs smoke tests, but it does not yet perform a real visual inspection. Smoke test v3 only checks for blank pages, JavaScript exceptions, and placeholders. It does not compare the implemented UI with the Stitch-designed UI at pixel level.

**Mac Mini M4** (16GB RAM, M4 10-core, 192.168.1.199, same network) can fill that gap:
- Add a **VISUAL-QA** step to the pipeline (FINAL-TEST -> VISUAL-QA -> DEPLOY = 10 steps)
- Compare real headed Chrome renders against Stitch screenshots
- Run interactive checks and accessibility audits
- Fail into the re-implement loop with max 2 retries
- Auto-skip when Mac Mini is unreachable so deployment is not blocked by lab hardware

---

## Current State

- **Setfarm:** v1.5.48, 9-step pipeline (PLAN -> DESIGN -> STORIES -> SETUP -> IMPLEMENT -> VERIFY -> SEC-GATE -> FINAL-TEST -> DEPLOY)
- **Mac Mini:** SSH ready (`ssh mac-mini`), Node 22+25, Tailscale 100.79.94.57, internal IP 192.168.1.199
- **Already on Mac Mini:** LM Studio (models loaded), OwnPilot (5173+8080, separate system; do not touch), PostgreSQL 17, Chrome
- **Missing on Mac Mini:** Playwright, pixelmatch, axe-core, visual-qa station code
- **Hikmet host:** moltclaw, 10 agents, gateway, medic, Mission Control

---

## Phase 1: Mac Mini Environment

### 1.1 Validate SSH Access (Hikmet -> Mac Mini)
```bash
ssh setrox@192.168.1.199 'echo ok'
```

### 1.2 Install Playwright And Dependencies
```bash
ssh mac-mini 'export PATH=/opt/homebrew/bin:/usr/bin:/bin && \
  mkdir -p ~/visual-qa-station && cd ~/visual-qa-station && \
  npm init -y && \
  npm install playwright pixelmatch pngjs sharp @axe-core/playwright serve && \
  npx playwright install chromium'
```

### 1.3 Prevent Display Sleep
```bash
ssh mac-mini 'sudo pmset -a displaysleep 0 && sudo pmset -a sleep 0'
```

### 1.4 Install OpenClaw Gateway On Mac Mini
```bash
ssh mac-mini 'export PATH=/opt/homebrew/bin:/usr/bin:/bin && \
  npm install -g openclaw@latest && \
  openclaw onboard --install-daemon'
```

### 1.5 LM Studio Settings
- Bind: `0.0.0.0` (Settings -> Server -> Bind)
- Port: 1234 (default)
- Unload the model during Visual QA, then reload after cleanup

### 1.6 Mac Mini Gateway Provider (`openclaw.json`)
```json
{
  "providers": {
    "lmstudio": {
      "baseUrl": "http://127.0.0.1:1234/v1",
      "apiKey": "lm-studio",
      "api": "openai-completions"
    }
  }
}
```

### 1.7 Hikmet Gateway Provider For Mac Mini LM Studio
```json
{
  "lmstudio-mac": {
    "baseUrl": "http://192.168.1.199:1234/v1",
    "apiKey": "lm-studio",
    "api": "openai-completions"
  }
}
```

### 1.8 Mac Mini Agent Configuration
- Primary role: Visual QA automation
- Secondary role: light review/coding through a local LM Studio model
- Agent model: `lmstudio/<model>` with `kimi-coding/k2p5` fallback when configured

---

## Phase 2: Visual QA Runner (Mac Mini Side)

### File: `scripts/visual-qa-runner.mjs` -> Mac Mini: `~/visual-qa-station/`

**9 Steps:**
1. SETUP - parse args, create temp directory, unload LM Studio model
2. SERVE - `npx serve <project-dir> -l <port> -s`
3. ROUTE DISCOVERY - parse React Router, Next.js pages, and HTML links
4. SCREENSHOT CAPTURE - headed Chrome with Playwright, 1920x1080, CSS animations disabled
5. STITCH COMPARISON - sharp resize + pixelmatch diff -> mismatch percentage
6. INTERACTIVE TEST - click buttons, test links, collect JavaScript exceptions
7. A11Y AUDIT - @axe-core/playwright, critical/serious/moderate/minor
8. REPORT - JSON + HTML
9. CLEANUP - stop serve, reload LM Studio model

**Stdout:** `VISUAL_QA_SCORE`, `VISUAL_QA_PASS`, `VISUAL_QA_FAILURES`, `VISUAL_QA_A11Y_VIOLATIONS`

**Failure Conditions:** score < 60, blank page, JavaScript exception, critical accessibility violation

---

## Phase 3: Hikmet Orchestrator

### File: `scripts/visual-qa.mjs` (runs on Hikmet)

1. Pre-flight: SSH check (auto-skip on failure), generated screen check
2. Transfer: SCP `dist/`, `stitch/`, and runner script
3. Execute: SSH runner execution with a 5-minute timeout
4. Report Retrieve: SCP report into Mission Control static report storage
5. Parse + Output: status, score, failures
6. Cleanup: remove staging directory

---

## Phase 4: Setfarm Pipeline Integration

### 4.1 `constants.ts`
- Agent mapping: `"feature-dev_visual-qa": "sentinel"`
- Optional template vars: `visual_qa_score`, `visual_qa_pass`, etc.

### 4.2 `step-guardrails.ts` - `processVisualQACompletion()`
- Backend-only projects skip Visual QA
- Mac Mini unreachable projects skip Visual QA
- Score < 60 fails with actionable details

### 4.3 `step-ops.ts` - Guardrail Hook
- Visual QA step completion invokes `processVisualQACompletion()`

### 4.4 `workflow-feature-dev.yml`
- Add `visual-qa: sentinel` to agent mapping
- Insert a new step between final-test and deploy
- `on_fail`: retry `implement`, max retries 2

### 4.5 Version Bump
- Bump Setfarm to the next semver patch.

---

## Phase 5: Mission Control Integration

### 5.1 Backend
- `GET /api/setfarm/runs/:id/visual-qa`

### 5.2 Static Reports
- `/visual-qa-reports`

### 5.3 Frontend API
- `runVisualQA()`

### 5.4 Pipeline View
- VIS-QA tab with score badge, screen cards, and accessibility issue list

### 5.5 Notifications
- `visual-qa.passed`, `visual-qa.failed`, and `visual-qa.skipped` notifications

---

## Phase 6: Monitoring

- Uptime Kuma: Mac Mini ping + SSH check
- Disk cleanup: clear staging after every run

---

## RAM Budget (Mac Mini 16GB)

| Scenario | Total |
|----------|-------|
| Normal with model loaded | ~14GB |
| Visual QA with model unloaded | ~7.5GB |
| Light 7B model + idle services | ~9GB |

---

## Implementation Order

1. Phase 1 - Mac Mini environment
2. Phase 2 - write and test `visual-qa-runner.mjs`
3. Phase 3 - write `visual-qa.mjs` orchestrator
4. Phase 4 - Setfarm pipeline integration
5. Phase 5 - Mission Control integration
6. Phase 6 - monitoring + end-to-end test

---

## Files To Change Or Create (14)

| File | Action |
|------|--------|
| `scripts/visual-qa-runner.mjs` | NEW (setfarm-repo -> Mac Mini) |
| `scripts/visual-qa.mjs` | NEW (setfarm-repo, Hikmet orchestrator) |
| `workflows/feature-dev/workflow.yml` | EDIT |
| `src/installer/constants.ts` | EDIT |
| `src/installer/step-guardrails.ts` | EDIT |
| `src/installer/step-ops.ts` | EDIT |
| MC `server/routes/setfarm-activity.ts` | EDIT |
| MC `server/index.ts` | EDIT |
| MC `src/lib/api.ts` | EDIT |
| MC `src/components/PipelineView.tsx` | EDIT |
| MC `server/routes/discord-notify.ts` | EDIT |
| MC `src/index.css` | EDIT |
| Mac Mini `~/.openclaw/openclaw.json` | EDIT |
| Hikmet `~/.openclaw/openclaw.json` | EDIT |
