/**
 * Cloudflare tunnel & DNS management — handles adding/removing
 * tunnel ingress rules and DNS records for project subdomains.
 */
export declare const TUNNEL_ID = "92d8df83-3623-4850-ba41-29126106d020";
export declare const ZONE_ID = "dcb4b61afa6f4a6bd8c05950381655f2";
export declare const CF_TOKEN = "CP1qBCzEfcwYlFifgNfEiVEye75FWR7Dq_7BEh8O";
/**
 * Add a tunnel ingress rule for the given hostname → port mapping.
 * Also creates the corresponding DNS CNAME record.
 */
export declare function addTunnelIngress(hostname: string, port: number): {
    success: boolean;
    error?: string;
};
/**
 * Remove a tunnel ingress rule for the given hostname.
 */
export declare function removeTunnelIngress(hostname: string): {
    success: boolean;
    error?: string;
};
/**
 * Add a Cloudflare DNS CNAME record pointing to the tunnel.
 */
export declare function addDnsRecord(subdomain: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Remove a Cloudflare DNS record for the given subdomain.
 */
export declare function removeDnsRecord(subdomain: string): Promise<{
    success: boolean;
    error?: string;
}>;
