import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';

const execFileAsync = promisify(execFileCb);

const STITCH_SCRIPT = join(homedir(), '.openclaw', 'setfarm-repo', 'scripts', 'stitch-api.mjs');
const STITCH_SCRIPT_ALT = join(homedir(), '.openclaw', 'scripts', 'stitch-api.mjs');
const STITCH_CACHE_DIR = join(homedir(), '.openclaw', 'setfarm', 'stitch-cache');

// Path traversal guard — Stitch IDs can be hex or numeric
const SAFE_ID_RE = /^[a-f0-9-]+$/i;
function validateStitchId(value: string, name: string): string {
  if (!value || !SAFE_ID_RE.test(value)) {
    throw new Error(`Invalid ${name}: must be alphanumeric (hex/digits/dash) only`);
  }
  return value;
}

// Extract projectId from stitch-api.mjs output (JSON first, regex fallback)
function parseProjectId(output: string): string {
  try {
    const data = JSON.parse(output);
    if (data.projectId) return String(data.projectId);
    if (data.project_id) return String(data.project_id);
  } catch { /* not JSON, try regex */ }
  const m = output.match(/project[_\s]*(?:id)?[:\s]*["']?([a-f0-9]+)["']?/i);
  return m?.[1] || '';
}

function getStitchScript(): string {
  if (existsSync(STITCH_SCRIPT)) return STITCH_SCRIPT;
  if (existsSync(STITCH_SCRIPT_ALT)) return STITCH_SCRIPT_ALT;
  throw new Error('stitch-api.mjs not found');
}

async function runStitch(args: string[]): Promise<string> {
  const script = getStitchScript();
  const { stdout, stderr } = await execFileAsync('node', [script, ...args], {
    timeout: 300000,
    maxBuffer: 5 * 1024 * 1024,
    env: { ...process.env, HOME: homedir() },
  });
  if (stderr) {
    console.warn('[STITCH] stderr:', stderr.substring(0, 500));
  }
  return stdout.trim();
}

export interface StitchScreen {
  screenId: string;
  title: string;
  htmlUrl: string | null;
  screenshotUrl: string | null;
  localHtml: string | null;
  width?: number;
  height?: number;
  status: string;
  prompt?: string;
  parentScreenId?: string;
}

export async function ensureStitchProject(name: string, repoPath?: string): Promise<{ projectId: string; name: string }> {
  const args = ['ensure-project', name];
  if (repoPath) args.push(repoPath);
  const output = await runStitch(args);
  const projectId = parseProjectId(output);
  return { projectId, name };
}

export async function createStitchProject(title: string): Promise<string> {
  const output = await runStitch(['create-project', title]);
  return parseProjectId(output);
}

export async function generateScreen(projectId: string, prompt: string, title: string, device = 'DESKTOP'): Promise<StitchScreen | null> {
  try {
    const output = await runStitch(['generate-screen-safe', projectId, prompt, title, device, 'GEMINI_3_PRO']);
    try {
      const data = JSON.parse(output);
      if (data.screens?.[0]) {
        const s = data.screens[0];
        return {
          screenId: s.screenId || s.id || '',
          title: s.title || title,
          htmlUrl: s.htmlUrl || null,
          screenshotUrl: s.screenshotUrl || null,
          localHtml: null,
          width: s.width,
          height: s.height,
          status: 'done',
        };
      }
      if (data.skipped) {
        return { screenId: data.existingScreenId || '', title, htmlUrl: null, screenshotUrl: null, localHtml: null, status: 'skipped' };
      }
    } catch {
      const screenIdMatch = output.match(/screen[_\s]*(?:id)?[:\s]*["']?([a-f0-9]+)["']?/i);
      if (screenIdMatch) {
        return { screenId: screenIdMatch[1], title, htmlUrl: null, screenshotUrl: null, localHtml: null, status: 'done' };
      }
    }
    return null;
  } catch (err: any) {
    console.error('[STITCH] generateScreen error:', err.message);
    return null;
  }
}

export async function listScreens(projectId: string): Promise<StitchScreen[]> {
  try {
    const output = await runStitch(['list-screens', projectId]);
    const data = JSON.parse(output);
    const screens = Array.isArray(data) ? data : data.screens || [];
    return screens.map((s: any) => ({
      screenId: s.id || s.screenId || s.screen_id || '',
      title: s.title || 'Untitled',
      htmlUrl: s.htmlCode?.downloadUrl || s.html_code?.download_url || null,
      screenshotUrl: s.screenshot?.downloadUrl || s.screenshot?.download_url || null,
      localHtml: null,
      width: s.width,
      height: s.height,
      status: 'done',
    }));
  } catch (err: any) {
    console.error('[STITCH] listScreens error:', err.message);
    return [];
  }
}

export async function downloadScreen(projectId: string, screenId: string, outputDir: string): Promise<{ htmlPath: string; screenshotPath: string } | null> {
  try {
    validateStitchId(projectId, 'projectId');
    validateStitchId(screenId, 'screenId');
    mkdirSync(outputDir, { recursive: true });
    // stitch-api.mjs expects a FILE path, not directory
    const outputFile = join(outputDir, `${screenId}.html`);
    const output = await runStitch(['download-screen', projectId, screenId, outputFile]);
    const htmlPath = join(outputDir, `${screenId}.html`);
    const screenshotPath = join(outputDir, `${screenId}.png`);
    return { htmlPath, screenshotPath };
  } catch (err: any) {
    console.error('[STITCH] downloadScreen error:', err.message);
    return null;
  }
}

export async function generateMockupsFromPrd(prdContent: string, title: string, platform: string): Promise<{
  projectId: string;
  screens: StitchScreen[];
}> {
  const projectId = await createStitchProject(`PRD: ${title}`);
  if (!projectId) {
    throw new Error('Failed to create Stitch project');
  }

  const sections = prdContent.split(/^#{1,2}\s+/m).filter(s => s.trim());
  const screenPrompts: { title: string; prompt: string; device: string }[] = [];

  for (const section of sections.slice(0, 8)) {
    const sectionTitle = section.split('\n')[0]?.trim() || '';
    if (!sectionTitle) continue;
    if (/teknik|api|veri\s*modeli|technical|data\s*model|deployment/i.test(sectionTitle)) continue;
    const sectionContent = section.slice(0, 1000);
    const device = platform === 'mobile' ? 'MOBILE' : 'DESKTOP';
    screenPrompts.push({
      title: sectionTitle,
      prompt: `Create a ${platform === 'mobile' ? 'mobile app' : 'web page'} screen for: ${sectionTitle}\n\nDetails:\n${sectionContent}`,
      device,
    });
  }

  const screens: StitchScreen[] = [];
  for (const sp of screenPrompts) {
    const screen = await generateScreen(projectId, sp.prompt, sp.title, sp.device);
    if (screen) {
      screen.prompt = sp.prompt;
      screens.push(screen);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  const cacheDir = join(STITCH_CACHE_DIR, projectId);
  mkdirSync(cacheDir, { recursive: true });

  for (const screen of screens) {
    if (screen.screenId && screen.status === 'done') {
      try {
        const downloaded = await downloadScreen(projectId, screen.screenId, cacheDir);
        if (downloaded) {
          screen.localHtml = downloaded.htmlPath;
          screen.screenshotUrl = `/stitch-cache/${projectId}/${screen.screenId}.png`;
          screen.htmlUrl = `/stitch-cache/${projectId}/${screen.screenId}.html`;
        }
      } catch { /* continue */ }
    }
  }

  return { projectId, screens };
}

export async function deleteScreenFromCache(projectId: string, screenId: string): Promise<boolean> {
  if (!projectId || !screenId || !SAFE_ID_RE.test(projectId) || !SAFE_ID_RE.test(screenId)) {
    return false;
  }
  const cacheDir = join(STITCH_CACHE_DIR, projectId);
  const { unlink } = await import('fs/promises');
  for (const ext of ['.html', '.png']) {
    try { await unlink(join(cacheDir, `${screenId}${ext}`)); } catch { /* ok */ }
  }
  return true;
}

export async function regenerateScreen(projectId: string, screenId: string, prompt: string, title: string, device = 'DESKTOP'): Promise<StitchScreen | null> {
  validateStitchId(projectId, 'projectId');
  validateStitchId(screenId, 'screenId');
  await deleteScreenFromCache(projectId, screenId);
  const screen = await generateScreen(projectId, prompt, title, device);
  if (screen) {
    screen.prompt = prompt;
    const cacheDir = join(STITCH_CACHE_DIR, projectId);
    mkdirSync(cacheDir, { recursive: true });
    if (screen.screenId && screen.status === 'done') {
      try {
        const downloaded = await downloadScreen(projectId, screen.screenId, cacheDir);
        if (downloaded) screen.localHtml = downloaded.htmlPath;
      } catch { /* continue */ }
    }
  }
  return screen;
}

export async function prepareDesignFilesForRepo(
  projectId: string,
  screens: StitchScreen[],
  repoPath: string,
): Promise<{ screenMap: Record<string, string>; designSystem: any }> {
  validateStitchId(projectId, 'projectId');
  const { writeFile, copyFile } = await import('fs/promises');

  const stitchDir = join(repoPath, 'stitch');
  mkdirSync(stitchDir, { recursive: true });

  const cacheDir = join(STITCH_CACHE_DIR, projectId);
  const screenMap: Record<string, string> = {};
  const manifestScreens: any[] = [];

  for (const screen of screens) {
    if (!screen.screenId || screen.status !== 'done') continue;
    const srcHtml = join(cacheDir, `${screen.screenId}.html`);
    const srcPng = join(cacheDir, `${screen.screenId}.png`);
    // Readable filename: "Ana Sayfa" → "Ana-Sayfa.html"
    const safeName = (screen.title || screen.screenId).replace(/[^a-zA-Z0-9\u00C0-\u024F\u0400-\u04FF -]/g, '').replace(/\s+/g, '-');
    const destHtml = join(stitchDir, `${safeName}.html`);
    const destPng = join(stitchDir, `${safeName}.png`);
    try { if (existsSync(srcHtml)) await copyFile(srcHtml, destHtml); } catch { /* ok */ }
    try { if (existsSync(srcPng)) await copyFile(srcPng, destPng); } catch { /* ok */ }
    screenMap[screen.title] = screen.screenId;
    manifestScreens.push({ id: screen.screenId, title: screen.title, file: `${safeName}.html`, screenshot: `${safeName}.png`, width: screen.width, height: screen.height });
  }

  await writeFile(join(repoPath, '.stitch'), JSON.stringify({ projectId, name: 'PRD Design', updatedAt: new Date().toISOString() }, null, 2));
  await writeFile(join(stitchDir, 'DESIGN_MANIFEST.json'), JSON.stringify({ projectId, screens: manifestScreens, generatedAt: new Date().toISOString() }, null, 2));

  let designSystem: any = {};
  if (manifestScreens.length > 0) {
    try {
      const output = await runStitch(['extract-tokens', projectId, cacheDir]);
      const data = JSON.parse(output);
      designSystem = data;
      if (data.css) await writeFile(join(stitchDir, 'design-tokens.css'), data.css);
    } catch { /* extract-tokens failed */ }
  }

  return { screenMap, designSystem };
}

// Helper: extract screen prompts from PRD content (used by SSE streaming endpoint)
// Extract design system info from PRD (colors, fonts, spacing) for Stitch prompts
function extractDesignContext(prdContent: string): string {
  const lines = prdContent.split("\n");
  const designLines: string[] = [];
  let inDesignSection = false;
  for (const line of lines) {
    if (/^#{1,3}\s.*(tasar[ıi]m\s*sistemi|design\s*system|renkler|colors|tipografi|typography|fonts)/i.test(line)) {
      inDesignSection = true;
      designLines.push(line);
      continue;
    }
    if (inDesignSection) {
      if (/^#{1,2}\s/.test(line) && !/renkler|colors|font|tipografi|spacing|tema|theme/i.test(line)) {
        inDesignSection = false;
        continue;
      }
      designLines.push(line);
    }
  }
  // Also extract hex colors and font names from entire PRD
  const hexColors = [...new Set((prdContent.match(/#[0-9a-fA-F]{3,8}/g) || []))].slice(0, 10);
  const fontMatch = prdContent.match(/font[- ]?family[:\s]*([^;\n]+)/i);
  let extra = "";
  if (hexColors.length > 0) extra += "\nColors: " + hexColors.join(", ");
  if (fontMatch) extra += "\nFont: " + fontMatch[1].trim();
  return (designLines.join("\n").slice(0, 1500) + extra).trim();
}

export function extractScreenPrompts(prdContent: string, platform: string, analysis?: any): { title: string; prompt: string; device: string }[] {
  const designContext = extractDesignContext(prdContent);

  // Build visual context from URL analysis
  let analysisContext = "";
  if (analysis && typeof analysis === "object") {
    const parts: string[] = [];
    if (analysis.colors) {
      const c = analysis.colors;
      const entries = Object.entries(c).filter(([,v]) => v).map(([k,v]) => k + "=" + v);
      if (entries.length) parts.push("COLORS: " + entries.join(", "));
    }
    if (analysis.fonts?.length) parts.push("FONTS: " + analysis.fonts.join(", "));
    if (analysis.style) parts.push("STYLE: " + analysis.style);
    if (analysis.layout) parts.push("LAYOUT: " + analysis.layout);
    if (analysis.sections?.length) parts.push("SECTIONS: " + analysis.sections.join(", "));
    if (analysis.components?.length) parts.push("UI: " + analysis.components.join(", "));
    if (analysis.title) parts.push("SITE: " + analysis.title);
    if (analysis.description) parts.push("ABOUT: " + analysis.description);
    analysisContext = parts.join(" | ");
  }

  const device = platform === "mobile" ? "MOBILE" : "DESKTOP";
  const screenPrompts: { title: string; prompt: string; device: string }[] = [];

  // Extract page names from PRD — find actual page sections
  const pageNames: string[] = [];
  const lines = prdContent.split("\n");

  // Strategy 1: Find h2 headings with route paths like ## 4. Ana Sayfa (`/`) or ## Ana Sayfa (/)
  for (const line of lines) {
    // Match: ## N. Page Name (`/path`) or ## Page Name (/path)
    const m = line.match(/^##\s+(?:\d+\.?\s+)?(.+?)\s*\([\`]?\/[^)]*[\`]?\)/);
    if (!m) continue;
    let name = m[1].trim().replace(/[\`]/g, "");
    // Skip technical sections
    if (/tasar[ıi]m|design|renk|font|spacing|shadow|z-index|animasyon|animation|responsive|breakpoint|komponent\s*k|veri\s*model|api\s*endpoint|teknik|browser|polyfill|dependencies|tailwind|edge\s*case|sayfa\s*listesi|^sayfalar$/i.test(name)) continue;
    // Route path required (regex already filters), just add to list
    if (name.length > 2) {
      if (name.length > 2 && !pageNames.includes(name)) pageNames.push(name);
    }
  }

  // Strategy 2: If not enough, find numbered items in "Sayfalar" bullet list
  if (pageNames.length < 3) {
    let inPageList = false;
    for (const line of lines) {
      if (/^##\s+.*sayfalar/i.test(line) || /^##\s+\d+\.\s+sayfalar/i.test(line)) { inPageList = true; continue; }
      if (inPageList && /^##\s/.test(line)) { inPageList = false; continue; }
      if (inPageList) {
        // Match: 1. **Ana Sayfa** (`/`) or - Ana Sayfa (/) or - **Ana Sayfa** — desc
        const m = line.match(/(?:\d+\.\s+)?\*\*(.+?)\*\*|^[-*]\s+(.+?)\s*[—–(]/);
        if (m) {
          let name = (m[1] || m[2] || "").trim().replace(/[\`]/g, "");
          if (name.length > 2 && !pageNames.includes(name)) pageNames.push(name);
        }
      }
    }
  }

  // Strategy 3: h3 under page sections (### 3.1 Ana Sayfa (/))
  if (pageNames.length < 3) {
    for (const line of lines) {
      if (/^###\s+(?:\d+\.\d+\s+)?(.+?)\s*\([\`]?\//.test(line)) {
        const m = line.match(/^###\s+(?:\d+\.\d+\s+)?(.+?)\s*\(/);
        if (m) {
          let name = m[1].trim().replace(/[\`]/g, "");
          if (name.length > 2 && !pageNames.includes(name)) pageNames.push(name);
        }
      }
    }
  }

  // Build section map from ALL headings (h2 + h3)
  const sectionMap = new Map<string, string>();
  const parts = prdContent.split(/^(#{2,3}\s+.+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const rawHeading = parts[i].replace(/^#{2,3}\s+/, "").trim();
    const heading = rawHeading.replace(/^\d+\.\s*/, "").replace(/\s*\(.*?\)\s*/g, "").replace(/`/g, "").trim();
    const body = (parts[i + 1] || "").trim();
    sectionMap.set(heading, body);
  }

  // Use page names if found
  const targets = pageNames.length >= 2 ? pageNames : [];

  // Fallback: filter sectionMap keys
  if (targets.length < 2) {
    const skipRe = /proje\s*genel|genel\s*bak[ıi]|overview|tasar[ıi]m\s*sistemi|design\s*system|renkler|renk\s*paleti|tipografi|typography\s*scale|fonts|sayfalar$|sayfa\s*listesi|teknik\s*gereksinim|teknik\s*mimari|api\s*endpoint|veri\s*modeli|komponent\s*k[uü]t[uü]phane|animasyon\s*sistemi|animasyonlar$|responsive\s*breakpoint|breakpoint\s*tan|spacing|z-index|shadow|browser\s*deste|polyfill|dependencies|tailwind\s*config/i
    for (const [heading] of sectionMap) {
      if (!skipRe.test(heading) && targets.length < 8) targets.push(heading);
    }
  }

  for (const pageName of targets.slice(0, 8)) {
    let sectionContent = "";
    for (const [heading, body] of sectionMap) {
      const hLower = heading.toLowerCase();
      const pLower = pageName.toLowerCase();
      const pWords = pLower.split(/\s+/).filter(w => w.length > 2);
      if (hLower.includes(pLower) || pLower.includes(hLower) || hLower === pLower
          || pWords.filter(w => hLower.includes(w)).length >= 1) {
        sectionContent = body.slice(0, 1500);
        break;
      }
    }
    if (!sectionContent) sectionContent = pageName;

    // Build rich prompt with FULL PRD context (like Setfarm pipeline does)
    const prdTruncated = prdContent.length > 12000 ? prdContent.slice(0, 12000) + "\n[...truncated]" : prdContent;
    let prompt = `Build a complete, production-ready ${platform === "mobile" ? "mobile app" : "web page"} design for: "${pageName}"

FULL PROJECT PRD (use this as your primary reference for ALL design decisions):
${prdTruncated}

TARGET PAGE: "${pageName}"
PAGE-SPECIFIC DETAILS:
${sectionContent}

${analysisContext ? "REFERENCE SITE ANALYSIS (match this style): " + analysisContext : ""}

CRITICAL RULES:
- Use the EXACT colors, fonts, spacing, and design tokens from the PRD above
- This page must look like it belongs to the SAME project described in the PRD
- Use the SAME visual language, theme, typography as the PRD specifies
- Include REAL content matching the project's context — not lorem ipsum or generic text
- All components must be FULLY styled — buttons, cards, inputs, nav, footer
- Include hover states, shadows, gradients, animations as specified in the PRD
- The design must be production-ready, not a wireframe
- Responsive layout matching PRD breakpoints
- Keep consistent navigation/header/footer across all pages`;
    screenPrompts.push({ title: pageName, prompt, device });
  }
  return screenPrompts;

}
