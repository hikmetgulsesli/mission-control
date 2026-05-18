import { Router } from 'express';
import { createPrd, getPrd, listPrds, updatePrd, deletePrd, listTemplates, getTemplate } from '../services/prd-db.js';
import { scorePrd, estimateCost, checkScreenCoverage, extractPages } from '../services/prd-scoring.js';
import { generatePrd, enhancePrd, generateChatQuestions, analyzeSite, analyzeScreenshot } from '../services/prd-llm.js';
import { generateMockupsFromPrd, deleteScreenFromCache, regenerateScreen, generateScreen, downloadScreen, prepareDesignFilesForRepo, createStitchProject, extractScreenPrompts } from '../services/stitch-integration.js';
import { mapComponentsFromPrd, generateComponentSection } from '../services/component-mapper.js';
import { getRunBenchmark, analyzePrdFormats } from '../services/benchmark.js';
import { checkSsrf } from '../utils/ssrf.js';
import { config, PATHS } from '../config.js';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';

const router = Router();

// POST /prd/analyze - analyze URL or screenshot.
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

    // SSRF protection
    const ssrfError = checkSsrf(url);
    if (ssrfError) {
      res.status(400).json({ error: ssrfError });
      return;
    }

    // Platform auto-detect
    let platform = 'web';
    if (/apps\.apple\.com|play\.google\.com|itunes\.apple\.com/.test(url)) {
      platform = 'mobile';
    }

    // --- App Store: use iTunes Lookup API (JS-rendered SPA workaround) ---
    const appIdMatch = url.match(/\/id(\d+)/);
    if (/apps\.apple\.com/.test(url) && appIdMatch) {
      try {
        // Extract country code from URL, default to 'tr'
        const countryMatch = url.match(/apps\.apple\.com\/([a-z]{2})\//);
        const country = countryMatch ? countryMatch[1] : 'tr';
        const lookupUrl = `https://itunes.apple.com/lookup?id=${appIdMatch[1]}&country=${country}`;
        const lookupRes = await fetch(lookupUrl, { signal: AbortSignal.timeout(10000) });
        const lookupData = await lookupRes.json() as any;
        if (lookupData.results?.length > 0) {
          const app = lookupData.results[0];
          const analysis = {
            title: app.trackName,
            description: app.description,
            platform: 'mobile' as const,
            category: app.primaryGenreName,
            screenshots: app.screenshotUrls || [],
            ipadScreenshots: app.ipadScreenshotUrls || [],
            rating: app.averageUserRating,
            ratingCount: app.userRatingCount,
            developer: app.artistName,
            price: app.formattedPrice,
            bundleId: app.bundleId,
            version: app.version,
            releaseNotes: app.releaseNotes || '',
            features: (app.description || '').split('\n').filter((l: string) => l.startsWith('•') || l.startsWith('-') || l.startsWith('*')),
            icon: app.artworkUrl512 || app.artworkUrl100,
            storeUrl: app.trackViewUrl,
          };
          res.json({ analysis, platform: 'mobile', url });
          return;
        }
      } catch (lookupErr: any) {
        // Fall through to generic fetch
        console.warn('[PRD] iTunes lookup failed, falling back:', lookupErr.message);
      }
    }

    // --- Play Store: try with mobile user-agent ---
    if (/play\.google\.com/.test(url)) {
      try {
        const playRes = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: AbortSignal.timeout(15000),
        });
        const playHtml = await playRes.text();
        if (playHtml.length < 1024) {
          res.status(502).json({
            error: 'Play Store page could not be loaded because it is a JavaScript-rendered SPA. Enter the app description manually or try an App Store link.',
            hint: 'Google Play Store pages may fail automatic analysis because they require JavaScript. Paste the application features into the PRD generator description field.',
          });
          return;
        }
        const analysis = await analyzeSite(playHtml, url);
        res.json({ analysis, platform: 'mobile', url });
        return;
      } catch (playErr: any) {
        res.status(502).json({
          error: `Play Store fetch failed: ${playErr.message}. Enter the app description manually.`,
          hint: 'Google Play Store pages may fail automatic analysis because they require JavaScript.',
        });
        return;
      }
    }

    // --- Generic web fetch ---
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

// POST /prd/github-import - extract analysis data from a GitHub repo.
router.post('/prd/github-import', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) { res.status(400).json({ error: 'url required' }); return; }

    const { scrapeGitHubRepo, detectPlatform } = await import('../services/github-scraper.js');
    const data = await scrapeGitHubRepo(url);
    if (!data) { res.status(404).json({ error: 'GitHub repo not found or gh CLI is not authenticated' }); return; }

    const platform = detectPlatform(data.techStack);
    res.json({
      analysis: { ...data, platform },
      platform,
      url: data.url,
    });
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
            content: 'You are a web research expert. Research best practices, UX patterns, industry standards, and example projects for the given topic. Return JSON only: { "bestPractices": [], "uxPatterns": [], "competitors": [], "recommendations": [] }',
          },
          { role: 'user', content: `Research: ${finalQuery}` },
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

// POST /prd/generate - generate PRD.
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

    // Add component library mapping.
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

    const pages = extractPages(prdContent);
    await updatePrd(prd.id, {
      prd_content: prdContent,
      prd_version: (prd.prd_version || 0) + 1,
      score: scoreResult.total,
      score_details: scoreResult,
      cost_estimate: costResult,
      analysis: analysis || prd.analysis,
      research: research || prd.research,
      pages,
    });

    const updated = await getPrd(prd.id);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Async enhance job storage
const enhanceJobs = new Map<string, { status: string; result?: any; error?: string; startedAt: number }>();

// POST /prd/enhance — Start async enhance job (returns immediately)
router.post('/prd/enhance', async (req, res) => {
  const { prdId } = req.body;
  if (!prdId) { res.status(400).json({ error: 'prdId required' }); return; }
  const prd = await getPrd(prdId);
  if (!prd?.prd_content) { res.status(404).json({ error: 'PRD not found' }); return; }

  // Cleanup old jobs if map grows too large
  if (enhanceJobs.size > 10) {
    const oldest = [...enhanceJobs.entries()].sort((a, b) => (a[1].startedAt || 0) - (b[1].startedAt || 0));
    for (let i = 0; i < oldest.length - 5; i++) {
      enhanceJobs.delete(oldest[i][0]);
    }
  }

  // Start job in background
  enhanceJobs.set(prdId, { status: 'running', startedAt: Date.now() });
  res.json({ status: 'started', prdId });

  // Run enhance in background (no await — fire and forget)
  (async () => {
    try {
      const enhanced = await enhancePrd(prd.prd_content, prd.prd_version);

      // Enhancement validation: prevent page deletion or broken page formatting.
      const newPages = extractPages(enhanced);
      const oldPages = prd.pages || extractPages(prd.prd_content);
      if (oldPages.length > 0) {
        if (newPages.length === 0) {
          enhanceJobs.set(prdId, { status: 'error', error: 'Enhancement broke the page format. Original content was preserved.', startedAt: Date.now() });
          return;
        }
        const newRoutes = new Set(newPages.map((p: any) => p.route));
        const removed = oldPages.filter((p: any) => !newRoutes.has(p.route));
        if (removed.length > 0) {
          enhanceJobs.set(prdId, {
            status: 'error',
            error: `Enhancement removed these pages: ${removed.map((p: any) => p.name).join(', ')}. Original content was preserved.`,
            startedAt: Date.now(),
          });
          return;
        }
      }

      const scoreResult = scorePrd(enhanced);
      const costResult = estimateCost(enhanced);
      const pages = newPages;
      await updatePrd(prdId, {
        prd_content: enhanced,
        prd_version: prd.prd_version + 1,
        score: scoreResult.total,
        score_details: scoreResult,
        cost_estimate: costResult,
        pages,
      });
      const updated = await getPrd(prdId);
      enhanceJobs.set(prdId, { status: 'done', result: updated, startedAt: Date.now() });
    } catch (err: any) {
      enhanceJobs.set(prdId, { status: 'error', error: err.message, startedAt: Date.now() });
    }
    // Clean up after 5 minutes
    setTimeout(() => enhanceJobs.delete(prdId), 300000);
  })();
});

// GET /prd/enhance/status — Poll for enhance completion
router.get('/prd/enhance/status', async (req, res) => {
  const prdId = req.query.prdId as string;
  if (!prdId) { res.status(400).json({ error: 'prdId required' }); return; }
  const job = enhanceJobs.get(prdId);
  if (!job) { res.json({ status: 'idle' }); return; }
  res.json(job);
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

// POST /prd/mockups - generate mockups with the Stitch API.
router.post('/prd/mockups', async (req, res) => {
  try {
    const { prdId, prdContent, title } = req.body;
    const prd = prdId ? await getPrd(prdId) : null;
    const content = prdContent || prd?.prd_content;
    const prdTitle = title || prd?.title || 'Untitled';
    const platform = prd?.platform || 'web';

    if (!content) { res.status(400).json({ error: 'prdContent or prdId required' }); return; }

    // Generate mockups with the real Stitch API.
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
// GET /prd/mockups/stream - SSE streaming mockup generation.
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
    // Persist stitch_project_id to DB
    if (prdId && projectId) { try { await updatePrd(prdId, { stitch_project_id: projectId } as any); } catch {} }
    if (!projectId) { clearInterval(keepalive); send("error", { message: "Failed to create Stitch project" }); res.end(); return; }

    // Fetch analysis data from PRD record to enrich Stitch prompts
    const prdAnalysis = prd?.analysis || null;
    const savedPages = prd?.pages || null;
    const allPrompts = extractScreenPrompts(content, platform, prdAnalysis);
    const prompts = skipCount > 0 ? allPrompts.slice(skipCount) : allPrompts;
    const totalAll = allPrompts.length;
    send("start", { projectId, total: totalAll, remaining: prompts.length, resumed: skipCount > 0 });

    const allScreens: any[] = [];
    const cacheDir = join(PATHS.setfarmDir, "stitch-cache", projectId);
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
          prompt: sp.prompt, projectId, pageRoute: (sp as any).pageRoute || '', pageIndex: (sp as any).pageIndex || 0, pageName: sp.title,
        };
        allScreens.push(entry);
        send("screen", { index: globalIndex, total: totalAll, screen: entry });
        // Save incrementally — DB always has latest screens even if connection drops
        if (prdId) {
          const existingPrd = await getPrd(prdId);
          const existingScreens = (existingPrd?.mockup_screens || []).filter((s: any) => s.projectId === projectId);
          const merged = [...existingScreens.filter((s: any) => !allScreens.some((n: any) => n.id === s.id)), ...allScreens];
          await updatePrd(prdId, { mockup_screens: merged });
        }
      }
      if (i < prompts.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    // Final save with merged screens
    if (prdId) {
      const existingPrd = await getPrd(prdId);
      const existingScreens = (existingPrd?.mockup_screens || []).filter((s: any) => s.projectId === projectId);
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

// DELETE /prd/screens/:prdId/:screenId - delete a screen.
// Save edited PRD content
router.patch('/prd/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { prd_content } = req.body;
    if (!prd_content) return res.status(400).json({ error: 'prd_content required' });
    const updated = await updatePrd(id, { prd_content, prd_version: Date.now() });
    res.json(updated || { ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

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

// POST /prd/screens/:prdId/:screenId/regenerate - regenerate a screen.
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

// POST /prd/screens/:prdId/variant - generate a variant of an existing screen.
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
    const cacheDir = join(PATHS.setfarmDir, 'stitch-cache', projectId);
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


// POST /prd/screens/:prdId/generate-missing — Generate a new independent screen (not variant)
router.post('/prd/screens/:prdId/generate-missing', async (req, res) => {
  const { prdId } = req.params;
  const { title, prompt, projectId } = req.body;
  if (!projectId || !title) { res.status(400).json({ error: 'projectId and title required' }); return; }
  try {
    const screen = await generateScreen(projectId, prompt || `Create a web page for: ${title}`, title);
    if (!screen || !screen.screenId) { res.json({ screen: null }); return; }
    screen.prompt = prompt;
    // Download to cache
    const { join } = await import('path');
    const { mkdirSync } = await import('fs');
    const cacheDir = join(PATHS.setfarmDir, 'stitch-cache', projectId);
    mkdirSync(cacheDir, { recursive: true });
    try {
      const dl = await downloadScreen(projectId, screen.screenId, cacheDir);
      if (dl) {
        screen.screenshotUrl = `/stitch-cache/${projectId}/${screen.screenId}.png`;
        screen.htmlUrl = `/stitch-cache/${projectId}/${screen.screenId}.html`;
      }
    } catch {}
    // Save to DB + look up route from saved pages
    const prd = await getPrd(prdId);
    const savedPages = prd?.pages || [];
    const matchingPage = savedPages.find((p: any) => p.name === title);
    const entry = {
      id: screen.screenId, name: title, status: screen.status,
      screenshotUrl: screen.screenshotUrl, htmlUrl: screen.htmlUrl,
      width: screen.width, height: screen.height, prompt, projectId,
      pageRoute: matchingPage?.route || '',
      pageIndex: matchingPage ? savedPages.indexOf(matchingPage) + 1 : 0,
      pageName: title,
    };
    if (prd) {
      const screens = [...(prd.mockup_screens || []), entry];
      await updatePrd(prdId, { mockup_screens: screens });
    }
    res.json({ screen: entry });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/screen-coverage — PRD bolumleri vs ekranlar kapsam kontrolu
router.post('/prd/screen-coverage', async (req, res) => {
  try {
    const { prdContent, screens } = req.body;
    if (!prdContent || !screens) { res.status(400).json({ error: 'prdContent and screens required' }); return; }

    // Use saved pages from DB if available
    let savedPages = null;
    if (req.body.prdId) {
      const prd = await getPrd(req.body.prdId);
      savedPages = prd?.pages || null;
    }
    const coverage = checkScreenCoverage(
      prdContent,
      screens.map((s: any) => ({ title: s.name || s.title, id: s.id })),
      savedPages,
    );
    res.json(coverage);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/screens/:prdId/clear - clear all screens.
router.post('/prd/screens/:prdId/clear', async (req, res) => {
  try {
    const { prdId } = req.params;
    await updatePrd(prdId, { mockup_screens: [] });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


// POST /prd/estimate - estimate cost and duration.
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

// POST /prd/start-run - Start pipeline with design files.
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
    const projectsDir = PATHS.projectsDir;
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
          // Commit design files to git so pipeline doesn't lose them
          // Also update .stitch updatedAt to NOW so stale check passes
          try {
            const _fs = await import('fs');
            const _path = await import('path');
            const stitchMeta = { projectId: stitchProjectId, name: 'PRD Design', updatedAt: new Date().toISOString() };
            _fs.writeFileSync(_path.join(repoPath, '.stitch'), JSON.stringify(stitchMeta, null, 2), 'utf8');
            const { execFileSync } = await import('child_process');
            const gitOpts = { cwd: repoPath, stdio: 'pipe' as const };
            execFileSync('git', ['add', 'stitch/', '.stitch'], gitOpts);
            execFileSync('git', ['commit', '-m', 'design: add Stitch mockup screens'], gitOpts);
          } catch {}
        } catch (err: any) {
          console.warn('[PRD] prepareDesignFilesForRepo failed:', err.message);
        }
      }
    }

    // 3. Build task string with full PRD + design metadata
    let task = `Project: ${name}\nPlatform: ${prd.platform}\nRepo: ${repoPath}`;
    if (stitchProjectId) task += `\nSTITCH_PROJECT_ID: ${stitchProjectId}`;
    if (screenMapStr) task += `\nSCREEN_MAP: ${screenMapStr}`;
    task += `\n\n${prd.prd_content}`;

    // 4. Start workflow via setfarm (write task to temp file to avoid E2BIG)
    const nodefs = await import('fs');
    const nodepath = await import('path');
    const tmpTask = nodepath.join(PATHS.setfarmDir, '.tmp-task-' + Date.now() + '.txt');
    nodefs.writeFileSync(tmpTask, task, 'utf8');
    // Fire-and-forget: spawn setfarm, don't wait for stdout (avoids timeout)
    const { spawn } = await import('child_process');
    const userBin = config.cliPath;
    const child = spawn('setfarm', ['workflow', 'run', wf, '@' + tmpTask], {
      env: { ...process.env, DB_BACKEND: "postgres", SETFARM_PG_URL: process.env.SETFARM_PG_URL || process.env.DATABASE_URL || "", PATH: `${userBin}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}` },
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Wait briefly then find the new run ID from DB
    await new Promise(r => setTimeout(r, 5000));
    try { nodefs.unlinkSync(tmpTask); } catch {}

    // Find latest run for this repo
    const { getRuns } = await import('../utils/setfarm.js');
    const allRuns = (await getRuns()) as any[];
    const matching = allRuns
      .filter((r: any) => r.status === 'running' && r.task?.includes(repoPath))
      .sort((a: any, b: any) => (b.run_number || 0) - (a.run_number || 0));
    const runId = matching[0]?.id || null;

    if (runId) {
      await updatePrd(prdId, { run_id: runId });
    }

    res.json({ success: true, runId, output: 'Pipeline started', repoPath });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/history - PRD history.
router.get('/prd/history', async (_req, res) => {
  try {
    const prds = await listPrds(50);
    res.json(prds);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/history/:id - PRD detail with auto-migration for old PRDs.
router.get('/prd/history/:id', async (req, res) => {
  try {
    let prd = await getPrd(req.params.id);
    if (!prd) { res.status(404).json({ error: 'PRD not found' }); return; }

    // Auto-migrate by extracting and saving pages when missing.
    let migrated = false;
    if (prd.prd_content && (!prd.pages || (prd.pages as any[]).length === 0)) {
      const pages = extractPages(prd.prd_content);
      if (pages.length > 0) {
        await updatePrd(prd.id, { pages });
        migrated = true;
      }
    }
    // Auto-migrate: recover stitch_project_id from existing mockup screens when missing.
    if (!prd.stitch_project_id && prd.mockup_screens?.length > 0) {
      const pid = (prd.mockup_screens as any[]).find((s: any) => s.projectId)?.projectId;
      if (pid) {
        await updatePrd(prd.id, { stitch_project_id: pid } as any);
        migrated = true;
      }
    }
    if (migrated) prd = await getPrd(prd.id) as any;

    res.json(prd);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /prd/history/:id - delete a PRD.
router.delete('/prd/history/:id', async (req, res) => {
  try {
    const success = await deletePrd(req.params.id);
    res.json({ success });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/templates - ready-to-use templates.
router.get('/prd/templates', async (_req, res) => {
  try {
    const templates = await listTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /prd/benchmark/:runId - post-deploy comparison with the real Setfarm DB.
router.get('/prd/benchmark/:runId', async (req, res) => {
  try {
    // Find the PRD linked to this run.
    const prds = await listPrds(100);
    const prd = prds.find(p => p.run_id === req.params.runId);

    // Load real run benchmark data from Setfarm DB.
    const runBenchmark = await getRunBenchmark(req.params.runId);
    if (!runBenchmark && !prd) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }

    const prdScore = prd?.score || 0;
    const estimate = prd?.cost_estimate || {};

    // Success analysis.
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

// GET /prd/analytics - PRD format analysis across all runs.
router.get('/prd/analytics', async (_req, res) => {
  try {
    const analysis = await analyzePrdFormats();
    res.json(analysis);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /prd/components - component mapping from PRD content.
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
  if (!run) return 'Run data not found';

  const errors = run.errorCategories || {};
  const topError = Object.entries(errors).sort((a: any, b: any) => b[1] - a[1])[0];

  if (run.status === 'completed' || run.status === 'done') {
    if (run.retryCount > run.totalStories) {
      return 'Completed, but retry count is too high. Make the PRD more specific.';
    }
    return 'Completed successfully';
  }

  if (topError) {
    const [category] = topError;
    switch (category) {
      case 'timeout': return 'Agent timeout rate is high. Make the PRD shorter and more focused, and reduce work per story.';
      case 'lint_error': return 'Lint errors are frequent. Specify ESLint rules and code style in the PRD.';
      case 'build_error': return 'Build errors occurred. Provide a detailed dependency list and build setup instructions in the PRD.';
      case 'test_failure': return 'Tests failed. Write clearer PRD acceptance criteria.';
      case 'merge_conflict': return 'Merge conflicts occurred. Define story dependencies in the PRD.';
      case 'design_mismatch': return 'Design mismatches occurred. Provide exact CSS values in the PRD, including hex colors and pixel spacing.';
      case 'missing_input': return 'Required input variables are missing. The PRD should include all required information.';
      default: return 'Improve the PRD until its score is 70 or higher.';
    }
  }

  if (prdScore < 50) return 'PRD is too short or incomplete. Target a score of at least 70.';
  if (prdScore < 70) return 'PRD quality is medium. Add design details and a data model.';
  return 'PRD quality is sufficient, but the run failed. Review agent logs.';
}

// POST /prd/enhance-with-trends — Enhance PRD with 2026 trends
router.post('/prd/enhance-with-trends', async (req, res) => {
  try {
    const { prdContent } = req.body;
    if (!prdContent) { res.status(400).json({ error: 'prdContent required' }); return; }

    const { TRENDS_2026, buildTrendEnhancementPrompt, callLlm } = await import('../services/prd-llm.js');
    const prompt = buildTrendEnhancementPrompt(prdContent, TRENDS_2026);

    const enhanced = await callLlm([{ role: 'user', content: prompt }], 16000);

    res.json({ enhanced, trends: TRENDS_2026 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
