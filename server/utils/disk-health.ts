import childProcess from "node:child_process";

export interface WorkingVolume {
  source: 'df';
  observedAt: string;
  status: 'available' | 'unknown';
  path: string;
  mount: string | null;
  totalBytes: number | null;
  usedBytes: number | null;
  freeBytes: number | null;
  percent: number | null;
}
type DiskHealth = { status: "up" | "warning" | "unknown"; detail?: string; volume: WorkingVolume };
let inFlight: Promise<WorkingVolume> | undefined;

/** Share pending work only: subsequent observations must probe again. */
export function readWorkingVolumeObservation(): Promise<WorkingVolume> {
  if (!inFlight) {
    inFlight = Promise.resolve().then(probeWorkingVolume).finally(() => { inFlight = undefined; });
  }
  return inFlight;
}

export async function readWorkingVolumeDiskHealth(): Promise<DiskHealth> {
  const volume = await readWorkingVolumeObservation();
  return volume.percent === null ? { status: 'unknown', volume }
    : { status: volume.percent < 90 ? 'up' : 'warning', detail: `${volume.percent}%`, volume };
}

async function probeWorkingVolume(): Promise<WorkingVolume> {
  const workingPath = process.cwd();
  const unknown = (): WorkingVolume => ({ source: 'df', observedAt: new Date().toISOString(), status: 'unknown',
    path: workingPath, mount: null, totalBytes: null, usedBytes: null, freeBytes: null, percent: null });
  try {
    const output = await new Promise<string>((resolve, reject) => {
      childProcess.execFile('df', ['-k', workingPath],
        { timeout: 3000, maxBuffer: 64 * 1024, encoding: 'utf8' },
        (error, stdout) => { if (error) reject(error); else resolve(stdout); });
    });
    const lines = output.trim().split(/\r?\n/);
    if (lines.length < 2) return unknown();
    // macOS adds inode columns between capacity and mount. GNU/BSD headers
    // both retain the first byte/capacity columns; keep mount spaces intact.
    const row = lines.at(-1)!.trim();
    const match = row.match(/^\S+\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d{1,3})%\s+(.+)$/);
    if (!match) return unknown();
    const [totalBytes, usedBytes, freeBytes] = match.slice(1, 4).map(value => Number(value) * 1024);
    const percent = Number(match[4]);
    const mount = /%iused|IUse%/.test(lines[0]!) ? match[5]!.replace(/^\d+\s+\d+\s+\d+%\s+/, '') : match[5]!;
    if (![totalBytes, usedBytes, freeBytes].every(value => Number.isSafeInteger(value) && value! >= 0)
      || !totalBytes || usedBytes! > totalBytes || freeBytes! > totalBytes || percent > 100 || !mount.startsWith('/')) return unknown();
    return { source: 'df', observedAt: new Date().toISOString(), status: 'available', path: workingPath,
      mount, totalBytes: totalBytes!, usedBytes: usedBytes!, freeBytes: freeBytes!, percent };
  } catch { return unknown(); }
}
