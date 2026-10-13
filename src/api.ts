import type { SearchResponse, JobDetail, JobFilters, JobSearchItem } from './types';
import { parseSearchResponse } from './schemas';
import { buildSearchParams, PAGE_SIZE } from './lib/filters';

const PROXY_BASE = '/api/jobboerse/jobsuche-service';
const SEARCH_VERSION = 'v6';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function failWith(res: Response, what: string, url: string): Promise<never> {
  const body = (await res.text().catch(() => '')).slice(0, 200);
  console.error(`${what} failed`, res.status, url, body);
  throw new ApiError(`${what} failed: ${res.status} ${res.statusText}${body ? ` – ${body}` : ''}`, res.status);
}

/**
 * Search for Ausbildung (apprenticeship) offers using full filters.
 * Pass an AbortSignal so a newer search can cancel an older one.
 */
export async function searchAusbildungen(
  filters: JobFilters,
  page = 1,
  size = PAGE_SIZE,
  signal?: AbortSignal
): Promise<SearchResponse> {
  const url = `${PROXY_BASE}/pc/${SEARCH_VERSION}/jobs?${buildSearchParams(filters, page, size)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return failWith(res, 'Search', url);
  return parseSearchResponse(await res.json());
}

/** Other Ausbildung offers of the same employer (exact employer name), without the current one. */
export async function fetchEmployerJobs(
  employer: string,
  excludeRefnr: string,
  signal?: AbortSignal
): Promise<JobSearchItem[]> {
  const data = await searchAusbildungen({ arbeitgeber: employer }, 1, 7, signal);
  return data.ergebnisliste.filter((j) => j.referenznummer !== excludeRefnr).slice(0, 6);
}

/**
 * Fetch the full job detail by refnr.
 * The /pc/v4/jobdetails/ endpoint expects a Base64-encoded refnr as the path.
 */
export async function fetchJobDetail(refnr: string, signal?: AbortSignal): Promise<JobDetail> {
  const encoded = btoa(refnr);
  const url = `${PROXY_BASE}/pc/v4/jobdetails/${encodeURIComponent(encoded)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) return failWith(res, 'Detail fetch', url);
  return res.json();
}

/**
 * Builds the employer logo URL from the kundennummerHash.
 * Uses the ag-darstellung-service via the Vite proxy.
 */
export function getLogoUrl(hash: string): string {
  return `/api/vermittlung/ag-darstellung-service/ct/v1/arbeitgeberlogo/${encodeURIComponent(hash)}`;
}

/**
 * Builds the public Arbeitsagentur job listing URL from a refnr.
 */
export function getJobUrl(refnr: string): string {
  // /suche?id=… only opens the generic result list; /jobdetail/… is the offer itself
  return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(refnr)}`;
}
