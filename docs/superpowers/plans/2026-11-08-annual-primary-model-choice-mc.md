# Annual primary model choice MC implementation plan

**Goal:** Allow Mission Control's existing fixed worker path to consume the paired Setfarm Kimi-primary recipe.
**Paired spec/plan:** Setfarm docs/superpowers/plans/2026-11-08-annual-primary-model-choice.md; SF is frozen and remains unchanged here.
**File Map:** server/services/control-jobs.ts (closed recipe type/validator only), server/services/control-jobs.test.ts (actual validator + existing selected-worker environment fixture), this plan.
**Constraints:** Existing Codex and MiniMax recipe bytes/keys retain semantics. Kimi must match exact fixed suite, provider/model primary identity and exactly subscription runtime plus SETFARM_SUBSCRIPTION_PRIMARY_MODEL=kimi/k3.1-pro. Mixed/unknown keys refuse. Keep existing Object.assign worker propagation, APIs/UI/budgets/credentials unchanged. No Source delivery, build, DB, services or model effects in this author role. Preserve old untracked .superpowers history.

- [x] Add direct validator acceptance/refusal and real selected-worker env propagation regressions; capture genuine RED on base67 behavior.
- [x] Extend only the closed type and exact Kimi validator branch; capture GREEN on the focused existing test file.
- [x] Run server TypeScript noEmit and diff checks. Freeze exact files/hashes and return captures to Root for independent review/delivery/clean build.

**Validation capture:** Private0600 original PID/argv/start/exit/raw streams under SF evidence prefix root-annual-primary-choice-mc-*; tests may use their existing temporary filesystem fixtures, never a DB/test installation.

**Verified:** RED original66723 exit1 reproduces exact Kimi rejection on unchanged67 validator; GREEN original67558 exit0 (76/76 outer tests, nested23/23 full8 tests); server noEmit67557 exit0. No build run in this author role per Root instruction; Root owns clean build/delivery.
