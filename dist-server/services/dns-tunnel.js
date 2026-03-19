/**
 * Cloudflare tunnel & DNS management — handles adding/removing
 * tunnel ingress rules and DNS records for project subdomains.
 */
import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
// ── Constants ───────────────────────────────────────────────────────
export const TUNNEL_ID = "92d8df83-3623-4850-ba41-29126106d020";
export const ZONE_ID = "dcb4b61afa6f4a6bd8c05950381655f2";
export const CF_TOKEN = "CP1qBCzEfcwYlFifgNfEiVEye75FWR7Dq_7BEh8O";
const CF_CONFIG_PATH = "/etc/cloudflared/config.yml";
// ── Tunnel ingress management ───────────────────────────────────────
/**
 * Add a tunnel ingress rule for the given hostname → port mapping.
 * Also creates the corresponding DNS CNAME record.
 */
export function addTunnelIngress(hostname, port) {
    try {
        const cfg = readFileSync(CF_CONFIG_PATH, "utf-8");
        const domain = hostname.includes(".") ? hostname : hostname + ".setrox.com.tr";
        if (cfg.includes(domain)) {
            return { success: true }; // Already exists
        }
        const entry = `- hostname: ${domain}\n  service: http://127.0.0.1:${port}\n`;
        // Match catch-all with any indent (or none)
        const updated = cfg.replace(/^(\s*)- service: http_status:404/m, entry + "$1- service: http_status:404");
        writeFileSync("/tmp/cloudflared-config.yml", updated);
        execFileSync("sudo", ["cp", "/tmp/cloudflared-config.yml", CF_CONFIG_PATH], {
            timeout: 5000,
        });
        execFileSync("sudo", ["systemctl", "restart", "cloudflared"], {
            timeout: 15000,
        });
        // Add DNS record
        try {
            execFileSync("sudo", ["cloudflared", "tunnel", "route", "dns", TUNNEL_ID, domain], { timeout: 15000 });
        }
        catch (e) {
            console.warn("[dns-tunnel] DNS route failed:", e?.message || e);
        }
        return { success: true };
    }
    catch (err) {
        console.error("[dns-tunnel] addTunnelIngress failed:", err.message);
        return { success: false, error: err.message };
    }
}
/**
 * Remove a tunnel ingress rule for the given hostname.
 */
export function removeTunnelIngress(hostname) {
    try {
        const cfg = readFileSync(CF_CONFIG_PATH, "utf-8");
        const domain = hostname.includes(".") ? hostname : hostname + ".setrox.com.tr";
        if (!cfg.includes(domain)) {
            return { success: true }; // Already removed
        }
        // Remove the hostname + service lines
        const lines = cfg.split("\n");
        const filtered = [];
        let skipNext = false;
        for (const line of lines) {
            if (skipNext) {
                skipNext = false;
                continue;
            }
            if (line.includes("hostname: " + domain)) {
                skipNext = true; // Skip the next line (service:)
                continue;
            }
            filtered.push(line);
        }
        writeFileSync("/tmp/cloudflared-config.yml", filtered.join("\n"));
        execFileSync("sudo", ["cp", "/tmp/cloudflared-config.yml", CF_CONFIG_PATH], {
            timeout: 5000,
        });
        execFileSync("sudo", ["systemctl", "restart", "cloudflared"], {
            timeout: 15000,
        });
        return { success: true };
    }
    catch (err) {
        console.error("[dns-tunnel] removeTunnelIngress failed:", err.message);
        return { success: false, error: err.message };
    }
}
/**
 * Add a Cloudflare DNS CNAME record pointing to the tunnel.
 */
export async function addDnsRecord(subdomain) {
    const domain = subdomain.includes(".")
        ? subdomain
        : subdomain + ".setrox.com.tr";
    try {
        execFileSync("sudo", ["cloudflared", "tunnel", "route", "dns", TUNNEL_ID, domain], { timeout: 15000 });
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
/**
 * Remove a Cloudflare DNS record for the given subdomain.
 */
export async function removeDnsRecord(subdomain) {
    const name = subdomain.includes(".")
        ? subdomain
        : subdomain + ".setrox.com.tr";
    try {
        // Use Cloudflare API to find and delete the record
        const listResult = execFileSync("curl", [
            "-s",
            "-X", "GET",
            `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=${name}`,
            "-H", `Authorization: Bearer ${CF_TOKEN}`,
            "-H", "Content-Type: application/json",
        ], { timeout: 10000, encoding: "utf-8" });
        const data = JSON.parse(listResult);
        if (data.result && data.result.length > 0) {
            for (const record of data.result) {
                execFileSync("curl", [
                    "-s",
                    "-X", "DELETE",
                    `https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${record.id}`,
                    "-H", `Authorization: Bearer ${CF_TOKEN}`,
                ], { timeout: 10000 });
            }
        }
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
