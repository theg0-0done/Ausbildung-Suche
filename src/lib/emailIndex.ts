import { ApiError, fetchJobDetail } from '../api';
import { extractEmails } from './contact';

/** reference number -> e-mail addresses found in the job description. Lives for the page session. */
const cache = new Map<string, string[]>();

export function getCachedEmails(refnr: string): string[] | undefined {
  return cache.get(refnr);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
}

const MAX_RETRIES = 3;

/**
 * Loads the full job description and extracts its e-mail addresses (cached).
 * The API answers bursts with 429, so those are retried with a growing pause.
 */
export async function loadEmails(refnr: string, signal: AbortSignal): Promise<string[]> {
  const hit = cache.get(refnr);
  if (hit) return hit;

  for (let attempt = 0; ; attempt += 1) {
    try {
      const detail = await fetchJobDetail(refnr, signal);
      const emails = extractEmails(detail.stellenangebotsBeschreibung);
      cache.set(refnr, emails);
      return emails;
    } catch (err) {
      if (signal.aborted) throw err;
      if (err instanceof ApiError && err.status === 429 && attempt < MAX_RETRIES) {
        await sleep(2500 * (attempt + 1), signal);
        continue;
      }
      return []; // unreadable offer: treat as "no address", do not cache so a later run may retry
    }
  }
}
