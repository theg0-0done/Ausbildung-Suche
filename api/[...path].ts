import { proxyRequest } from './_proxy';

// Edge runtime: starts instantly and uses the standard Request/Response API
export const config = { runtime: 'edge' };

export default function handler(req: Request): Promise<Response> {
  return proxyRequest(req);
}
