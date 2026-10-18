import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { productBuildAuthorityV2LoadedBuildStartupStateV1 } from './product-build-authority-v2-delivery-evidence-v1.js';

const execFileAsync = promisify(execFile);

/** server/services and dist-server/services have the same package depth. */
export function resolveMissionControlRoot(moduleUrl: string = import.meta.url, override?: string): string {
  return override ? path.resolve(override) : path.resolve(fileURLToPath(new URL('../../', moduleUrl)));
}

export async function readMissionControlIdentity(options: { moduleUrl?: string; repoDir?: string } = {}) {
  const root = resolveMissionControlRoot(options.moduleUrl, options.repoDir ?? process.env.MC_REPO_DIR);
  let version: string | null = null;
  try {
    const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
    if (pkg.name === 'mission-control' && typeof pkg.version === 'string' && pkg.version.trim()) version = pkg.version;
  } catch { /* missing checkout is an unavailable observation */ }
  let checkoutCommit: string | null = null;
  if (version !== null) {
    try {
      const gitOptions = { timeout: 2000, maxBuffer: 64 * 1024, encoding: 'utf8' as const,
        env: { PATH: '/opt/homebrew/bin:/usr/bin:/bin', LANG: 'C', LC_ALL: 'C', GIT_TERMINAL_PROMPT: '0' } };
      const prefix = await execFileAsync('/usr/bin/git', ['-C', root, 'rev-parse', '--show-prefix'], gitOptions);
      if (prefix.stdout.trim() !== '') throw new Error('MC checkout root unavailable');
      const { stdout } = await execFileAsync('/usr/bin/git', ['-C', root, 'rev-parse', 'HEAD'], gitOptions);
      if (/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(stdout.trim())) checkoutCommit = stdout.trim();
    } catch { /* no git checkout */ }
  }
  // This is the existing startup-captured authority. Never reread BUILD_INFO or
  // current checkout bytes and present them as the process's loaded build.
  const state = productBuildAuthorityV2LoadedBuildStartupStateV1();
  const loadedBuild = state.status === 'available'
    ? { status: 'available' as const, sourceSha: state.response.loadedBuild.buildIdentity.sourceSha,
      buildHash: state.response.loadedBuild.buildIdentity.buildHash, loadedBuildHash: state.response.loadedBuildHash }
    : { status: 'unavailable' as const, sourceSha: null, buildHash: null, loadedBuildHash: null };
  return {
    version,
    commit: loadedBuild.sourceSha,
    builtAt: null,
    checkout: { status: checkoutCommit === null ? 'unavailable' as const : 'available' as const, commit: checkoutCommit },
    loadedBuild,
    checkoutMatchesLoaded: checkoutCommit !== null && loadedBuild.sourceSha !== null ? checkoutCommit === loadedBuild.sourceSha : null,
  };
}
