import { Router } from 'express';
import { createPrd, getPrd, listPrds, updatePrd, deletePrd, listTemplates, getTemplate } from '../services/prd-db.js';
import { scorePrd, estimateCost, checkScreenCoverage } from '../services/prd-scoring.js';
import { generatePrd, enhancePrd, generateChatQuestions, generateAbComparison, analyzeSite, analyzeScreenshot } from '../services/prd-llm.js';
import { generateMockupsFromPrd, deleteScreenFromCache, regenerateScreen, generateScreen, downloadScreen, prepareDesignFilesForRepo, createStitchProject, extractScreenPrompts } from '../services/stitch-integration.js';
import { mapComponentsFromPrd, generateComponentSection } from '../services/component-mapper.js';
import { getRunBenchmark, analyzePrdFormats } from '../services/benchmark.js';
import { homedir } from 'os';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const router = Router();

// POST /prd/analyze — URL veya screenshot analiz et
router.post('/prd/analyze', async (req, res) => {
  try {
    const { url, screenshot, filename } = req.body;

    if (screenshot) {
      const analysis = await analyzeScreenshot(screenshot, filename || 'screenshot.png');
      res.json({ analysis });
      return;
    }

    if (!url) {
      res.status(400).json({ error: 'url or screenshot required' });
      return;
    }

    // Platform auto-detect
    let platform = 'web';
    if (/apps\.apple\.com|play\.google\.com|itunes\.apple\.com/.test(url)) {
      platform = 'mobile';
    }

    // Fetch and analyze site
    let html = '';
    try {
      const fetchRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MCBot/1.0)' },
        signal: AbortSignal.timeout(15000),
      });
      html = await fetchRes.text();
    } catch (fetchErr: any) {
      res.status(502).json({ error: `Site fetch failed: ${fetchErr.message}` });
      return;
    }

    const analysis = await analyzeSite(html, url);
    res.json({ analysis, platform, url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/research — Web arastirmasi
router.post('/prd/research', async (req, res) => {
  try {
    const { query: searchQuery, topic } = req.body;
    if (!searchQuery && !topic) {
      res.status(400).json({ error: 'query or topic required' });
      return;
    }

    const finalQuery = searchQuery || `${topic} best practices UX design patterns`;
    const apiKey = process.env.MINIMAX_API_KEY || process.env.LLM_API_KEY || '';

    const llmRes = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-M2.7',
        messages: [
          {
            role: 'system',
            content: 'Sen bir web arastirma uzmanisin. Verilen konu hakkinda best practice, UX pattern, sektor standartlari ve ornek projeler hakkinda detayli arastirma yap. JSON formatinda dondur: { "bestPractices": [], "uxPatterns": [], "competitors": [], "recommendations": [] }',
          },
          { role: 'user', content: `Arastir: ${finalQuery}` },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (llmRes.ok) {
      const data = await llmRes.json() as any;
      const content = data.choices?.[0]?.message?.content || '{}';
      try {
        const parsed = JSON.parse(content.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        res.json({ research: parsed, query: finalQuery });
      } catch {
        res.json({ research: { raw: content }, query: finalQuery });
      }
    } else {
      res.json({ research: { note: 'LLM research unavailable' }, query: finalQuery });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/chat — Chat Q&A
router.post('/prd/chat', async (req, res) => {
  try {
    const { prdId, message, context } = req.body;

    let prd = prdId ? await getPrd(prdId) : null;
    const chatHistory = prd?.chat_history || context?.chatHistory || [];

    if (message) {
      chatHistory.push({ role: 'user', content: message });
    }

    const response = await generateChatQuestions({
      title: prd?.title || context?.title,
      platform: prd?.platform || context?.platform,
      description: prd?.description || context?.description,
      urls: prd?.urls || context?.urls,
      analysis: prd?.analysis || context?.analysis,
      chatHistory,
    });

    chatHistory.push({ role: 'assistant', content: response });

    if (prd) {
      await updatePrd(prd.id, { chat_history: chatHistory });
    }

    res.json({ response, chatHistory });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/generate — PRD olustur
router.post('/prd/generate', async (req, res) => {
  try {
    const { prdId, title, platform, description, analysis, research, chatHistory, templateId, urls } = req.body;

    if (!title && !prdId) {
      res.status(400).json({ error: 'title or prdId required' });
      return;
    }

    let prd = prdId ? await getPrd(prdId) : null;

    let templateContent = '';
    if (templateId) {
      const tpl = await getTemplate(templateId);
      if (tpl?.prd_content) templateContent = tpl.prd_content;
    }

    let prdContent = await generatePrd({
      title: prd?.title || title,
      platform: prd?.platform || platform || 'web',
      description: prd?.description || description,
      analysis: prd?.analysis || analysis,
      research: prd?.research || research,
      chatHistory: prd?.chat_history || chatHistory,
      templateContent,
    });

    // Komponent kutuphanesi eslestirmesi ekle (Feature 9)
    const componentMappings = mapComponentsFromPrd(prdContent);
    if (componentMappings.length > 0) {
      prdContent += generateComponentSection(componentMappings);
    }

    const scoreResult = scorePrd(prdContent);
    const costResult = estimateCost(prdContent);

    if (!prd) {
      prd = await createPrd({
        title,
        platform: platform || 'web',
        urls: urls || [],
        description,
        template_id: templateId,
      });
    }

    await updatePrd(prd.id, {
      prd_content: prdContent,
      prd_version: (prd.prd_version || 0) + 1,
      score: scoreResult.total,
      score_details: scoreResult,
      cost_estimate: costResult,
      analysis: analysis || prd.analysis,
      research: research || prd.research,
    });

    const updated = await getPrd(prd.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/enhance — PRD'yi gelistir
router.post('/prd/enhance', async (req, res) => {
  try {
    const { prdId } = req.body;
    if (!prdId) { res.status(400).json({ error: 'prdId required' }); return; }

    const prd = await getPrd(prdId);
    if (!prd?.prd_content) { res.status(404).json({ error: 'PRD not found or empty' }); return; }

    const enhanced = await enhancePrd(prd.prd_content, prd.prd_version);
    const scoreResult = scorePrd(enhanced);
    const costResult = estimateCost(enhanced);

    await updatePrd(prdId, {
      prd_content: enhanced,
      prd_version: prd.prd_version + 1,
      score: scoreResult.total,
      score_details: scoreResult,
      cost_estimate: costResult,
    });

    const updated = await getPrd(prdId);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/score — PRD puanla
router.post('/prd/score', async (req, res) => {
  try {
    const { content, prdId } = req.body;
    const prdContent = content || (prdId ? (await getPrd(prdId))?.prd_content : null);
    if (!prdContent) { res.status(400).json({ error: 'content or prdId required' }); return; }

    const score = scorePrd(prdContent);
    const cost = estimateCost(prdContent);

    if (prdId) {
      await updatePrd(prdId, { score: score.total, score_details: score, cost_estimate: cost });
    }

    res.json({ score, cost });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/mockups — Stitch API ile mockup uret (gercek)
router.post('/prd/mockups', async (req, res) => {
  try {
    const { prdId, prdContent, title } = req.body;
    const prd = prdId ? await getPrd(prdId) : null;
    const content = prdContent || prd?.prd_content;
    const prdTitle = title || prd?.title || 'Untitled';
    const platform = prd?.platform || 'web';

    if (!content) { res.status(400).json({ error: 'prdContent or prdId required' }); return; }

    // Gercek Stitch API ile mockup uret
    const result = await generateMockupsFromPrd(content, prdTitle, platform);

    const screens = result.screens.map(s => ({
      id: s.screenId,
      name: s.title,
      status: s.status,
      screenshotUrl: s.screenshotUrl,
      htmlUrl: s.htmlUrl,
      localHtml: s.localHtml,
      width: s.width,
      height: s.height,
      prompt: s.prompt,
      projectId: result.projectId,
      parentScreenId: s.parentScreenId,
    }));

    if (prdId) {
      await updatePrd(prdId, { mockup_screens: screens });
    }

    res.json({ screens, projectId: result.projectId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
// GET /prd/mockups/stream — SSE streaming mockup uretimi
router.get("/prd/mockups/stream", async (req, res) => {
  const { prdId, prdContent: rawContent, title: rawTitle, skipCount: rawSkip, projectId: existingProjectId } = req.query as any;
  const prd = prdId ? await getPrd(prdId) : null;
  const content = rawContent || prd?.prd_content;
  const prdTitle = rawTitle || prd?.title || "Untitled";
  const platform = prd?.platform || "web";
  const skipCount = parseInt(rawSkip || "0", 10);

  if (!content) { res.status(400).json({ error: "prdContent or prdId required" }); return; }

  // Disable socket timeout for long-running SSE
  req.socket.setTimeout(0);
  req.socket.setNoDelay(true);
  req.socket.setKeepAlive(true);

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const send = (event: string, data: any) => {
    res.write("event: " + event + "\n");
    res.write("data: " + JSON.stringify(data) + "\n\n");
  };

  // Keepalive ping every 15s to prevent connection timeout
    const keepalive = setInterval(() => { try { res.write(": ping\n\n"); } catch { clearInterval(keepalive); } }, 15000);

  try {
    const projectId = existingProjectId || await createStitchProject("PRD: " + prdTitle);
    if (!projectId) { clearInterval(keepalive); send("error", { message: "Failed to create Stitch project" }); res.end(); return; }

    const allPrompts = extractScreenPrompts(content, platform);
    const prompts = skipCount > 0 ? allPrompts.slice(skipCount) : allPrompts;
    const totalAll = allPrompts.length;
    send("start", { projectId, total: totalAll, remaining: prompts.length, resumed: skipCount > 0 });

    const allScreens: any[] = [];
    const cacheDir = join(homedir(), ".openclaw", "setfarm", "stitch-cache", projectId);
    mkdirSync(cacheDir, { recursive: true });

    for (let i = 0; i < prompts.length; i++) {
      const sp = prompts[i];
      const globalIndex = skipCount + i;
      send("progress", { index: globalIndex, total: totalAll, title: sp.title, status: "generating" });

      const screen = await generateScreen(projectId, sp.prompt, sp.title, sp.device);
      if (screen) {
        screen.prompt = sp.prompt;
        if (screen.screenId && screen.status === "done") {
          try {
            const dl = await downloadScreen(projectId, screen.screenId, cacheDir);
            if (dl) {
              screen.localHtml = dl.htmlPath;
              // Use local URLs for full-quality screenshots + HTML
              screen.screenshotUrl = `/stitch-cache/${projectId}/${screen.screenId}.png`;
              screen.htmlUrl = `/stitch-cache/${projectId}/${screen.screenId}.html`;
            }
          } catch { /* ok */ }
        }
        const entry = {
          id: screen.screenId, name: screen.title, status: screen.status,
          screenshotUrl: screen.screenshotUrl, htmlUrl: screen.htmlUrl,
          localHtml: screen.localHtml, width: screen.width, height: screen.height,
          prompt: sp.prompt, projectId,
        };
        allScreens.push(entry);
        send("screen", { index: globalIndex, total: totalAll, screen: entry });
        // Save incrementally — DB always has latest screens even if connection drops
        if (prdId) {
          const existingPrd = await getPrd(prdId);
          const existingScreens = existingPrd?.mockup_screens || [];
          // Merge: keep existing (from previous sessions) + add new
          const merged = [...existingScreens.filter((s: any) => !allScreens.some((n: any) => n.id === s.id)), ...allScreens];
          await updatePrd(prdId, { mockup_screens: merged });
        }
      }
      if (i < prompts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    // Final save with merged screens
    if (prdId) {
      const existingPrd = await getPrd(prdId);
      const existingScreens = existingPrd?.mockup_screens || [];
      const merged = [...existingScreens.filter((s: any) => !allScreens.some((n: any) => n.id === s.id)), ...allScreens];
      await updatePrd(prdId, { mockup_screens: merged });
    }
    send("done", { projectId, screens: allScreens, total: allScreens.length });
    clearInterval(keepalive);
  } catch (err: any) {
    send("error", { message: err.message });
  }
  clearInterval(keepalive);
  res.end();
});

// DELETE /prd/screens/:prdId/:screenId — Ekrani sil
router.delete('/prd/screens/:prdId/:screenId', async (req, res) => {
  try {
    const { prdId, screenId } = req.params;
    const prd = await getPrd(prdId);
    if (!prd) { res.status(404).json({ error: 'PRD not found' }); return; }

    const screens = prd.mockup_screens || [];
    const filtered = screens.filter((s: any) => s.id !== screenId);
    if (filtered.length === screens.length) { res.status(404).json({ error: 'Screen not found' }); return; }

    // Delete from cache if we have projectId
    const projectId = screens.find((s: any) => s.id === screenId)?.projectId || '';
    if (projectId) {
      await deleteScreenFromCache(projectId, screenId);
    }

    await updatePrd(prdId, { mockup_screens: filtered });
    res.json({ success: true, screens: filtered });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/screens/:prdId/:screenId/regenerate — Ekrani yeniden uret
router.post('/prd/screens/:prdId/:screenId/regenerate', async (req, res) => {
  try {
    const { prdId, screenId } = req.params;
    const { prompt: newPrompt } = req.body;
    const prd = await getPrd(prdId);
    if (!prd) { res.status(404).json({ error: 'PRD not found' }); return; }

    const screens = prd.mockup_screens || [];
    const screenIndex = screens.findIndex((s: any) => s.id === screenId);
    if (screenIndex === -1) { res.status(404).json({ error: 'Screen not found' }); return; }

    const oldScreen = screens[screenIndex];
    const prompt = newPrompt || oldScreen.prompt || `Create a screen for: ${oldScreen.name}`;
    const projectId = oldScreen.projectId || '';
    const device = prd.platform === 'mobile' ? 'MOBILE' : 'DESKTOP';

    if (!projectId) { res.status(400).json({ error: 'No Stitch projectId' }); return; }

    const newScreen = await regenerateScreen(projectId, screenId, prompt, oldScreen.name, device);
    if (!newScreen) { res.status(500).json({ error: 'Screen regeneration failed' }); return; }

    screens[screenIndex] = {
      id: newScreen.screenId,
      name: newScreen.title,
      status: newScreen.status,
      screenshotUrl: newScreen.screenshotUrl,
      htmlUrl: newScreen.htmlUrl,
      localHtml: newScreen.localHtml,
      width: newScreen.width,
      height: newScreen.height,
      prompt,
      projectId,
    };

    await updatePrd(prdId, { mockup_screens: screens });
    res.json({ success: true, screen: screens[screenIndex], screens });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/screens/:prdId/variant — Mevcut ekranin varyantini uret
router.post('/prd/screens/:prdId/variant', async (req, res) => {
  try {
    const { prdId } = req.params;
    const { sourceScreenId, prompt: variantPrompt } = req.body;
    const prd = await getPrd(prdId);
    if (!prd) { res.status(404).json({ error: 'PRD not found' }); return; }

    const screens = prd.mockup_screens || [];
    const sourceScreen = screens.find((s: any) => s.id === sourceScreenId);
    if (!sourceScreen) { res.status(404).json({ error: 'Source screen not found' }); return; }

    const projectId = sourceScreen.projectId || '';
    if (!projectId) { res.status(400).json({ error: 'No Stitch projectId' }); return; }

    const prompt = variantPrompt || sourceScreen.prompt || `Create a variant of: ${sourceScreen.name}`;
    const device = prd.platform === 'mobile' ? 'MOBILE' : 'DESKTOP';
    const title = `${sourceScreen.name} (Variant)`;

    const newScreen = await generateScreen(projectId, prompt, title, device);
    if (!newScreen) { res.status(500).json({ error: 'Variant generation failed' }); return; }

    // Download to cache
    const cacheDir = join(homedir(), '.openclaw', 'setfarm', 'stitch-cache', projectId);
    mkdirSync(cacheDir, { recursive: true });
    if (newScreen.screenId && newScreen.status === 'done') {
      try {
        const downloaded = await downloadScreen(projectId, newScreen.screenId, cacheDir);
        if (downloaded) newScreen.localHtml = downloaded.htmlPath;
      } catch { /* continue */ }
    }

    const variantEntry = {
      id: newScreen.screenId,
      name: title,
      status: newScreen.status,
      screenshotUrl: newScreen.screenshotUrl,
      htmlUrl: newScreen.htmlUrl,
      localHtml: newScreen.localHtml,
      width: newScreen.width,
      height: newScreen.height,
      prompt,
      projectId,
      parentScreenId: sourceScreenId,
    };

    // Insert variant after source screen
    const sourceIndex = screens.findIndex((s: any) => s.id === sourceScreenId);
    screens.splice(sourceIndex + 1, 0, variantEntry);

    await updatePrd(prdId, { mockup_screens: screens });
    res.json({ success: true, screen: variantEntry, screens });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/screen-coverage — PRD bolumleri vs ekranlar kapsam kontrolu
router.post('/prd/screen-coverage', async (req, res) => {
  try {
    const { prdContent, screens } = req.body;
    if (!prdContent || !screens) { res.status(400).json({ error: 'prdContent and screens required' }); return; }

    const coverage = checkScreenCoverage(
      prdContent,
      screens.map((s: any) => ({ title: s.name || s.title, id: s.id })),
    );
    res.json(coverage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/compare — A/B PRD olustur
router.post('/prd/compare', async (req, res) => {
  try {
    const { prdId } = req.body;
    if (!prdId) { res.status(400).json({ error: 'prdId required' }); return; }

    const prd = await getPrd(prdId);
    if (!prd?.prd_content) { res.status(404).json({ error: 'PRD not found or empty' }); return; }

    const { prdA, prdB } = await generateAbComparison(prd.prd_content, prd.title);

    const scoreA = scorePrd(prdA);
    const scoreB = scorePrd(prdB);
    const costA = estimateCost(prdA);
    const costB = estimateCost(prdB);

    res.json({
      prdA: { content: prdA, score: scoreA, cost: costA },
      prdB: { content: prdB, score: scoreB, cost: costB },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/estimate — Maliyet/sure tahmin et
router.post('/prd/estimate', async (req, res) => {
  try {
    const { content, prdId } = req.body;
    const prdContent = content || (prdId ? (await getPrd(prdId))?.prd_content : null);
    if (!prdContent) { res.status(400).json({ error: 'content or prdId required' }); return; }

    const estimate = estimateCost(prdContent);
    res.json(estimate);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/start-run — Pipeline'a gonder (design dosyalari ile)
router.post('/prd/start-run', async (req, res) => {
  try {
    const { prdId, projectName, workflow } = req.body;
    if (!prdId) { res.status(400).json({ error: 'prdId required' }); return; }

    const prd = await getPrd(prdId);
    if (!prd?.prd_content) { res.status(404).json({ error: 'PRD not found or empty' }); return; }

    const wf = workflow || 'feature-dev';
    const name = projectName || prd.title;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // 1. Create project directory
    const projectsDir = join(homedir(), 'projects');
    const repoPath = join(projectsDir, slug);
    if (!existsSync(projectsDir)) mkdirSync(projectsDir, { recursive: true });

    const { execFile: execCb } = await import('child_process');
    const { promisify } = await import('util');
    const execFileAsync = promisify(execCb);

    if (!existsSync(repoPath)) {
      mkdirSync(repoPath, { recursive: true });
      await execFileAsync('git', ['init'], { cwd: repoPath });
    }

    // 2. Pre-populate design files if mockups exist
    const screens = prd.mockup_screens || [];
    let stitchProjectId = '';
    let screenMapStr = '';

    if (screens.length > 0) {
      const firstScreen = screens[0];
      stitchProjectId = firstScreen.projectId || '';

      if (stitchProjectId) {
        try {
          const { screenMap } = await prepareDesignFilesForRepo(
            stitchProjectId,
            screens.map((s: any) => ({
              screenId: s.id,
              title: s.name,
              htmlUrl: s.htmlUrl,
              screenshotUrl: s.screenshotUrl,
              localHtml: s.localHtml,
              width: s.width,
              height: s.height,
              status: s.status || 'done',
            })),
            repoPath,
          );
          screenMapStr = JSON.stringify(screenMap);
        } catch (err: any) {
          console.warn('[PRD] prepareDesignFilesForRepo failed:', err.message);
        }
      }
    }

    // 3. Build task string with full PRD + design metadata
    let task = `Proje: ${name}\nPlatform: ${prd.platform}\nRepo: ${repoPath}`;
    if (stitchProjectId) task += `\nSTITCH_PROJECT_ID: ${stitchProjectId}`;
    if (screenMapStr) task += `\nSCREEN_MAP: ${screenMapStr}`;
    task += `\n\n${prd.prd_content}`;

    // 4. Start workflow via setfarm
    const { runCli } = await import('../utils/cli.js');
    const out = await runCli('setfarm', ['workflow', 'run', wf, task]);

    // Extract run ID from output
    // Parse run ID — UUID format (8-4-4-4-12)
    const runIdMatch = out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    const runId = runIdMatch?.[1] || null;

    if (runId) {
      await updatePrd(prdId, { run_id: runId });
    }

    res.json({ success: true, runId, output: out, repoPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/history — Gecmis PRD'ler
router.get('/prd/history', async (_req, res) => {
  try {
    const prds = await listPrds(50);
    res.json(prds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/history/:id — Tek PRD detay
router.get('/prd/history/:id', async (req, res) => {
  try {
    const prd = await getPrd(req.params.id);
    if (!prd) { res.status(404).json({ error: 'PRD not found' }); return; }
    res.json(prd);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /prd/history/:id — PRD sil
router.delete('/prd/history/:id', async (req, res) => {
  try {
    const success = await deletePrd(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/templates — Hazir sablonlar
router.get('/prd/templates', async (_req, res) => {
  try {
    const templates = await listTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/benchmark/:runId — Deploy sonrasi karsilastirma (gercek setfarm DB)
router.get('/prd/benchmark/:runId', async (req, res) => {
  try {
    // PRD bul
    const prds = await listPrds(100);
    const prd = prds.find(p => p.run_id === req.params.runId);

    // Gercek run benchmark verisini setfarm DB'den al
    const runBenchmark = await getRunBenchmark(req.params.runId);
    if (!runBenchmark && !prd) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const prdScore = prd?.score || 0;
    const estimate = prd?.cost_estimate || {};

    // Basari analizi
    const successRate = runBenchmark
      ? Math.round((runBenchmark.completedStories / Math.max(1, runBenchmark.totalStories)) * 100)
      : 0;

    res.json({
      prdId: prd?.id || null,
      prdScore,
      estimate,
      runId: req.params.runId,
      run: runBenchmark,
      benchmark: {
        prdQuality: prdScore >= 70 ? 'good' : prdScore >= 50 ? 'fair' : 'poor',
        runStatus: runBenchmark?.status || 'unknown',
        storySuccessRate: successRate,
        totalDurationMin: runBenchmark?.totalDurationMin || 0,
        abandonCount: runBenchmark?.abandonCount || 0,
        retryCount: runBenchmark?.retryCount || 0,
        errorCategories: runBenchmark?.errorCategories || {},
        recommendation: getRecommendation(prdScore, runBenchmark),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/analytics — Tum runlardan PRD format analizi
router.get('/prd/analytics', async (_req, res) => {
  try {
    const analysis = await analyzePrdFormats();
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/components — PRD'den komponent eslestirmesi
router.post('/prd/components', async (req, res) => {
  try {
    const { content, prdId } = req.body;
    const prdContent = content || (prdId ? (await getPrd(prdId))?.prd_content : null);
    if (!prdContent) { res.status(400).json({ error: 'content or prdId required' }); return; }

    const mappings = mapComponentsFromPrd(prdContent);
    const markdownSection = generateComponentSection(mappings);

    res.json({ mappings, markdownSection });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

function getRecommendation(prdScore: number, run: any): string {
  if (!run) return 'Run verisi bulunamadi';

  const errors = run.errorCategories || {};
  const topError = Object.entries(errors).sort((a: any, b: any) => b[1] - a[1])[0];

  if (run.status === 'completed' || run.status === 'done') {
    if (run.retryCount > run.totalStories) {
      return 'Basarili ama cok fazla retry — PRD daha spesifik olmali';
    }
    return 'Basarili tamamlandi';
  }

  if (topError) {
    const [category] = topError;
    switch (category) {
      case 'timeout': return 'Agent timeout orani yuksek — PRD daha kisa ve odakli olmali, story basina is yukunü azaltin';
      case 'lint_error': return 'Lint hatalari fazla — PRD icinde ESLint kurallarini ve code style\'i belirtin';
      case 'build_error': return 'Build hatalari — PRD dependency listesi ve build setup talimatlarini detayli verin';
      case 'test_failure': return 'Test basarisizliklari — PRD acceptance criteria\'lari daha acik yazin';
      case 'merge_conflict': return 'Merge conflictleri — Story bagimliliklarini (depends_on) PRD\'de tanimlayin';
      case 'design_mismatch': return 'Tasarim uyumsuzluklari — PRD\'de exact CSS degerleri verin (hex renkler, px spacing)';
      case 'missing_input': return 'Eksik input degiskenleri — PRD tum gerekli bilgileri icermeli';
      default: return 'PRD puanini 70+ olana kadar gelistirin';
    }
  }

  if (prdScore < 50) return 'PRD cok kisa/eksik — en az 70 puan hedefleyin';
  if (prdScore < 70) return 'PRD orta kalite — tasarim detaylari ve veri modeli ekleyin';
  return 'PRD kalitesi yeterli ama run basarisiz — agent loglarini kontrol edin';
}

export default router;
