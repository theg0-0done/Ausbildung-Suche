/**
 * Proxy to the public Arbeitsagentur API (shared by the Vercel function).
 *
 * The browser cannot call rest.arbeitsagentur.de directly (CORS, API key header), so /api/* is
 * forwarded here. Only the two service paths the app uses are allowed, only GET/HEAD, and only
 * a few harmless request headers are passed on: forwarding the browser's cookies made the
 * upstream Tomcat answer "400 Bad Request" whenever they grew large.
 *
 * Files starting with "_" are not deployed as functions by Vercel.
 */

const UPSTREAM = 'https://rest.arbeitsagentur.de';
const API_KEY = 'jobboerse-jobsuche';

const ALLOWED_PREFIXES = ['/jobboerse/jobsuche-service/', '/vermittlung/ag-darstellung-service/'];
const FORWARDED_REQUEST_HEADERS = ['accept', 'accept-language', 'user-agent'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'last-modified'];

function json(status: number, body: Record<string, string>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Where the request should go upstream.
 *
 * On Vercel the rewrite in vercel.json delivers the original path as ?path=a/b/c (a catch-all
 * function file only matches one path segment there). Plain /api/… URLs also work, which keeps
 * the handler testable. Segments are decoded and encoded again so "%3D" (the padding of the
 * Base64 job id) comes out identical whether or not the platform decoded it on the way.
 * "." and ".." segments are refused.
 */
export function resolveTarget(url: URL): { path: string; search: string } | null {
  let rawPath: string;
  const forwarded = url.searchParams.get('path');
  if (forwarded !== null) {
    url.searchParams.delete('path');
    rawPath = `/${forwarded}`;
  } else {
    rawPath = url.pathname.replace(/^\/api/, '');
  }

  const segments = rawPath.split('/').map(safeDecode);
  if (segments.some((s) => s === '.' || s === '..')) return null;

  return { path: segments.map(encodeURIComponent).join('/'), search: url.search };
}

export async function proxyRequest(req: Request, upstreamFetch: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
  }

  const target = resolveTarget(new URL(req.url));
  if (!target || !ALLOWED_PREFIXES.some((prefix) => target.path.startsWith(prefix))) {
    return json(404, { error: 'Not found' });
  }
  const apiPath = target.path;
  const search = target.search;

  const headers = new Headers({ 'X-API-Key': API_KEY });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await upstreamFetch(`${UPSTREAM}${apiPath}${search}`, { method: req.method, headers });

    const responseHeaders = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return json(502, { error: 'Proxy request failed', details: String(error) });
  }
}
