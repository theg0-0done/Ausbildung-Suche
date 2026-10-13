import { describe, expect, it } from 'vitest';
import {
  applyFiltersToUrl,
  buildSearchParams,
  countActiveFilters,
  parseFiltersFromSearch,
  toggleListValue,
} from './filters';

describe('buildSearchParams', () => {
  it('defaults to Ausbildung and the page size', () => {
    const p = buildSearchParams({});
    expect(p.get('angebotsart')).toBe('4');
    expect(p.get('page')).toBe('1');
    expect(p.get('size')).toBe('100');
  });

  it('never sends empty or whitespace-only values (the API answers them with 400)', () => {
    const p = buildSearchParams({ was: '  ', wo: '', umkreis: '', arbeitszeit: [], ausbildungsart: '' });
    expect([...p.keys()].sort()).toEqual(['angebotsart', 'page', 'size']);
  });

  it('trims values and joins arbeitszeit with semicolons', () => {
    const p = buildSearchParams({ was: ' Koch ', arbeitszeit: ['vz', 'tz'], schulbildung: '3' }, 2, 50);
    expect(p.get('was')).toBe('Koch');
    expect(p.get('arbeitszeit')).toBe('vz;tz');
    expect(p.get('schulbildung')).toBe('3');
    expect(p.get('page')).toBe('2');
    expect(p.get('size')).toBe('50');
  });
});

describe('URL round trip', () => {
  it('parses what it writes', () => {
    const filters = { was: 'Koch', wo: 'Berlin', arbeitszeit: ['vz', 'ho'], behinderung: 'true' };
    const url = new URL('https://x.test/?refnr=123');
    applyFiltersToUrl(url, filters);
    expect(url.searchParams.get('refnr')).toBe('123');
    expect(parseFiltersFromSearch(url.search)).toEqual(filters);
  });

  it('removes filters that were cleared', () => {
    const url = new URL('https://x.test/?was=Koch&arbeitszeit=vz');
    applyFiltersToUrl(url, {});
    expect(url.search).toBe('');
  });
});

describe('countActiveFilters', () => {
  it('ignores the search bar fields and the default offer type', () => {
    expect(countActiveFilters({ was: 'a', wo: 'b', angebotsart: '4' })).toBe(0);
  });

  it('counts every selected option', () => {
    expect(countActiveFilters({ arbeitszeit: ['vz', 'tz'], schulbildung: '3', angebotsart: '1' })).toBe(4);
  });
});

describe('multi-value filters', () => {
  it('joins selected start months and professions with semicolons', () => {
    const p = buildSearchParams({
      eintrittsdatum: ['26_10_01-26_11_01', '26_11_01-26_12_01'],
      beruf: ['Koch/Köchin', 'Bäcker/in'],
      berufsfeld: ['Gastronomie'],
    });
    expect(p.get('eintrittsdatum')).toBe('26_10_01-26_11_01;26_11_01-26_12_01');
    expect(p.get('beruf')).toBe('Koch/Köchin;Bäcker/in');
    expect(p.get('berufsfeld')).toBe('Gastronomie');
  });

  it('sends only the widest "published since" range (ranges are nested, the API rejects several)', () => {
    expect(buildSearchParams({ veroeffentlichtseit: ['1', '28', '7'] }).get('veroeffentlichtseit')).toBe('28');
    expect(buildSearchParams({ veroeffentlichtseit: ['0'] }).get('veroeffentlichtseit')).toBe('0');
  });

  it('round-trips lists through the URL', () => {
    const filters = { beruf: ['A/B', 'C'], veroeffentlichtseit: ['7', '14'] };
    const url = new URL('https://x.test/');
    applyFiltersToUrl(url, filters);
    expect(parseFiltersFromSearch(url.search)).toEqual(filters);
  });

  it('toggles values and drops an emptied filter', () => {
    const added = toggleListValue({}, 'beruf', 'Koch');
    expect(added.beruf).toEqual(['Koch']);
    expect(toggleListValue(added, 'beruf', 'Bäcker').beruf).toEqual(['Koch', 'Bäcker']);
    expect(toggleListValue(added, 'beruf', 'Koch')).toEqual({});
  });

  it('counts every selected value', () => {
    expect(countActiveFilters({ beruf: ['a', 'b'], eintrittsdatum: ['x'] })).toBe(3);
  });
});
