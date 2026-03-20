import { execFile as execFileCb } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { readFile } from 'fs/promises';

const execFileAsync = promisify(execFileCb);

// Stitch API script path — setfarm-repo'dan veya scripts'ten
const STITCH_SCRIPT = join(homedir(), '.openclaw', 'setfarm-repo', 'scripts', 'stitch-api.mjs');
const STITCH_SCRIPT_ALT = join(homedir(), '.openclaw', 'scripts', 'stitch-api.mjs');
const STITCH_CACHE_DIR = join(homedir(), '.openclaw', 'setfarm', 'stitch-cache');

// A3 fix: path traversal guard — projectId/screenId must be hex only
const SAFE_HEX_RE = /^[a-f0-9-]+$/i;
function validateStitchId(value: string, name: string): string {
  if (!value || !SAFE_HEX_RE.test(value)) {
    throw new Error(`Invalid ${name}: must be hex/dash characters only`);
  }
  return value;
}

function getStitchScript(): string {
  if (existsSync(STITCH_SCRIPT)) return STITCH_SCRIPT;
  if (existsSync(STITCH_SCRIPT_ALT)) return STITCH_SCRIPT_ALT;
  throw new Error('stitch-api.mjs not found');
}

async function runStitch(args: string[]): Promise<string> {
  const script = getStitchScript();
  const { stdout, stderr } = await execFileAsync('node', [script, ...args], {
    timeout: 300000, // 5 min
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
  // Parse project ID from output
  const idMatch = output.match(/project[_\s]*(?:id)?[:\s]*([a-f0-9]+)/i);
  const projectId = idMatch?.[1] || '';

  return { projectId, name };
}

export async function createStitchProject(title: string): Promise<string> {
  const output = await runStitch(['create-project', title]);
  const idMatch = output.match(/project[_\s]*(?:id)?[:\s]*([a-f0-9]+)/i);
  return idMatch?.[1] || '';
}

export async function generateScreen(projectId: string, prompt: string, title: string, device = 'DESKTOP'): Promise<StitchScreen | null> {
  try {
    const output = await runStitch(['generate-screen-safe', projectId, prompt, title, device, 'GEMINI_3_PRO']);
    // Parse screen data from JSON output
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
        return {
          screenId: data.existingScreenId || '',
          title,
          htmlUrl: null,
          screenshotUrl: null,
          localHtml: null,
          status: 'skipped',
        };
      }
    } catch {
      // Not JSON, parse from text
      const screenIdMatch = output.match(/screen[_\s]*(?:id)?[:\s]*([a-f0-9]+)/i);
      if (screenIdMatch) {
        return {
          screenId: screenIdMatch[1],
          title,
          htmlUrl: null,
          screenshotUrl: null,
          localHtml: null,
          status: 'done',
        };
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
    const output = await runStitch(['download-screen', projectId, screenId, outputDir]);
    // Find downloaded files
    const htmlMatch = output.match(/html[:\s]+(.+\.html)/i);
    const pngMatch = output.match(/screenshot[:\s]+(.+\.png)/i);
    return {
      htmlPath: htmlMatch?.[1] || join(outputDir, `${screenId}.html`),
      screenshotPath: pngMatch?.[1] || join(outputDir, `${screenId}.png`),
    };
  } catch (err: any) {
    console.error('[STITCH] downloadScreen error:', err.message);
    return null;
  }
}

export async function generateMockupsFromPrd(prdContent: string, title: string, platform: string): Promise<{
  projectId: string;
  screens: StitchScreen[];
}> {
  // 1. Create/ensure Stitch project
  const projectId = await createStitchProject(`PRD: ${title}`);
  if (!projectId) {
    throw new Error('Failed to create Stitch project');
  }

  // 2. Extract screens from PRD sections
  const sections = prdContent.split(/^#{1,2}\s+/m).filter(s => s.trim());
  const screenPrompts: { title: string; prompt: string; device: string }[] = [];

  for (const section of sections.slice(0, 8)) {
    const sectionTitle = section.split('\n')[0]?.trim() || '';
    if (!sectionTitle) continue;
    // Skip non-visual sections
    if (/teknik|api|veri\s*modeli|technical|data\s*model|deployment/i.test(sectionTitle)) continue;

    const sectionContent = section.slice(0, 1000);
    const device = platform === 'mobile' ? 'MOBILE' : 'DESKTOP';

    screenPrompts.push({
      title: sectionTitle,
      prompt: `Create a ${platform === 'mobile' ? 'mobile app' : 'web page'} screen for: ${sectionTitle}\n\nDetails:\n${sectionContent}`,
      device,
    });
  }

  // 3. Generate screens (sequential to avoid rate limits)
  const screens: StitchScreen[] = [];
  for (const sp of screenPrompts) {
    const screen = await generateScreen(projectId, sp.prompt, sp.title, sp.device);
    if (screen) {
      screen.prompt = sp.prompt;
      screens.push(screen);
    }
    // Small delay between generations
    await new Promise(r => setTimeout(r, 2000));
  }

  // 4. Download to cache
  const cacheDir = join(STITCH_CACHE_DIR, projectId);
  mkdirSync(cacheDir, { recursive: true });

  for (const screen of screens) {
    if (screen.screenId && screen.status === 'done') {
      try {
        const downloaded = await downloadScreen(projectId, screen.screenId, cacheDir);
        if (downloaded) {
          screen.localHtml = downloaded.htmlPath;
        }
      } catch {
        // Download failed, continue
      }
    }
  }

  return { projectId, screens };
}

export async function deleteScreenFromCache(projectId: string, screenId: string): Promise<boolean> {
  if (!projectId || !screenId || !SAFE_HEX_RE.test(projectId) || !SAFE_HEX_RE.test(screenId)) {
    return false;
  }
  const cacheDir = join(STITCH_CACHE_DIR, projectId);
  const { unlink } = await import('fs/promises');
  const extensions = ['.html', '.png'];
  for (const ext of extensions) {
    const filePath = join(cacheDir, `${screenId}${ext}`);
    try { await unlink(filePath); } catch { /* file may not exist */ }
  }
  return true;
}

export async function regenerateScreen(projectId: string, screenId: string, prompt: string, title: string, device = 'DESKTOP'): Promise<StitchScreen | null> {
  validateStitchId(projectId, 'projectId');
  validateStitchId(screenId, 'screenId');
  // Delete old cached files
  await deleteScreenFromCache(projectId, screenId);
  // Generate new screen with same or updated prompt
  const screen = await generateScreen(projectId, prompt, title, device);
  if (screen) {
    screen.prompt = prompt;
    // Download to cache
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
  const { writeFile, copyFile, readFile: readFileAsync } = await import('fs/promises');

  const stitchDir = join(repoPath, 'stitch');
  mkdirSync(stitchDir, { recursive: true });

  const cacheDir = join(STITCH_CACHE_DIR, projectId);
  const screenMap: Record<string, string> = {};
  const manifestScreens: any[] = [];

  // Copy HTML files from cache to repo stitch/ dir
  for (const screen of screens) {
    if (!screen.screenId || screen.status !== 'done') continue;
    const srcHtml = join(cacheDir, `${screen.screenId}.html`);
    const destHtml = join(stitchDir, `${screen.screenId}.html`);
    try {
      if (existsSync(srcHtml)) {
        await copyFile(srcHtml, destHtml);
      }
    } catch { /* continue */ }

    screenMap[screen.title] = screen.screenId;
    manifestScreens.push({
      id: screen.screenId,
      title: screen.title,
      file: `${screen.screenId}.html`,
      width: screen.width,
      height: screen.height,
    });
  }

  // Write .stitch project file
  await writeFile(join(repoPath, '.stitch'), JSON.stringify({
    projectId,
    name: `PRD Design`,
    updatedAt: new Date().toISOString(),
  }, null, 2));

  // Write DESIGN_MANIFEST.json
  await writeFile(join(stitchDir, 'DESIGN_MANIFEST.json'), JSON.stringify({
    projectId,
    screens: manifestScreens,
    generatedAt: new Date().toISOString(),
  }, null, 2));

  // Extract design tokens from first HTML
  let designSystem: any = {};
  if (manifestScreens.length > 0) {
    try {
      const output = await runStitch(['extract-tokens', projectId, cacheDir]);
      const data = JSON.parse(output);
      designSystem = data;
      // Write design-tokens.css
      if (data.css) {
        await writeFile(join(stitchDir, 'design-tokens.css'), data.css);
      }
    } catch { /* extract-tokens failed, continue */ }
  }

  return { screenMap, designSystem };
}
