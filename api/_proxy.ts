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

export async function proxyRequest(req: Request, upstreamFetch: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return json(405, { error: 'Method not allowed' }, { Allow: 'GET, HEAD' });
  }

  const url = new URL(req.url);
  const apiPath = url.pathname.replace(/^\/api/, '');
  if (!ALLOWED_PREFIXES.some((prefix) => apiPath.startsWith(prefix))) {
    return json(404, { error: 'Not found' });
  }

  const headers = new Headers({ 'X-API-Key': API_KEY });
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }

  try {
    const response = await upstreamFetch(`${UPSTREAM}${apiPath}${url.search}`, { method: req.method, headers });

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
