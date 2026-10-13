import { proxyRequest } from './_proxy';

// Edge runtime: starts instantly and uses the standard Request/Response API.
// vercel.json rewrites /api/* here and passes the original path as ?path=…
export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return proxyRequest(req);
}
