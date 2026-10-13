/**
 * Which link "Jetzt bewerben" and the employer card should use.
 *
 * The API fills `allianzpartnerUrl` with "arbeitsagentur.de" for offers the Arbeitsagentur publishes
 * itself, which would send people to the site's start page. Those links are not a company URL, so they
 * are skipped and the offer page on arbeitsagentur.de is used instead.
 */

/** The API sometimes returns bare hosts like "www.firma.de" – make them absolute. */
export function toAbsoluteUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

export function isArbeitsagenturUrl(url: string): boolean {
  try {
    const host = new URL(toAbsoluteUrl(url)).hostname.toLowerCase();
    return host === 'arbeitsagentur.de' || host.endsWith('.arbeitsagentur.de');
  } catch {
    return false;
  }
}

/** First candidate that is a real http(s) URL and does not point at arbeitsagentur.de; otherwise null. */
export function pickCompanyUrl(candidates: readonly unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || candidate.trim() === '') continue;
    const trimmed = candidate.trim();
    // "javascript:", "mailto:" … are not links to a site
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:/i.test(trimmed)) continue;
    const absolute = toAbsoluteUrl(trimmed);
    try {
      const { protocol } = new URL(absolute);
      if (protocol !== 'http:' && protocol !== 'https:') continue;
    } catch {
      continue;
    }
    if (isArbeitsagenturUrl(absolute)) continue;
    return absolute;
  }
  return null;
}

/** The employer's own apply link when the offer has one, otherwise the offer's page on arbeitsagentur.de. */
export function resolveApplyUrl(candidates: readonly unknown[], offerUrl: string): string {
  return pickCompanyUrl(candidates) ?? offerUrl;
}
