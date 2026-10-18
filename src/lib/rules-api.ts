export interface RuleCapabilities {
  create: boolean;
  update: boolean;
  delete: boolean;
  import: boolean;
  toggle: boolean;
  reason: string | null;
}

export class RulesApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}

export async function rulesRequest<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, init); }
  catch { throw new RulesApiError(0, 'Rules service could not be reached', 'RULES_NETWORK_ERROR'); }
  let data;
  try { data = await response.json(); }
  catch {
    throw new RulesApiError(response.status, response.ok ? 'Rules service returned an invalid response'
      : `Rules request failed (HTTP ${response.status})`, 'RULES_INVALID_RESPONSE');
  }
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : typeof data?.message === 'string' ? data.message : null;
    throw new RulesApiError(response.status, message?.slice(0, 300) || `Rules request failed (HTTP ${response.status})`,
      typeof data?.code === 'string' ? data.code.slice(0, 80) : undefined);
  }
  return data as T;
}

export async function loadRules<T>(url = '/api/rules'): Promise<T[]> {
  const data = await rulesRequest<unknown>(url);
  if (!Array.isArray(data)) throw new RulesApiError(200, 'Rules service returned an invalid response', 'RULES_INVALID_RESPONSE');
  return data as T[];
}

export function rulesErrorMessage(error: unknown): string {
  if (error instanceof RulesApiError) return error.status ? `HTTP ${error.status}: ${error.message}` : error.message;
  return 'Rules request failed';
}
