#!/usr/bin/env python3
"""Patch mission-control files to add stuck recovery feature - additive only."""
import os

MC = os.path.expanduser("~/mission-control")

# 1. Patch api.ts - add stuck methods before closing };
api_path = os.path.join(MC, "src/lib/api.ts")
with open(api_path, "r") as f:
    content = f.read()

stuck_api = """  // Stuck Recovery
  stuckRuns: () => fetchApi<any>("/api/runs/stuck"),
  unstickRun: (id: string, stepId?: string) =>
    fetchApi<any>(`/api/runs/${id}/unstick`, {
      method: "POST",
      headers: CT_JSON,
      body: JSON.stringify({ stepId }),
    }),
};
"""

if "stuckRuns" not in content:
    # Replace the last }; with stuck methods + };
    idx = content.rfind("};")
    if idx != -1:
        content = content[:idx] + stuck_api
        with open(api_path, "w") as f:
            f.write(content)
        print("api.ts patched")
    else:
        print("api.ts: could not find closing };")
else:
    print("api.ts: already patched")

# 2. Patch runs.ts - add stuck endpoints before export default
runs_path = os.path.join(MC, "server/routes/runs.ts")
with open(runs_path, "r") as f:
    content = f.read()

stuck_routes = """
import { getStuckRuns, unstickRun, getRunDetail } from '../utils/antfarm-db.js';
"""

stuck_endpoints = """
router.get('/runs/stuck', async (_req, res) => {
  try {
    const runs = await getStuckRuns();
    res.json({ runs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/runs/:id/detail', async (req, res) => {
  try {
    const detail = await getRunDetail(req.params.id);
    if (!detail) { res.status(404).json({ error: 'Run not found' }); return; }
    res.json(detail);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/runs/:id/unstick', async (req, res) => {
  try {
    const result = await unstickRun(req.params.id, req.body?.stepId);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
"""

if "stuckRuns" not in content and "unstick" not in content:
    # Add import after existing imports
    import_line = "import { runCli } from '../utils/cli.js';"
    if import_line in content:
        content = content.replace(import_line, import_line + stuck_routes.rstrip())

    # Replace export default with stuck endpoints + export default
    content = content.replace("export default router;", stuck_endpoints.lstrip())

    with open(runs_path, "w") as f:
        f.write(content)
    print("runs.ts patched")
else:
    print("runs.ts: already patched")

# 3. Patch server/index.ts - add medic cron at the end
index_path = os.path.join(MC, "server/index.ts")
with open(index_path, "r") as f:
    content = f.read()

if "antfarm-db" not in content:
    # Add import
    content = content.replace(
        "import { setupWsProxy } from './ws-proxy.js';",
        "import { setupWsProxy } from './ws-proxy.js';\nimport { getStuckRuns, unstickRun, STUCK_THRESHOLD_MS, MAX_AUTO_UNSTICK } from './utils/antfarm-db.js';"
    )

    # Add medic cron at end
    medic_cron = """
// Medic cron: auto-unstick steps stuck longer than threshold
const MEDIC_INTERVAL_MS = 5 * 60 * 1000;
setInterval(async () => {
  try {
    const stuckRuns = await getStuckRuns(STUCK_THRESHOLD_MS);
    for (const run of stuckRuns) {
      for (const step of run.stuckSteps) {
        if (step.abandonResets >= MAX_AUTO_UNSTICK) {
          console.warn(`[MEDIC] Skip auto-unstick: ${run.id} step=${step.name} (resets=${step.abandonResets}/${MAX_AUTO_UNSTICK})`);
          continue;
        }
        console.warn(`[MEDIC] Auto-unstick: run=${run.id} step=${step.name} stuck=${step.stuckMinutes}min`);
        await unstickRun(run.id, step.id);
      }
    }
  } catch (err: any) {
    console.error('[MEDIC] Stuck check failed:', err.message);
  }
}, MEDIC_INTERVAL_MS);
"""
    content = content.rstrip() + "\n" + medic_cron

    with open(index_path, "w") as f:
        f.write(content)
    print("index.ts patched")
else:
    print("index.ts: already patched")

# 4. Patch Ops.tsx - add stuck banner
ops_path = os.path.join(MC, "src/pages/Ops.tsx")
with open(ops_path, "r") as f:
    content = f.read()

if "stuckRuns" not in content:
    # Add stuck interfaces after imports
    interfaces = """
interface StuckStep {
  id: string;
  name: string;
  stuckMinutes: number;
  abandonResets: number;
}

interface StuckRun {
  id: string;
  workflowId: string;
  stuckSteps: StuckStep[];
}
"""
    content = content.replace(
        "export function Ops() {",
        interfaces + "\nexport function Ops() {"
    )

    # Add stuck polling
    content = content.replace(
        "const [toggleError, setToggleError] = useState<string | null>(null);",
        """const { data: stuckData, refresh: refreshStuck } = usePolling<{ runs: StuckRun[] }>(api.stuckRuns, 30000);

  const [toggleError, setToggleError] = useState<string | null>(null);
  const [unstickMsg, setUnstickMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [unsticking, setUnsticking] = useState<string | null>(null);"""
    )

    # Add handleUnstick after handleToggle
    unstick_handler = """
  const handleUnstick = async (runId: string, stepId?: string) => {
    setUnsticking(runId);
    setUnstickMsg(null);
    try {
      const res = await api.unstickRun(runId, stepId);
      if (res.success) {
        const names = res.unstuckedSteps.map((s: any) => s.name).join(', ');
        setUnstickMsg({ type: 'ok', text: `Unstuck: ${names}` });
      } else {
        setUnstickMsg({ type: 'err', text: res.message || 'No stuck steps found' });
      }
      refreshStuck();
    } catch (err: any) {
      setUnstickMsg({ type: 'err', text: err.message });
    } finally {
      setUnsticking(null);
    }
  };

  const stuckRuns = stuckData?.runs || [];
"""

    content = content.replace(
        "  return (",
        unstick_handler + "\n  return ("
    )

    # Add stuck banner after GlitchText
    banner = """
      {stuckRuns.length > 0 && (
        <div className="stuck-banner">
          <div className="stuck-banner__title">[!] Stuck Runs Detected</div>
          {stuckRuns.map((run) =>
            run.stuckSteps.map((step) => (
              <div key={`${run.id}-${step.id}`} className="stuck-banner__item">
                <div className="stuck-banner__info">
                  <span className="stuck-banner__run-id">{run.id.slice(0, 8)}</span>
                  <span className="stuck-banner__step">step: {step.name}</span>
                  <span className="stuck-banner__time">{step.stuckMinutes}min</span>
                </div>
                <button
                  className="stuck-banner__btn"
                  disabled={unsticking === run.id}
                  onClick={() => handleUnstick(run.id, step.id)}
                >
                  {unsticking === run.id ? 'UNSTICKING...' : 'UNSTICK'}
                </button>
              </div>
            ))
          )}
          {unstickMsg && (
            <div className={`stuck-banner__msg stuck-banner__msg--${unstickMsg.type}`}>
              {unstickMsg.text}
            </div>
          )}
        </div>
      )}
"""

    content = content.replace(
        '<GlitchText text="OPERATIONS" tag="h2" />',
        '<GlitchText text="OPERATIONS" tag="h2" />\n' + banner
    )

    with open(ops_path, "w") as f:
        f.write(content)
    print("Ops.tsx patched")
else:
    print("Ops.tsx: already patched")

# 5. Patch index.css - append stuck banner styles
css_path = os.path.join(MC, "src/index.css")
with open(css_path, "r") as f:
    content = f.read()

if "stuck-banner" not in content:
    stuck_css = """
/* ── Stuck Banner ── */
.stuck-banner {
  background: rgba(255, 102, 0, 0.1);
  border: 1px solid var(--neon-orange);
  border-radius: 6px;
  padding: 10px 14px;
  margin-bottom: 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.stuck-banner__title {
  color: var(--neon-orange);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.stuck-banner__item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: var(--bg-primary);
  border-radius: 4px;
  border-left: 3px solid var(--neon-orange);
  font-size: 11px;
}
.stuck-banner__info { display: flex; gap: 12px; align-items: center; }
.stuck-banner__run-id { font-weight: 600; color: var(--neon-cyan); }
.stuck-banner__step { color: var(--text-dim); }
.stuck-banner__time { color: var(--neon-orange); }
.stuck-banner__btn {
  background: var(--neon-orange);
  color: var(--bg-primary);
  border: none; border-radius: 3px;
  padding: 4px 10px;
  font-family: var(--font);
  font-size: 10px; font-weight: 700;
  text-transform: uppercase;
  cursor: pointer;
}
.stuck-banner__btn:hover { filter: brightness(1.2); }
.stuck-banner__btn:disabled { opacity: 0.5; cursor: default; }
.stuck-banner__msg { font-size: 10px; padding: 4px 0; }
.stuck-banner__msg--ok { color: var(--neon-green); }
.stuck-banner__msg--err { color: var(--neon-red); }
"""
    with open(css_path, "a") as f:
        f.write(stuck_css)
    print("index.css patched")
else:
    print("index.css: already patched")

print("\nDone! All patches applied.")
