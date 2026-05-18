export function normalizeVisibleWorkflowStatus(status: unknown): string {
  const value = String(status || "pending").trim().toLowerCase();
  if (!value) return "pending";
  if (value === "na" || value === "n/a" || value === "not_applicable" || value === "none") return "pending";
  if (value === "waiting") return "pending";
  if (value === "skipped" || value === "skip") return "failed";
  return value;
}

export function normalizeVisibleContractStatus(status: unknown): string {
  const value = String(status || "pending").trim().toLowerCase();
  if (!value) return "pending";
  if (value === "na" || value === "n/a" || value === "not_applicable" || value === "none") return "pending";
  if (value === "skipped" || value === "skip") return "fail";
  return value;
}

export function visibleStatusLabel(status: unknown): string {
  return normalizeVisibleWorkflowStatus(status).toUpperCase();
}

export function normalizeVisibleText(value: unknown): string {
  return String(value ?? "")
    .replace(/(^|[^A-Za-z0-9])N\/A(?=$|[^A-Za-z0-9])/gi, "$1Pending")
    .replace(/(^|[^A-Za-z0-9])not[_ -]?applicable(?=$|[^A-Za-z0-9])/gi, "$1pending")
    .replace(/\bskipped\b/gi, "failed");
}

export function normalizeVisibleVisualStatus(status: unknown): "pass" | "fail" | "missing" {
  const value = String(status || "missing").trim().toLowerCase();
  if (value === "pass") return "pass";
  if (value === "fail" || value === "failed" || value === "skipped" || value === "skip") return "fail";
  return "missing";
}
