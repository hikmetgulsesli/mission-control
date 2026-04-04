/**
 * SSRF Protection — shared utility for URL validation.
 * Blocks internal/private IPs, non-http(s) schemes, IPv6 loopback, etc.
 */

const BLOCKED_HOSTS = [
  '127.0.0.1',
  'localhost',
  '0.0.0.0',
  '169.254.169.254',     // AWS metadata
  '[::1]',               // IPv6 loopback
  '[::ffff:127.0.0.1]',  // IPv6-mapped IPv4 loopback
];

/**
 * Validates a URL for SSRF safety. Returns null if the URL is safe,
 * or an error string describing why it was blocked.
 */
export function checkSsrf(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'Invalid URL';
  }

  // Block non-http(s) schemes
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return `Scheme "${parsed.protocol.replace(':', '')}" not allowed — only http and https`;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Direct blocklist
  if (BLOCKED_HOSTS.includes(hostname)) {
    return 'Internal URLs not allowed';
  }

  // IPv6 loopback variants
  if (hostname.startsWith('[') && (hostname.includes('::1') || hostname.includes('::ffff:127.'))) {
    return 'Internal URLs not allowed';
  }

  // 10.x.x.x
  if (hostname.startsWith('10.')) {
    return 'Internal URLs not allowed';
  }

  // 192.168.x.x
  if (hostname.startsWith('192.168.')) {
    return 'Internal URLs not allowed';
  }

  // 172.16.0.0 – 172.31.255.255 (private range only, not all 172.x)
  const m172 = hostname.match(/^172\.(\d+)\./);
  if (m172) {
    const second = parseInt(m172[1], 10);
    if (second >= 16 && second <= 31) {
      return 'Internal URLs not allowed';
    }
  }

  return null; // safe
}
