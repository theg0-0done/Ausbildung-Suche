import { describe, expect, it, vi } from 'vitest';
import { proxyRequest } from './_proxy';

const ok = () => new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json', 'set-cookie': 'a=b' } });

describe('proxyRequest', () => {
  it('forwards a search to the v6 endpoint with the API key', async () => {
    const upstream = vi.fn().mockResolvedValue(ok());
    const res = await proxyRequest(
      new Request('https://app.test/api/jobboerse/jobsuche-service/pc/v6/jobs?angebotsart=4&page=1'),
      upstream
    );

    expect(res.status).toBe(200);
    const [url, init] = upstream.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?angebotsart=4&page=1');
    expect(new Headers(init.headers).get('x-api-key')).toBe('jobboerse-jobsuche');
  });

  it('never passes cookies or other browser headers upstream (oversized cookies cause a 400)', async () => {
    const upstream = vi.fn().mockResolvedValue(ok());
    await proxyRequest(
      new Request('https://app.test/api/jobboerse/jobsuche-service/pc/v6/jobs', {
        headers: { cookie: 'x='.padEnd(9000, 'y'), authorization: 'Bearer secret', accept: 'application/json', 'user-agent': 'UA' },
      }),
      upstream
    );

    const headers = new Headers((upstream.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('user-agent')).toBe('UA');
  });

  it('does not leak upstream cookies to the browser', async () => {
    const upstream = vi.fn().mockResolvedValue(ok());
    const res = await proxyRequest(new Request('https://app.test/api/jobboerse/jobsuche-service/pc/v6/jobs'), upstream);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('content-type')).toBe('application/json');
  });

  it('serves employer logos from the ag-darstellung service', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('img', { headers: { 'content-type': 'image/webp' } }));
    const res = await proxyRequest(
      new Request('https://app.test/api/vermittlung/ag-darstellung-service/ct/v1/arbeitgeberlogo/abc%3D'),
      upstream
    );
    expect((upstream.mock.calls[0] as [string])[0]).toBe(
      'https://rest.arbeitsagentur.de/vermittlung/ag-darstellung-service/ct/v1/arbeitgeberlogo/abc%3D'
    );
    expect(res.headers.get('content-type')).toBe('image/webp');
  });

  it('refuses other hosts paths, so it is not an open relay', async () => {
    const upstream = vi.fn();
    const res = await proxyRequest(new Request('https://app.test/api/some/other/service'), upstream);
    expect(res.status).toBe(404);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('refuses methods other than GET and HEAD', async () => {
    const upstream = vi.fn();
    const res = await proxyRequest(
      new Request('https://app.test/api/jobboerse/jobsuche-service/pc/v6/jobs', { method: 'POST' }),
      upstream
    );
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('GET, HEAD');
    expect(upstream).not.toHaveBeenCalled();
  });

  it('answers 502 when the upstream is unreachable', async () => {
    const upstream = vi.fn().mockRejectedValue(new Error('network down'));
    const res = await proxyRequest(new Request('https://app.test/api/jobboerse/jobsuche-service/pc/v6/jobs'), upstream);
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('Proxy request failed');
  });
});
