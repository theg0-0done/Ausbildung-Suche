import { useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { Facets, JobFilters } from '../types';
import Select from './Select';
import type { SelectOption } from './Select';
import {
  ANGEBOTSART_OPTIONS,
  ARBEITSZEIT_OPTIONS,
  AUSBILDUNGSART_OPTIONS,
  BEFRISTUNG_OPTIONS,
  SCHULBILDUNG_OPTIONS,
  UMKREIS_OPTIONS,
  VEROEFFENTLICHT_OPTIONS,
  formatEintrittsdatumKey,
} from '../lib/labels';
import { toggleListValue } from '../lib/filters';
import { PAY_SLIDER_MAX, PAY_SLIDER_STEP } from '../lib/pay';
import type { ListFilterKey } from '../lib/filters';

interface FilterSidebarProps {
  filters: JobFilters;
  facets: Facets;
  onChange: (filters: JobFilters) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
  totalResults: number;
}

interface Option {
  value: string;
  label: string;
}

const fmt = (n: number) => n.toLocaleString('de-DE');

function Accordion({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className={`filter-accordion ${isOpen ? 'open' : ''}`}>
      <button type="button" className="filter-accordion-header" onClick={() => setIsOpen(!isOpen)} aria-expanded={isOpen}>
        <span>{title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {isOpen && <div className="filter-accordion-body">{children}</div>}
    </div>
  );
}

interface RadioGroupProps {
  name: string;
  options: Option[];
  value: string;
  counts?: Record<string, number>;
  /** Adds a leading "Beliebig" option that clears the filter. */
  anyLabel?: string;
  onSelect: (value: string) => void;
}

function RadioGroup({ name, options, value, counts, anyLabel, onSelect }: RadioGroupProps) {
  const all: Option[] = anyLabel ? [{ value: '', label: anyLabel }, ...options] : options;
  return (
    <div className="filter-options" role="radiogroup">
      {all.map((opt) => {
        const count = counts?.[opt.value];
        return (
          <label key={opt.value} className="filter-radio">
            <input type="radio" name={name} value={opt.value} checked={value === opt.value} onChange={() => onSelect(opt.value)} />
            <span className="filter-option-label">{opt.label}</span>
            {opt.value !== '' && count !== undefined && <span className="filter-count">{fmt(count)}</span>}
          </label>
        );
      })}
    </div>
  );
}

interface FacetSelectProps {
  label: string;
  value: string;
  facetCounts?: Record<string, number>;
  /** Maps a raw facet key to its visible label. */
  format?: (key: string) => string;
  sortByLabel?: boolean;
  hideLabel?: boolean;
  onSelect: (value: string) => void;
}

/** A dropdown fed by the API's own facet list (top ~100 values, with hit counts). */
function FacetSelect({ label, value, facetCounts, format, sortByLabel, hideLabel, onSelect }: FacetSelectProps) {
  const entries = Object.entries(facetCounts ?? {});
  if (value && !entries.some(([k]) => k === value)) entries.push([value, 0]);
  entries.sort(([ka, a], [kb, b]) =>
    sortByLabel ? (format?.(ka) ?? ka).localeCompare(format?.(kb) ?? kb, 'de') : b - a
  );

  if (entries.length === 0) return null;

  const options: SelectOption[] = entries.map(([key, count]) => ({
    value: key,
    label: format?.(key) ?? key,
    count,
  }));

  return <Select label={label} value={value} options={options} onChange={onSelect} hideLabel={hideLabel} />;
}

interface ToggleProps {
  label: string;
  checked: boolean;
  count?: number;
  onToggle: (checked: boolean) => void;
}

function Toggle({ label, checked, count, onToggle }: ToggleProps) {
  return (
    <label className="filter-checkbox">
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} />
      <span className="filter-option-label">{label}</span>
      {count !== undefined && <span className="filter-count">{fmt(count)}</span>}
    </label>
  );
}

interface PaySliderProps {
  value: number;
  disabled: boolean;
  onCommit: (value: number) => void;
}

/** Minimum pay slider. Dragging updates the label live; the filter is applied when the finger / key is released. */
function PaySlider({ value, disabled, onCommit }: PaySliderProps) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;
  const pct = (shown / PAY_SLIDER_MAX) * 100;

  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };

  return (
    <div className={`pay-slider ${disabled ? 'disabled' : ''}`}>
      <div className="pay-slider-value">
        <span>Ab</span>
        <strong>{fmt(shown)} €</strong>
      </div>
      <input
        type="range"
        min={0}
        max={PAY_SLIDER_MAX}
        step={PAY_SLIDER_STEP}
        value={shown}
        disabled={disabled}
        aria-label="Mindestvergütung im 1. Lehrjahr in Euro pro Monat"
        style={{ '--pct': `${pct}%` } as CSSProperties}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <div className="pay-slider-scale" aria-hidden="true">
        <span>0 €</span>
        <span>1.000 €</span>
        <span>2.000 €</span>
      </div>
    </div>
  );
}

interface CheckListProps {
  options: SelectOption[];
  selected: string[];
  onToggle: (value: string) => void;
  searchLabel: string;
  /** Show a search box above the list. Defaults to on for long lists. */
  searchable?: boolean;
}

const CHECKLIST_SEARCH_THRESHOLD = 8;

/** Multi-select list with optional search; the list scrolls instead of growing the sidebar. */
function CheckList({ options, selected, onToggle, searchLabel, searchable }: CheckListProps) {
  const [query, setQuery] = useState('');
  const showSearch = searchable ?? options.length > CHECKLIST_SEARCH_THRESHOLD;

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('de');
    return q ? options.filter((o) => o.label.toLocaleLowerCase('de').includes(q)) : options;
  }, [options, query]);

  if (options.length === 0) return <p className="filter-hint">Keine Auswahl verfügbar.</p>;

  return (
    <div className="check-list">
      {showSearch && (
        <div className="check-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={query}
            placeholder="Suchen…"
            aria-label={searchLabel}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      )}
      <div className={`check-scroll ${showSearch ? 'scrollable' : ''}`} role="group" aria-label={searchLabel}>
        {rows.map((o) => (
          <Toggle
            key={o.value}
            label={o.label}
            checked={selected.includes(o.value)}
            count={o.count}
            onToggle={() => onToggle(o.value)}
          />
        ))}
        {rows.length === 0 && <p className="filter-hint">Keine Treffer</p>}
      </div>
    </div>
  );
}

/** Facet counts -> options. Selected values stay listed even when the API no longer returns them. */
function facetOptions(
  counts: Record<string, number> | undefined,
  selected: string[],
  format: (key: string) => string,
  sort: 'label' | 'count' | 'key'
): SelectOption[] {
  const entries = Object.entries(counts ?? {});
  for (const v of selected) if (!entries.some(([k]) => k === v)) entries.push([v, 0]);
  entries.sort(([ka, a], [kb, b]) => {
    if (sort === 'count') return b - a;
    if (sort === 'key') return ka.localeCompare(kb);
    return format(ka).localeCompare(format(kb), 'de');
  });
  return entries.map(([key, count]) => ({ value: key, label: format(key), count: count > 0 ? count : undefined }));
}

/** Where a fling would come to rest (Apple's momentum projection), in px. */
function project(velocityPxPerMs: number, decelerationRate = 0.998): number {
  return (velocityPxPerMs * decelerationRate) / (1 - decelerationRate);
}

export default function FilterSidebar({ filters, facets, onChange, onReset, isOpen, onClose, totalResults }: FilterSidebarProps) {
  const sheetRef = useRef<HTMLElement>(null);
  const drag = useRef<{ startY: number; lastY: number; lastT: number; velocity: number } | null>(null);

  const isAusbildung = (filters.angebotsart || '4') === '4';

  const set = (key: keyof JobFilters, value: string | undefined) => onChange({ ...filters, [key]: value || undefined });

  const handleArbeitszeitToggle = (value: string) => {
    const current = filters.arbeitszeit || [];
    const updated = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange({ ...filters, arbeitszeit: updated.length > 0 ? updated : undefined });
  };

  const toggleList = (key: ListFilterKey, value: string) => onChange(toggleListValue(filters, key, value));

  const handleAngebotsart = (value: string) => {
    // Filters that only exist for one offer type must not leak into another
    const next: JobFilters = { ...filters, angebotsart: value };
    if (value !== '4') delete next.ausbildungsart;
    else delete next.befristung;
    onChange(next);
  };

  /* ---------- bottom sheet drag (mobile) ---------- */
  const onGrabStart = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, velocity: 0 };
    sheetRef.current?.style.setProperty('transition', 'none');
  };

  const onGrabMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || !sheetRef.current) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.velocity = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    const dy = e.clientY - d.startY;
    // Rubber-band when pulling up, 1:1 when pulling down
    const y = dy < 0 ? dy * 0.12 : dy;
    sheetRef.current.style.transform = `translateY(${y}px)`;
  };

  const onGrabEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const sheet = sheetRef.current;
    drag.current = null;
    if (!d || !sheet) return;
    const dy = e.clientY - d.startY;
    const projected = dy + project(d.velocity);
    sheet.style.removeProperty('transition');
    sheet.style.removeProperty('transform');
    if (projected > sheet.offsetHeight * 0.3) onClose();
  };

  const facetCounts = (name: string) => facets[name]?.counts;
  const schulCounts = facetCounts('schulbildung');
  const azCounts = facetCounts('arbeitszeit');
  const artCounts = facetCounts('ausbildungsart');
  const pubCounts = facetCounts('veroeffentlichtseit');

  const hasEintritt = Object.keys(facetCounts('eintrittsdatum') ?? {}).length > 0 || !!filters.eintrittsdatum;

  return (
    <>
      <div className={`filter-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />

      <aside
        ref={sheetRef}
        className={`filter-sidebar ${isOpen ? 'open' : ''}`}
        aria-label="Filter"
        role="dialog"
        aria-modal={isOpen ? 'true' : undefined}
      >
        <div
          className="sheet-grabber"
          onPointerDown={onGrabStart}
          onPointerMove={onGrabMove}
          onPointerUp={onGrabEnd}
          onPointerCancel={onGrabEnd}
        >
          <span className="sheet-grabber-bar" />
        </div>

        <div className="filter-sidebar-header">
          <h3>Filter</h3>
          <button className="close-filters-btn" onClick={onClose} aria-label="Filter schließen">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="filter-sidebar-content">
          <Accordion title="Angebotsart">
            <RadioGroup
              name="angebotsart"
              options={ANGEBOTSART_OPTIONS}
              value={filters.angebotsart || '4'}
              onSelect={handleAngebotsart}
            />
          </Accordion>

          {isAusbildung && (
            <Accordion title="Art der Ausbildung">
              <RadioGroup
                name="ausbildungsart"
                options={AUSBILDUNGSART_OPTIONS}
                value={filters.ausbildungsart || ''}
                counts={artCounts}
                anyLabel="Beliebig"
                onSelect={(v) => set('ausbildungsart', v)}
              />
            </Accordion>
          )}

          {isAusbildung && (
            <Accordion title="Vergütung">
              <Toggle
                label="Nur Angebote mit Vergütung"
                checked={filters.minVerguetung !== undefined}
                count={facetCounts('ausbildungsverguetung')?.monat}
                onToggle={(c) => set('minVerguetung', c ? '0' : undefined)}
              />
              <PaySlider
                value={Number(filters.minVerguetung ?? 0)}
                disabled={filters.minVerguetung === undefined}
                onCommit={(v) => set('minVerguetung', String(v))}
              />
              <p className="filter-hint">Monatliche Vergütung im 1. Lehrjahr. Gilt für die geladenen Angebote; weitere werden automatisch nachgeladen.</p>
            </Accordion>
          )}

          <Accordion title="Dein Schulabschluss">
            <RadioGroup
              name="schulbildung"
              options={SCHULBILDUNG_OPTIONS}
              value={filters.schulbildung || ''}
              counts={schulCounts}
              anyLabel="Beliebig"
              onSelect={(v) => set('schulbildung', v)}
            />
            <p className="filter-hint">Zeigt Angebote, für die du mit diesem Abschluss infrage kommst.</p>
          </Accordion>

          <Accordion title="Veröffentlicht seit">
            <CheckList
              options={VEROEFFENTLICHT_OPTIONS.map((o) => ({ ...o, count: pubCounts?.[o.value] }))}
              selected={filters.veroeffentlichtseit ?? []}
              onToggle={(v) => toggleList('veroeffentlichtseit', v)}
              searchLabel="Veröffentlicht seit"
              searchable={false}
            />
          </Accordion>

          {hasEintritt && (
            <Accordion title="Beginn" defaultOpen={false}>
              <CheckList
                options={facetOptions(facetCounts('eintrittsdatum'), filters.eintrittsdatum ?? [], formatEintrittsdatumKey, 'key')}
                selected={filters.eintrittsdatum ?? []}
                onToggle={(v) => toggleList('eintrittsdatum', v)}
                searchLabel="Ausbildungsbeginn"
              />
            </Accordion>
          )}

          <Accordion title="Berufsfeld" defaultOpen={false}>
            <CheckList
              options={facetOptions(facetCounts('berufsfeld'), filters.berufsfeld ?? [], (k) => k, 'label')}
              selected={filters.berufsfeld ?? []}
              onToggle={(v) => toggleList('berufsfeld', v)}
              searchLabel="Berufsfeld durchsuchen"
            />
          </Accordion>

          <Accordion title="Beruf" defaultOpen={false}>
            <CheckList
              options={facetOptions(facetCounts('beruf'), filters.beruf ?? [], (k) => k, 'count')}
              selected={filters.beruf ?? []}
              onToggle={(v) => toggleList('beruf', v)}
              searchLabel="Beruf durchsuchen"
            />
          </Accordion>

          <Accordion title="Arbeitgeber" defaultOpen={false}>
            <FacetSelect
              label="Arbeitgeber"
              hideLabel
              value={filters.arbeitgeber || ''}
              facetCounts={facetCounts('arbeitgeber')}
              onSelect={(v) => set('arbeitgeber', v)}
            />
          </Accordion>

          <Accordion title="Arbeitszeit">
            <div className="filter-options">
              {ARBEITSZEIT_OPTIONS.map((opt) => (
                <Toggle
                  key={opt.value}
                  label={opt.label}
                  checked={(filters.arbeitszeit || []).includes(opt.value)}
                  count={azCounts?.[opt.value]}
                  onToggle={() => handleArbeitszeitToggle(opt.value)}
                />
              ))}
            </div>
          </Accordion>

          {!isAusbildung && (
            <Accordion title="Vertrag">
              <RadioGroup
                name="befristung"
                options={BEFRISTUNG_OPTIONS}
                value={filters.befristung || ''}
                anyLabel="Beliebig"
                onSelect={(v) => set('befristung', v)}
              />
            </Accordion>
          )}

          <Accordion title="Weitere Optionen" defaultOpen={false}>
            <div className="filter-options">
              <Toggle
                label="Nur mit E-Mail-Adresse"
                checked={filters.mitEmail === 'true'}
                onToggle={(c) => set('mitEmail', c ? 'true' : undefined)}
              />
              <Toggle
                label="Zeitarbeit ausblenden"
                checked={filters.zeitarbeit === 'false'}
                onToggle={(c) => set('zeitarbeit', c ? 'false' : undefined)}
              />
              <Toggle
                label="Private Vermittler ausblenden"
                checked={filters.pav === 'false'}
                onToggle={(c) => set('pav', c ? 'false' : undefined)}
              />
              <Toggle
                label="Externe Stellenbörsen ausblenden"
                checked={filters.externestellenboersen === 'false'}
                onToggle={(c) => set('externestellenboersen', c ? 'false' : undefined)}
              />
              <Toggle
                label="Für Menschen mit Behinderung geeignet"
                checked={filters.behinderung === 'true'}
                count={facetCounts('behinderung')?.true}
                onToggle={(c) => set('behinderung', c ? 'true' : undefined)}
              />
            </div>
            {filters.mitEmail === 'true' && (
              <p className="filter-hint">Dafür wird die Beschreibung jedes Angebots geprüft. Das dauert einen Moment.</p>
            )}
          </Accordion>

          <Accordion title="Ort & Umkreis" defaultOpen={false}>
            <Select
              label="Umkreis"
              value={filters.umkreis || ''}
              emptyLabel="Standard"
              options={UMKREIS_OPTIONS.map((km) => ({ value: km, label: `${km} km` }))}
              onChange={(v) => set('umkreis', v)}
            />
            <p className="filter-hint">Der Umkreis gilt für den Ort im Suchfeld „Wo“.</p>
          </Accordion>
        </div>

        <div className="filter-sidebar-footer">
          <button className="filter-apply-btn" onClick={onClose}>
            {fmt(totalResults)} Ergebnisse anzeigen
          </button>
          <button className="filter-reset-btn" onClick={onReset}>
            Zurücksetzen
          </button>
        </div>
      </aside>
    </>
  );
}
