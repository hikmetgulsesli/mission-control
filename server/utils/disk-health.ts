import childProcess from "node:child_process";

type DiskHealth = { status: "up" | "warning" | "unknown"; detail?: string };

/** Observe the service's working volume, not macOS's separate read-only root. */
export async function readWorkingVolumeDiskHealth(): Promise<DiskHealth> {
  try {
    const output = await new Promise<string>((resolve, reject) => {
      childProcess.execFile(
        "df", ["-k", process.cwd()],
        { timeout: 3000, maxBuffer: 64 * 1024, encoding: "utf8" },
        (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout);
        },
      );
    });
    const row = output.trim().split(/\r?\n/).pop() || "";
    const percentText = row.split(/\s+/)[4] || "";
    if (!/^\d{1,3}%$/.test(percentText)) return { status: "unknown" };
    const percent = Number(percentText.slice(0, -1));
    if (percent > 100) return { status: "unknown" };
    return { status: percent < 90 ? "up" : "warning", detail: percentText };
  } catch {
    return { status: "unknown" };
  }
}
