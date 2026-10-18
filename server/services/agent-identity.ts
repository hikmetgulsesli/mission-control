import { AGENTS_ARRAY, type ModelIdentity } from '../shared/agents.js';

function modelId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value !== 'unknown' ? value : null;
}

/** Pure read-side resolution; never reads config, credentials or ambient paths. */
export function resolveAgentModelIdentity(input: {
  observedModel?: unknown; observedProvider?: unknown;
  configuredModel?: unknown; configuredProvider?: unknown; staticModel?: unknown;
}): ModelIdentity {
  const observedModelId = modelId(input.observedModel);
  const configuredModelId = modelId(input.configuredModel);
  const staticModelId = modelId(input.staticModel);
  const rawModelId = observedModelId ?? configuredModelId ?? staticModelId;
  const explicitProvider = observedModelId ? modelId(input.observedProvider)
    : configuredModelId ? modelId(input.configuredProvider) : null;
  return {
    rawModelId,
    rawProviderId: explicitProvider ?? (rawModelId?.includes('/') ? rawModelId.split('/')[0] : null),
    provenance: observedModelId ? 'observed_session' : configuredModelId ? 'configured' : staticModelId ? 'static_fallback' : 'unknown',
    observedModelId, configuredModelId, staticModelId,
  };
}

export function sessionAgentId(session: any): string | null {
  const id = session?.agent || session?.key?.split(':')?.[1];
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export function sessionTimestamp(session: any): number {
  const value = session?.updatedAt ?? session?.lastActivity;
  const timestamp = typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

/** Union, never a filter: newly observed/configured agents remain discoverable. */
export function resolveAgentRoster(configuredAgents: any[] = [], sessions: any[] = []) {
  const roster = new Map<string, any>(AGENTS_ARRAY.map(agent => [agent.id, {...agent, source:'mission-control-fallback'}]));
  const configured = new Map<string, any>();
  for (const agent of Array.isArray(configuredAgents) ? configuredAgents : []) {
    if (typeof agent?.id !== 'string' || !agent.id) continue;
    configured.set(agent.id, agent);
    roster.set(agent.id, {...roster.get(agent.id), ...agent});
  }
  const observed = new Map<string, any>();
  for (const session of Array.isArray(sessions) ? sessions : []) {
    const id = sessionAgentId(session);
    if (!id) continue;
    if (!roster.has(id)) roster.set(id, {id, name:id});
    const previous = observed.get(id);
    if (modelId(session.model) && (!previous || sessionTimestamp(session) >= sessionTimestamp(previous))) observed.set(id,session);
  }
  return [...roster.values()].map(agent => {
    const id = agent.id;
    const staticAgent = AGENTS_ARRAY.find(entry => entry.id === id);
    const configuration = configured.get(id);
    const session = observed.get(id);
    const modelIdentity = resolveAgentModelIdentity({
      observedModel:session?.model, observedProvider:session?.provider ?? session?.modelProvider,
      configuredModel: typeof configuration?.model === 'string' ? configuration.model : configuration?.model?.primary,
      configuredProvider:configuration?.provider, staticModel:staticAgent?.model,
    });
    return {...agent, model:modelIdentity.rawModelId ?? 'unknown', modelIdentity};
  });
}
