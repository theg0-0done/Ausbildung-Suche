import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';

export interface SelectOption {
  value: string;
  label: string;
  /** Hit count shown at the far right of the row. */
  count?: number;
}

interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Label of the "no filter" row. */
  emptyLabel?: string;
  /** Show a search box above the list. Defaults to on for long lists. */
  searchable?: boolean;
  /** Keep the label for screen readers only (the surrounding heading already says it). */
  hideLabel?: boolean;
}

const fmt = (n: number) => n.toLocaleString('de-DE');
const SEARCH_THRESHOLD = 10;
const PANEL_MIN_WIDTH = 400;
const VIEWPORT_GAP = 12;

/** Where the floating list goes: below the trigger if it fits, otherwise above; wider than the trigger. */
function computePlacement(trigger: HTMLElement): CSSProperties {
  const r = trigger.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(Math.max(r.width, PANEL_MIN_WIDTH), vw - 2 * VIEWPORT_GAP);
  const left = Math.min(Math.max(r.left, VIEWPORT_GAP), vw - width - VIEWPORT_GAP);
  const below = vh - r.bottom - VIEWPORT_GAP;
  const above = r.top - VIEWPORT_GAP;
  const placeBelow = below >= 260 || below >= above;
  const maxHeight = Math.max(160, Math.min(420, (placeBelow ? below : above) - 6));
  return placeBelow
    ? { position: 'fixed', left, width, top: r.bottom + 6, maxHeight }
    : { position: 'fixed', left, width, bottom: vh - r.top + 6, maxHeight };
}

/**
 * Dropdown that expands in place (no floating popover), so it works inside the scrolling
 * filter sheet on phones without being clipped. Keyboard: arrows, Home/End, Enter, Escape.
 */
export default function Select({ label, value, options, onChange, emptyLabel = 'Alle', searchable, hideLabel }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const uid = useId();

  const showSearch = searchable ?? options.length > SEARCH_THRESHOLD;

  const rows = useMemo<SelectOption[]>(() => {
    const q = query.trim().toLocaleLowerCase('de');
    const filtered = q ? options.filter((o) => o.label.toLocaleLowerCase('de').includes(q)) : options;
    return q ? filtered : [{ value: '', label: emptyLabel }, ...filtered];
  }, [options, query, emptyLabel]);

  const selected = options.find((o) => o.value === value);

  const close = (refocus: boolean) => {
    setOpen(false);
    setQuery('');
    if (refocus) triggerRef.current?.focus();
  };

  const openPanel = () => {
    if (triggerRef.current) setPlacement(computePlacement(triggerRef.current));
    const idx = rows.findIndex((r) => r.value === value);
    setActive(idx >= 0 ? idx : 0);
    setOpen(true);
  };

  const choose = (row: SelectOption | undefined) => {
    if (!row) return;
    onChange(row.value);
    close(true);
  };

  // Close when the user taps/clicks anywhere else
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  // Follow the trigger while the page or the filter list scrolls, and when the window resizes
  const reposition = useCallback(() => {
    if (triggerRef.current) setPlacement(computePlacement(triggerRef.current));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (panelRef.current?.contains(e.target as Node)) return;
      reposition();
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  // Focus the search box (or the list) when the panel opens
  useEffect(() => {
    if (!open) return;
    (showSearch ? searchRef.current : listRef.current)?.focus({ preventScroll: true });
  }, [open, showSearch]);

  // Keep the keyboard-highlighted row in view
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const onPanelKey = (e: ReactKeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActive((i) => Math.min(rows.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
        break;
      case 'Home':
        if (!showSearch) {
          e.preventDefault();
          setActive(0);
        }
        break;
      case 'End':
        if (!showSearch) {
          e.preventDefault();
          setActive(rows.length - 1);
        }
        break;
      case 'Enter':
        e.preventDefault();
        choose(rows[active]);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const listId = `${uid}-list`;

  return (
    <div className="select" ref={rootRef}>
      <span className={`select-label ${hideLabel ? 'sr-only' : ''}`} id={`${uid}-label`}>
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        className={`select-trigger ${open ? 'open' : ''} ${value ? 'has-value' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={`${uid}-label`}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            openPanel();
          }
        }}
      >
        <span className="select-value">{selected?.label ?? emptyLabel}</span>
        {selected?.count !== undefined && selected.count > 0 && <span className="select-count">{fmt(selected.count)}</span>}
        <svg className="select-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open &&
        createPortal(
        <div ref={panelRef} className="select-panel" style={placement} onKeyDown={onPanelKey}>
          {showSearch && (
            <div className="select-search">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={query}
                placeholder="Suchen…"
                aria-label={`${label} durchsuchen`}
                aria-controls={listId}
                aria-activedescendant={rows[active] ? `${uid}-opt-${active}` : undefined}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-labelledby={`${uid}-label`}
            tabIndex={-1}
            aria-activedescendant={rows[active] ? `${uid}-opt-${active}` : undefined}
            className="select-list"
          >
            {rows.length === 0 && <li className="select-empty">Keine Treffer</li>}
            {rows.map((row, i) => {
              const isSelected = row.value === value;
              return (
                <li
                  key={row.value || '__empty'}
                  id={`${uid}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  data-active={i === active}
                  className={`select-option ${isSelected ? 'selected' : ''} ${i === active ? 'active' : ''}`}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(row)}
                >
                  <span className="select-option-label">{row.label}</span>
                  {row.count !== undefined && row.count > 0 && <span className="select-count">{fmt(row.count)}</span>}
                </li>
              );
            })}
          </ul>
        </div>,
        document.body
      )}
    </div>
  );
}
