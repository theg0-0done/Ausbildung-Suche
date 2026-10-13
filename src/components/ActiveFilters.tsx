import type { JobFilters } from '../types';
import {
  ANGEBOTSART_OPTIONS,
  ARBEITSZEIT_OPTIONS,
  AUSBILDUNGSART_OPTIONS,
  BEFRISTUNG_OPTIONS,
  SCHULBILDUNG_OPTIONS,
  VEROEFFENTLICHT_OPTIONS,
  formatEintrittsdatumKey,
} from '../lib/labels';

interface ActiveFiltersProps {
  filters: JobFilters;
  onRemove: (key: keyof JobFilters, value?: string) => void;
  onClearAll: () => void;
}

interface Chip {
  key: keyof JobFilters;
  label: string;
  value?: string;
}

function labelOf(options: { value: string; label: string }[], value: string, fallback: string): string {
  return options.find((o) => o.value === value)?.label ?? fallback;
}

function buildChips(filters: JobFilters): Chip[] {
  const chips: Chip[] = [];

  if (filters.was) chips.push({ key: 'was', label: `Was: ${filters.was}` });
  if (filters.wo) chips.push({ key: 'wo', label: `Wo: ${filters.wo}` });
  if (filters.umkreis) chips.push({ key: 'umkreis', label: `+ ${filters.umkreis} km` });

  if (filters.angebotsart && filters.angebotsart !== '4') {
    chips.push({ key: 'angebotsart', label: labelOf(ANGEBOTSART_OPTIONS, filters.angebotsart, 'Angebotsart') });
  }
  if (filters.ausbildungsart) {
    chips.push({ key: 'ausbildungsart', label: labelOf(AUSBILDUNGSART_OPTIONS, filters.ausbildungsart, filters.ausbildungsart) });
  }
  if (filters.schulbildung) {
    chips.push({ key: 'schulbildung', label: labelOf(SCHULBILDUNG_OPTIONS, filters.schulbildung, 'Schulabschluss') });
  }
  for (const v of filters.berufsfeld ?? []) chips.push({ key: 'berufsfeld', value: v, label: v });
  for (const v of filters.beruf ?? []) chips.push({ key: 'beruf', value: v, label: v });
  if (filters.arbeitgeber) chips.push({ key: 'arbeitgeber', label: filters.arbeitgeber });
  for (const v of filters.eintrittsdatum ?? []) {
    chips.push({ key: 'eintrittsdatum', value: v, label: `Beginn: ${formatEintrittsdatumKey(v)}` });
  }
  for (const v of filters.veroeffentlichtseit ?? []) {
    chips.push({ key: 'veroeffentlichtseit', value: v, label: labelOf(VEROEFFENTLICHT_OPTIONS, v, 'Datum') });
  }
  if (filters.befristung) {
    chips.push({ key: 'befristung', label: labelOf(BEFRISTUNG_OPTIONS, filters.befristung, 'Vertrag') });
  }
  for (const az of filters.arbeitszeit ?? []) {
    chips.push({ key: 'arbeitszeit', value: az, label: labelOf(ARBEITSZEIT_OPTIONS, az, az) });
  }
  if (filters.zeitarbeit === 'false') chips.push({ key: 'zeitarbeit', label: 'Ohne Zeitarbeit' });
  if (filters.pav === 'false') chips.push({ key: 'pav', label: 'Ohne private Vermittler' });
  if (filters.externestellenboersen === 'false') {
    chips.push({ key: 'externestellenboersen', label: 'Ohne externe Börsen' });
  }
  if (filters.minVerguetung !== undefined) {
    const min = Number(filters.minVerguetung);
    chips.push({
      key: 'minVerguetung',
      label: min > 0 ? `Vergütung ab ${min.toLocaleString('de-DE')} €` : 'Mit Vergütung',
    });
  }
  if (filters.mitEmail === 'true') chips.push({ key: 'mitEmail', label: 'Mit E-Mail-Adresse' });
  if (filters.behinderung === 'true') chips.push({ key: 'behinderung', label: 'Für Schwerbehinderte geeignet' });

  return chips;
}

export default function ActiveFilters({ filters, onRemove, onClearAll }: ActiveFiltersProps) {
  const chips = buildChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className="active-filters-container">
      <div className="active-filters-list">
        {chips.map((chip, idx) => (
          <button
            key={`${chip.key}-${chip.value || ''}-${idx}`}
            className="filter-chip"
            onClick={() => onRemove(chip.key, chip.value)}
            aria-label={`Filter entfernen: ${chip.label}`}
            type="button"
          >
            {chip.label}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        ))}
        {chips.length > 1 && (
          <button type="button" className="filter-clear-all" onClick={onClearAll}>
            Alle löschen
          </button>
        )}
      </div>
    </div>
  );
}
