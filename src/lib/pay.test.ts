import { describe, expect, it } from 'vitest';
import type { JobSearchItem } from '../types';
import { firstYearPay, matchesMinPay } from './pay';

const job = (extra: Partial<JobSearchItem>): JobSearchItem => ({ referenznummer: 'x', ...extra });

describe('firstYearPay', () => {
  it('uses year 1 when stated', () => {
    expect(firstYearPay(job({ ausbildungsverguetungJahr1: 900, ausbildungsverguetungJahr2: 1000 }))).toBe(900);
  });

  it('falls back to the first stated later year', () => {
    expect(firstYearPay(job({ ausbildungsverguetungJahr2: 1000 }))).toBe(1000);
  });

  it('is undefined without figures or with zero', () => {
    expect(firstYearPay(job({}))).toBeUndefined();
    expect(firstYearPay(job({ ausbildungsverguetungJahr1: 0 }))).toBeUndefined();
  });
});

describe('matchesMinPay', () => {
  it('requires stated pay even for a minimum of 0', () => {
    expect(matchesMinPay(job({}), 0)).toBe(false);
    expect(matchesMinPay(job({ ausbildungsverguetungJahr1: 500 }), 0)).toBe(true);
  });

  it('compares against the minimum inclusively', () => {
    expect(matchesMinPay(job({ ausbildungsverguetungJahr1: 1000 }), 1000)).toBe(true);
    expect(matchesMinPay(job({ ausbildungsverguetungJahr1: 999 }), 1000)).toBe(false);
  });
});
