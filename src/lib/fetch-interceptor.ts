/**
 * Global fetch interceptor — automatically adds X-MC-Token header
 * to all /api requests. This ensures raw fetch() calls (not using
 * the api client) also send authentication.
 */
const originalFetch = window.fetch.bind(window);

window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;

  if (url.startsWith('/api') || url.includes('/api/')) {
    const token = (document.querySelector('meta[name="mc-token"]') as HTMLMetaElement)?.content || '';
    if (token) {
      const headers = new Headers(init?.headers);
      if (!headers.has('X-MC-Token')) {
        headers.set('X-MC-Token', token);
      }
      init = { ...init, headers };
    }
  }
  return originalFetch(input, init);
};
