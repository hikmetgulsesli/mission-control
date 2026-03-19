# Mac Mini M4 — Visual QA Station (Setfarm v1.5.48+ Entegrasyonu)

## Context

Setfarm pipeline projeleri kodluyor, build ediyor, smoke test yapiyor ama **gercek gorsel kontrol yok**. Smoke test (v3) sadece blank page + JS exception + placeholder bakiyor. Stitch'te tasarlanan UI ile kodlanan UI arasinda pixel-level karsilastirma yapilmiyor.

**Mac Mini M4** (16GB RAM, M4 10-core, 192.168.1.199, ayni ag) bu boslugu dolduracak:
- Pipeline'a **VISUAL-QA** adimi eklenir (FINAL-TEST → VISUAL-QA → DEPLOY = 10 adim)
- Headed Chrome'da gercek render vs Stitch screenshot pixel karsilastirmasi
- Interaktif test + accessibility audit
- Fail → re-implement dongusu (max 2)
- Mac Mini erisilemezse → auto-skip (deploy'u bloklama)

---

## Mevcut Durum

- **Setfarm:** v1.5.48, 9 adimli pipeline (PLAN→DESIGN→STORIES→SETUP→IMPLEMENT→VERIFY→SEC-GATE→FINAL-TEST→DEPLOY)
- **Mac Mini:** SSH hazir (`ssh mac-mini`), Node 22+25, Tailscale 100.79.94.57, iç IP 192.168.1.199
- **Mac Mini'de mevcut:** LM Studio (modeller yuklu), OwnPilot (5173+8080, ayri sistem — dokunulmayacak), PostgreSQL 17, Chrome
- **Mac Mini'de YOK:** Playwright, pixelmatch, axe-core, visual-qa altyapisi
- **Hikmet:** moltclaw, 10 agent, gateway, medic, Mission Control

---

## Faz 1: Mac Mini Ortam Hazirlik

### 1.1 SSH Erisim Dogrulama (Hikmet → Mac Mini)
```bash
ssh setrox@192.168.1.199 'echo ok'
```

### 1.2 Playwright + Bagimliliklar Kurulumu
```bash
ssh mac-mini 'export PATH=/opt/homebrew/bin:/usr/bin:/bin && \
  mkdir -p ~/visual-qa-station && cd ~/visual-qa-station && \
  npm init -y && \
  npm install playwright pixelmatch pngjs sharp @axe-core/playwright serve && \
  npx playwright install chromium'
```

### 1.3 Ekran Kapanma Engelle
```bash
ssh mac-mini 'sudo pmset -a displaysleep 0 && sudo pmset -a sleep 0'
```

### 1.4 OpenClaw Gateway Kurulumu (Mac Mini)
```bash
ssh mac-mini 'export PATH=/opt/homebrew/bin:/usr/bin:/bin && \
  npm install -g openclaw@latest && \
  openclaw onboard --install-daemon'
```

### 1.5 LM Studio Ayarlari
- Bind: `0.0.0.0` (Settings → Server → Bind)
- Port: 1234 (varsayilan)
- Visual QA sirasinda model unload, sonra reload

### 1.6 Mac Mini Gateway Provider (openclaw.json)
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

### 1.7 Hikmet Gateway'e Mac Mini LM Studio Provider
```json
{
  "lmstudio-mac": {
    "baseUrl": "http://192.168.1.199:1234/v1",
    "apiKey": "lm-studio",
    "api": "openai-completions"
  }
}
```

### 1.8 Mac Mini Agent Yapilandirmasi
- Birincil: Visual QA otomasyon
- Ikincil: Hafif review/kodlama (LM Studio lokal model)
- Agent model: `lmstudio/<model>` + fallback `kimi-coding/k2p5`

---

## Faz 2: Visual QA Runner (Mac Mini Tarafi)

### Dosya: `scripts/visual-qa-runner.mjs` → Mac Mini: `~/visual-qa-station/`

**9 Adim:**
1. SETUP — Arguman parse, temp dizin, LM Studio model unload
2. SERVE — `npx serve <project-dir> -l <port> -s`
3. ROUTE DISCOVERY — React Router, Next.js pages, HTML links parse
4. SCREENSHOT CAPTURE — Playwright headed Chrome, 1920x1080, CSS animation disable
5. STITCH KARSILASTIRMA — sharp resize + pixelmatch diff → mismatch %
6. INTERAKTIF TEST — Buton tiklama, link test, JS exception toplama
7. A11Y AUDIT — @axe-core/playwright, Critical/Serious/Moderate/Minor
8. RAPOR — JSON + HTML
9. CLEANUP — serve kapat, LM Studio model reload

**Stdout:** VISUAL_QA_SCORE, VISUAL_QA_PASS, VISUAL_QA_FAILURES, VISUAL_QA_A11Y_VIOLATIONS

**Fail Kosullari:** Skor < 60, blank page, JS exception, critical a11y violation

---

## Faz 3: Hikmet Orchestrator

### Dosya: `scripts/visual-qa.mjs` (Hikmet'te calisir)

1. Pre-flight: SSH check (fail → auto-skip), screens_generated check
2. Transfer: SCP dist/ + stitch/ + runner script
3. Execute: SSH ile runner calistir (5dk timeout)
4. Report Retrieve: SCP report → MC dist-server
5. Parse + Output: STATUS + SCORE + FAILURES
6. Cleanup: rm -rf staging

---

## Faz 4: Setfarm Pipeline Entegrasyonu

### 4.1 constants.ts
- Agent mapping: `"feature-dev_visual-qa": "sentinel"`
- Optional template vars: visual_qa_score, visual_qa_pass, etc.

### 4.2 step-guardrails.ts — processVisualQACompletion()
- Backend-only → skip
- Mac Mini unreachable → skip
- Score < 60 → fail with details

### 4.3 step-ops.ts — Guardrail Hook
- visual-qa step completed → processVisualQACompletion() check

### 4.4 workflow-feature-dev.yml
- agent_mapping'e visual-qa: sentinel
- final-test ile deploy arasi yeni step
- on_fail: retry_step: implement, max_retries: 2

### 4.5 Version Bump → 1.5.49

---

## Faz 5: Mission Control Entegrasyonu

### 5.1 Backend: GET /api/setfarm/runs/:id/visual-qa
### 5.2 Static: /visual-qa-reports
### 5.3 Frontend API: runVisualQA()
### 5.4 PipelineView: VIS-QA Tab (skor badge, screen kartlari, a11y listesi)
### 5.5 Discord: visual-qa.passed/failed/skipped bildirimleri

---

## Faz 6: Monitoring
- Uptime Kuma: Mac Mini ping + SSH check
- Disk cleanup: her run sonrasi staging temizligi

---

## RAM Butcesi (Mac Mini 16GB)

| Senaryo | Toplam |
|---------|--------|
| Normal (model yuklu) | ~14GB |
| Visual QA (model unload) | ~7.5GB |
| Hafif model (7B) + idle | ~9GB |

---

## Uygulama Sirasi

1. Faz 1 — Mac Mini ortam hazirlik
2. Faz 2 — visual-qa-runner.mjs yazimi + test
3. Faz 3 — visual-qa.mjs orchestrator
4. Faz 4 — Setfarm pipeline entegrasyonu
5. Faz 5 — Mission Control
6. Faz 6 — Monitoring + e2e test

---

## Degistirilecek/Olusturulacak Dosyalar (14)

| Dosya | Islem |
|-------|-------|
| `scripts/visual-qa-runner.mjs` | YENI (setfarm-repo → Mac Mini) |
| `scripts/visual-qa.mjs` | YENI (setfarm-repo, Hikmet orchestrator) |
| `workflows/feature-dev/workflow.yml` | DUZENLE |
| `src/installer/constants.ts` | DUZENLE |
| `src/installer/step-guardrails.ts` | DUZENLE |
| `src/installer/step-ops.ts` | DUZENLE |
| MC `server/routes/setfarm-activity.ts` | DUZENLE |
| MC `server/index.ts` | DUZENLE |
| MC `src/lib/api.ts` | DUZENLE |
| MC `src/components/PipelineView.tsx` | DUZENLE |
| MC `server/routes/discord-notify.ts` | DUZENLE |
| MC `src/index.css` | DUZENLE |
| Mac Mini `~/.openclaw/openclaw.json` | DUZENLE |
| Hikmet `~/.openclaw/openclaw.json` | DUZENLE |
