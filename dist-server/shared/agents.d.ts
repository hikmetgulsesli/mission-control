/**
 * Centralized agent definitions — single source of truth for all agent metadata.
 * Import from here instead of defining local REAL_AGENTS arrays.
 */
export declare const AGENT_DEFINITIONS: {
    readonly main: {
        readonly name: "Arya";
        readonly emoji: "🦞";
        readonly role: "CEO / Orchestrator";
        readonly model: "minimax-m2.7";
        readonly color: "#ff6600";
    };
    readonly koda: {
        readonly name: "Koda";
        readonly emoji: "🤖";
        readonly role: "Lead Dev";
        readonly model: "kimi-k2p5";
        readonly color: "#00ff41";
    };
    readonly flux: {
        readonly name: "Flux";
        readonly emoji: "⚡";
        readonly role: "Senior Architect";
        readonly model: "kimi-k2p5";
        readonly color: "#00ffff";
    };
    readonly atlas: {
        readonly name: "Atlas";
        readonly emoji: "🌍";
        readonly role: "Infra Lead";
        readonly model: "kimi-k2p5";
        readonly color: "#4488ff";
    };
    readonly iris: {
        readonly name: "Iris";
        readonly emoji: "🔍";
        readonly role: "Research Lead";
        readonly model: "minimax-m2.7";
        readonly color: "#ff44ff";
    };
    readonly sentinel: {
        readonly name: "Sentinel";
        readonly emoji: "🛡️";
        readonly role: "QA Lead";
        readonly model: "minimax-m2.7";
        readonly color: "#ffaa00";
    };
    readonly cipher: {
        readonly name: "Cipher";
        readonly emoji: "💻";
        readonly role: "Backend Dev";
        readonly model: "kimi-k2p5";
        readonly color: "#44ff88";
    };
    readonly lux: {
        readonly name: "Lux";
        readonly emoji: "✍️";
        readonly role: "Content Writer";
        readonly model: "minimax-m2.7";
        readonly color: "#ff8844";
    };
    readonly nexus: {
        readonly name: "Nexus";
        readonly emoji: "🔄";
        readonly role: "SRE / Monitoring";
        readonly model: "minimax-m2.7";
        readonly color: "#8844ff";
    };
    readonly prism: {
        readonly name: "Prism";
        readonly emoji: "🎨";
        readonly role: "UI Designer";
        readonly model: "kimi-k2p5";
        readonly color: "#ff4488";
    };
};
export type AgentId = keyof typeof AGENT_DEFINITIONS;
export declare const REAL_AGENT_IDS: AgentId[];
/** Flat array format (same structure as frontend constants.ts AGENTS) */
export declare const AGENTS_ARRAY: ({
    name: "Arya";
    emoji: "🦞";
    role: "CEO / Orchestrator";
    model: "minimax-m2.7";
    color: "#ff6600";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Koda";
    emoji: "🤖";
    role: "Lead Dev";
    model: "kimi-k2p5";
    color: "#00ff41";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Flux";
    emoji: "⚡";
    role: "Senior Architect";
    model: "kimi-k2p5";
    color: "#00ffff";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Atlas";
    emoji: "🌍";
    role: "Infra Lead";
    model: "kimi-k2p5";
    color: "#4488ff";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Iris";
    emoji: "🔍";
    role: "Research Lead";
    model: "minimax-m2.7";
    color: "#ff44ff";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Sentinel";
    emoji: "🛡️";
    role: "QA Lead";
    model: "minimax-m2.7";
    color: "#ffaa00";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Cipher";
    emoji: "💻";
    role: "Backend Dev";
    model: "kimi-k2p5";
    color: "#44ff88";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Lux";
    emoji: "✍️";
    role: "Content Writer";
    model: "minimax-m2.7";
    color: "#ff8844";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Nexus";
    emoji: "🔄";
    role: "SRE / Monitoring";
    model: "minimax-m2.7";
    color: "#8844ff";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
} | {
    name: "Prism";
    emoji: "🎨";
    role: "UI Designer";
    model: "kimi-k2p5";
    color: "#ff4488";
    id: "main" | "koda" | "flux" | "atlas" | "iris" | "sentinel" | "cipher" | "lux" | "nexus" | "prism";
})[];
/** Map from agent ID to full definition */
export declare const AGENT_MAP: Record<AgentId, (typeof AGENTS_ARRAY)[number]>;
