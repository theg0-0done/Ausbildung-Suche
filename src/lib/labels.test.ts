import { describe, expect, it } from 'vitest';
import type { JobSearchItem } from '../types';
import { describeWoOutput, formatEintrittsdatumKey, getPayLabel } from './labels';

const job = (extra: Partial<JobSearchItem>): JobSearchItem => ({ referenznummer: 'x', ...extra });

describe('formatEintrittsdatumKey', () => {
  it('formats month ranges', () => {
    expect(formatEintrittsdatumKey('26_10_01-26_11_01')).toBe('Okt 2026');
    expect(formatEintrittsdatumKey('27_03_01-27_04_01')).toBe('Mär 2027');
  });

  it('handles the open-ended bucket and unknown input', () => {
    expect(formatEintrittsdatumKey('10_01_01-now')).toBe('Sofort / bereits begonnen');
    expect(formatEintrittsdatumKey('weird')).toBe('weird');
  });
});

describe('getPayLabel', () => {
  it('shows the training pay range', () => {
    const label = getPayLabel(
      job({ ausbildungsverguetungJahr1: 1079, ausbildungsverguetungJahr2: 1107, ausbildungsverguetungJahr3: 1164 })
    );
    expect(label).toContain('1.079');
    expect(label).toContain('1.164');
    expect(label).toContain('/ Monat');
  });

  it('collapses equal years and falls back to salary fields', () => {
    expect(getPayLabel(job({ ausbildungsverguetungJahr1: 900, ausbildungsverguetungJahr2: 900 }))).toBe('900 € / Monat');
    expect(getPayLabel(job({ festgehalt: 74811 }))).toContain('74.811');
  });

  it('is empty without figures', () => {
    expect(getPayLabel(job({}))).toBe('');
  });
});

describe('describeWoOutput', () => {
  it('returns nothing without a typed place', () => {
    expect(describeWoOutput({ suchmodus: 'UMKREISSUCHE', bereinigterOrt: 'Berlin' }, '')).toBeNull();
  });

  it('warns about unknown places', () => {
    expect(describeWoOutput({ suchmodus: 'UNGUELTIG' }, 'Qwertz')?.tone).toBe('warn');
  });

  it('announces a corrected place name', () => {
    const note = describeWoOutput({ suchmodus: 'UMKREISSUCHE', bereinigterOrt: 'Berlin' }, 'Berlni', '25');
    expect(note?.text).toContain('Berlin');
    expect(note?.text).toContain('Berlni');
    expect(note?.text).toContain('25 km');
  });

  it('describes state searches', () => {
    expect(describeWoOutput({ suchmodus: 'BUNDESLANDSUCHE', bereinigterOrt: 'Bayern' }, 'Bayern')?.text).toBe(
      'Ergebnisse in Bayern'
    );
  });
});
