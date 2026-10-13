import { describe, expect, it } from 'vitest';
import { parseSearchResponse } from './schemas';

describe('parseSearchResponse', () => {
  it('parses a v6 response with facets and woOutput', () => {
    const res = parseSearchResponse({
      ergebnisliste: [{ referenznummer: 'a-1', firma: 'X' }],
      maxErgebnisse: 5,
      page: 1,
      size: 100,
      facetten: { arbeitszeit: { counts: { vz: 4 }, maxCount: 4 } },
      woOutput: { suchmodus: 'UMKREISSUCHE', bereinigterOrt: 'Berlin' },
    });
    expect(res.ergebnisliste).toHaveLength(1);
    expect(res.facetten?.arbeitszeit?.counts.vz).toBe(4);
    expect(res.woOutput?.bereinigterOrt).toBe('Berlin');
  });

  it('tolerates empty results (no list, string numbers)', () => {
    const res = parseSearchResponse({ maxErgebnisse: '0', page: '1', size: '25' });
    expect(res.ergebnisliste).toEqual([]);
    expect(res.maxErgebnisse).toBe(0);
  });

  it('rejects items without a reference number', () => {
    expect(() => parseSearchResponse({ ergebnisliste: [{ firma: 'X' }] })).toThrow();
  });
});
