import type { JobSearchItem, WoOutput } from '../types';

export const ANGEBOTSART_OPTIONS = [
  { value: '1', label: 'Arbeit' },
  { value: '2', label: 'Selbständigkeit' },
  { value: '4', label: 'Ausbildung / Duales Studium' },
  { value: '34', label: 'Praktikum / Trainee' },
];

export const AUSBILDUNGSART_OPTIONS = [
  { value: '0', label: 'Ausbildung' },
  { value: '1', label: 'Duales Studium (ausbildungsintegrierend)' },
  { value: '2', label: 'Duales Studium (praxisintegrierend)' },
];

export const ARBEITSZEIT_OPTIONS = [
  { value: 'vz', label: 'Vollzeit' },
  { value: 'tz', label: 'Teilzeit' },
  { value: 'snw', label: 'Schicht / Nacht / Wochenende' },
  { value: 'ho', label: 'Heim- / Telearbeit' },
  { value: 'mj', label: 'Minijob' },
];

export const VEROEFFENTLICHT_OPTIONS = [
  { value: '0', label: 'Heute' },
  { value: '1', label: 'Seit 24 Stunden' },
  { value: '7', label: 'Seit 7 Tagen' },
  { value: '14', label: 'Seit 14 Tagen' },
  { value: '28', label: 'Seit 28 Tagen' },
];

/** Verified against real listings: the filter returns offers open to someone holding that level. */
export const SCHULBILDUNG_OPTIONS = [
  { value: '1', label: 'Ohne Schulabschluss' },
  { value: '2', label: 'Hauptschulabschluss' },
  { value: '3', label: 'Mittlere Reife' },
  { value: '4', label: 'Fachhochschulreife' },
  { value: '5', label: 'Abitur' },
];

export const BEFRISTUNG_OPTIONS = [
  { value: '1', label: 'Befristet' },
  { value: '2', label: 'Unbefristet' },
];

export const UMKREIS_OPTIONS = ['5', '10', '20', '25', '50', '100', '200'];

const MONTHS_SHORT = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

/**
 * Turns a start-date facet key into a label.
 * "26_10_01-26_11_01" -> "Okt 2026", "10_01_01-now" -> "Sofort / bereits begonnen".
 */
export function formatEintrittsdatumKey(key: string): string {
  if (key.endsWith('-now')) return 'Sofort / bereits begonnen';
  const match = /^(\d{2})_(\d{2})_\d{2}-/.exec(key);
  if (!match) return key;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return key;
  return `${MONTHS_SHORT[month - 1]} 20${match[1]}`;
}

export function formatEuro(n: number): string {
  return `${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })} €`;
}

/** Short pay line for a card, or '' when the listing names no figure. */
export function getPayLabel(job: JobSearchItem): string {
  const years = [
    job.ausbildungsverguetungJahr1,
    job.ausbildungsverguetungJahr2,
    job.ausbildungsverguetungJahr3,
    job.ausbildungsverguetungJahr4,
  ].filter((v): v is number => typeof v === 'number' && v > 0);

  if (years.length > 1) {
    const min = Math.min(...years);
    const max = Math.max(...years);
    return min === max ? `${formatEuro(min)} / Monat` : `${formatEuro(min)} – ${formatEuro(max)} / Monat`;
  }
  if (years.length === 1) return `${formatEuro(years[0])} / Monat`;

  if (typeof job.gehaltsspanneVon === 'number' && typeof job.gehaltsspanneBis === 'number') {
    return `${formatEuro(job.gehaltsspanneVon)} – ${formatEuro(job.gehaltsspanneBis)}`;
  }
  if (typeof job.festgehalt === 'number' && job.festgehalt > 0) return formatEuro(job.festgehalt);
  return '';
}

export interface LocationNote {
  tone: 'info' | 'warn';
  text: string;
}

/** Explains how the API understood the "wo" field. `typed` is what the user entered. */
export function describeWoOutput(wo: WoOutput | undefined, typed: string | undefined, radius?: string): LocationNote | null {
  const query = typed?.trim();
  if (!query || !wo) return null;

  if (wo.suchmodus === 'UNGUELTIG') {
    return { tone: 'warn', text: `Den Ort „${query}“ kennen wir nicht. Prüfe die Schreibweise oder nutze eine PLZ.` };
  }

  const place = wo.bereinigterOrt;
  if (!place) return null;

  if (wo.suchmodus === 'BUNDESLANDSUCHE') {
    return { tone: 'info', text: `Ergebnisse in ${place}` };
  }

  const where = radius ? `im Umkreis von ${radius} km um ${place}` : `in der Nähe von ${place}`;
  if (place.toLowerCase() !== query.toLowerCase()) {
    return { tone: 'info', text: `Ergebnisse für „${place}“ (statt „${query}“), ${where}` };
  }
  return { tone: 'info', text: `Ergebnisse ${where}` };
}
