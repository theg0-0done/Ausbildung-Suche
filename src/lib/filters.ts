import type { JobFilters } from '../types';

/** String-valued filters that map 1:1 to a URL / API query parameter. */
export const STRING_FILTER_KEYS = [
  'was',
  'wo',
  'umkreis',
  'angebotsart',
  'befristung',
  'arbeitgeber',
  'zeitarbeit',
  'pav',
  'behinderung',
  'schulbildung',
  'externestellenboersen',
  'ausbildungsart',
] as const satisfies readonly (keyof JobFilters)[];

/** Filters that accept several values (sent semicolon-separated). */
export const LIST_FILTER_KEYS = [
  'arbeitszeit',
  'berufsfeld',
  'beruf',
  'eintrittsdatum',
  'veroeffentlichtseit',
] as const satisfies readonly (keyof JobFilters)[];

/** Filters applied in the browser; they are never sent to the API. */
export const CLIENT_FILTER_KEYS = ['minVerguetung', 'mitEmail'] as const satisfies readonly (keyof JobFilters)[];

export type ListFilterKey = (typeof LIST_FILTER_KEYS)[number];

type StringFilterKey = (typeof STRING_FILTER_KEYS)[number] | (typeof CLIENT_FILTER_KEYS)[number];

/** The API caps page × size at roughly 10,000 hits. */
export const MAX_REACHABLE_RESULTS = 10_000;
export const PAGE_SIZE = 100;

/**
 * "Published since N days" ranges are nested (today ⊂ 7 days ⊂ 28 days) and the API rejects
 * several values, so the union of the selected ranges is simply the widest one.
 */
function widestDays(values: string[]): string | undefined {
  const nums = values.map(Number).filter((n) => Number.isFinite(n));
  return nums.length > 0 ? String(Math.max(...nums)) : undefined;
}

/** Build the v6 query string. Empty values must never be sent: the API answers them with a 400. */
export function buildSearchParams(filters: JobFilters, page = 1, size = PAGE_SIZE): URLSearchParams {
  const params = new URLSearchParams({
    angebotsart: filters.angebotsart || '4',
    page: String(page),
    size: String(size),
  });

  for (const key of STRING_FILTER_KEYS) {
    if (key === 'angebotsart') continue;
    const value = filters[key]?.trim();
    if (value) params.set(key, value);
  }

  for (const key of LIST_FILTER_KEYS) {
    const values = (filters[key] ?? []).map((v) => v.trim()).filter(Boolean);
    if (values.length === 0) continue;
    if (key === 'veroeffentlichtseit') {
      const days = widestDays(values);
      if (days) params.set(key, days);
    } else {
      params.set(key, values.join(';'));
    }
  }

  return params;
}

export function parseFiltersFromSearch(search: string): JobFilters {
  const params = new URLSearchParams(search);
  const filters: JobFilters = {};

  for (const key of [...STRING_FILTER_KEYS, ...CLIENT_FILTER_KEYS]) {
    const value = params.get(key);
    if (value) (filters as Record<StringFilterKey, string | undefined>)[key] = value;
  }

  for (const key of LIST_FILTER_KEYS) {
    const raw = params.get(key);
    const values = raw ? raw.split(';').filter(Boolean) : [];
    if (values.length > 0) filters[key] = values;
  }

  return filters;
}

/** Write filters into a URL (everything else, such as refnr, is left alone). */
export function applyFiltersToUrl(url: URL, filters: JobFilters): void {
  for (const key of [...STRING_FILTER_KEYS, ...CLIENT_FILTER_KEYS]) url.searchParams.delete(key);
  for (const key of LIST_FILTER_KEYS) url.searchParams.delete(key);

  for (const key of [...STRING_FILTER_KEYS, ...CLIENT_FILTER_KEYS]) {
    const value = filters[key]?.trim();
    if (value) url.searchParams.set(key, value);
  }
  for (const key of LIST_FILTER_KEYS) {
    const values = filters[key];
    if (values && values.length > 0) url.searchParams.set(key, values.join(';'));
  }
}

/** Filters the user can toggle in the sidebar, i.e. everything except the two search-bar fields. */
export function countActiveFilters(filters: JobFilters): number {
  let n = 0;
  for (const key of STRING_FILTER_KEYS) {
    if (key === 'was' || key === 'wo') continue;
    if (key === 'angebotsart' && (!filters.angebotsart || filters.angebotsart === '4')) continue;
    if (filters[key]?.trim()) n += 1;
  }
  for (const key of LIST_FILTER_KEYS) n += filters[key]?.length ?? 0;
  for (const key of CLIENT_FILTER_KEYS) if (filters[key] !== undefined) n += 1;
  return n;
}

/** Toggle one value of a multi-value filter; an emptied list removes the filter. */
export function toggleListValue(filters: JobFilters, key: ListFilterKey, value: string): JobFilters {
  const current = filters[key] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const updated: JobFilters = { ...filters };
  if (next.length > 0) updated[key] = next;
  else delete updated[key];
  return updated;
}

/** True when two filter sets send the same request to the API (client-side filters are ignored). */
export function sameServerQuery(a: JobFilters, b: JobFilters): boolean {
  return buildSearchParams(a).toString() === buildSearchParams(b).toString();
}
