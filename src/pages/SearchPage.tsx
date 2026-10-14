import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchBar from '../components/SearchBar';
import JobCard from '../components/JobCard';
import FilterSidebar from '../components/FilterSidebar';
import ActiveFilters from '../components/ActiveFilters';
import Icon from '../components/Icons';
import { JobListSkeleton, MapSkeleton } from '../components/Skeletons';
import { searchAusbildungen } from '../api';
import { useEmailCheck } from '../hooks/useEmailCheck';
import { matchesMinPay } from '../lib/pay';
import {
  MAX_REACHABLE_RESULTS,
  PAGE_SIZE,
  applyFiltersToUrl,
  countActiveFilters,
  parseFiltersFromSearch,
  toggleListValue,
  sameServerQuery,
  LIST_FILTER_KEYS,
} from '../lib/filters';
import type { ListFilterKey } from '../lib/filters';
import { describeWoOutput } from '../lib/labels';
import type { Facets, JobFilters, JobSearchItem, WoOutput } from '../types';

const MapView = lazy(() => import('../components/MapView'));

interface SearchPageProps {
  onSelectJob: (refnr: string) => void;
}

type ViewMode = 'list' | 'map';

/** URL parameter that keeps the list/map choice across reloads and shared links */
const VIEW_PARAM = 'ansicht';

function readViewFromUrl(): ViewMode {
  return new URLSearchParams(window.location.search).get(VIEW_PARAM) === 'karte' ? 'map' : 'list';
}

function writeViewToUrl(view: ViewMode) {
  const url = new URL(window.location.href);
  if (view === 'map') url.searchParams.set(VIEW_PARAM, 'karte');
  else url.searchParams.delete(VIEW_PARAM);
  window.history.replaceState({}, '', url);
}

/** Push filters into the URL without a full page reload */
function pushSearchParams(filters: JobFilters) {
  const url = new URL(window.location.href);
  url.searchParams.delete('refnr');
  applyFiltersToUrl(url, filters);
  window.history.replaceState({}, '', url);
}

const fmt = (n: number) => n.toLocaleString('de-DE');

/** Pay / e-mail filters run in the browser, so matches can be sparse: keep loading pages until this many show up. */
const AUTO_TARGET = 20;
const MAX_AUTO_PAGES = 5;

export default function SearchPage({ onSelectJob }: SearchPageProps) {
  const [filters, setFilters] = useState<JobFilters>(() => parseFiltersFromSearch(window.location.search));
  const [results, setResults] = useState<JobSearchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [facets, setFacets] = useState<Facets>({});
  const [woOutput, setWoOutput] = useState<WoOutput | undefined>();
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<JobFilters>(filters);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [view, setViewState] = useState<ViewMode>(readViewFromUrl);

  const setView = useCallback((next: ViewMode) => {
    setViewState(next);
    writeViewToUrl(next);
  }, []);

  // The newest search wins: older in-flight requests are aborted and their results ignored
  const searchRef = useRef<AbortController | null>(null);
  const filtersRef = useRef(filters);
  const pageRef = useRef(1);
  const autoPages = useRef(0);
  const loadingMoreRef = useRef(false);

  const runSearch = useCallback(async (next: JobFilters) => {
    searchRef.current?.abort();
    const controller = new AbortController();
    searchRef.current = controller;

    filtersRef.current = next;
    autoPages.current = 0;
    setFilters(next);
    setLastQuery(next);
    setLoading(true);
    setLoadingMore(false);
    setSearched(true);
    setError(null);
    pushSearchParams(next);

    try {
      const data = await searchAusbildungen(next, 1, PAGE_SIZE, controller.signal);
      if (controller.signal.aborted) return;
      setResults(data.ergebnisliste);
      setTotal(data.maxErgebnisse);
      setFacets(data.facetten ?? {});
      setWoOutput(data.woOutput);
      setPage(1);
      pageRef.current = 1;
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setResults([]);
      setTotal(0);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const controller = new AbortController();
    searchRef.current = controller;
    const target = pageRef.current + 1;
    setLoadingMore(true);
    setError(null);

    try {
      const data = await searchAusbildungen(lastQuery, target, PAGE_SIZE, controller.signal);
      if (controller.signal.aborted) return;
      setResults((prev) => {
        const seen = new Set(prev.map((j) => j.referenznummer));
        return [...prev, ...data.ergebnisliste.filter((j) => !seen.has(j.referenznummer))];
      });
      setPage(target);
      pageRef.current = target;
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      loadingMoreRef.current = false;
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }, [lastQuery]);

  /** Server-relevant changes re-run the search; pay / e-mail changes only re-filter what is loaded. */
  const commitFilters = useCallback(
    (next: JobFilters) => {
      if (sameServerQuery(filtersRef.current, next)) {
        filtersRef.current = next;
        autoPages.current = 0;
        setFilters(next);
        pushSearchParams(next);
        return;
      }
      void runSearch(next);
    },
    [runSearch]
  );

  const handleSearch = useCallback(
    (was: string, wo: string) => commitFilters({ ...filtersRef.current, was, wo }),
    [commitFilters]
  );

  const handleFilterChange = commitFilters;

  const handleFilterReset = useCallback(() => {
    const { was, wo } = filtersRef.current;
    commitFilters({ was, wo });
  }, [commitFilters]);

  const handleRemoveFilter = useCallback(
    (key: keyof JobFilters, value?: string) => {
      const updated: JobFilters = { ...filtersRef.current };
      if (value !== undefined && (LIST_FILTER_KEYS as readonly string[]).includes(key)) {
        commitFilters(toggleListValue(updated, key as ListFilterKey, value));
        return;
      }
      delete updated[key];
      if (key === 'angebotsart') delete updated.ausbildungsart;
      commitFilters(updated);
    },
    [commitFilters]
  );

  const handleClearAllFilters = useCallback(() => commitFilters({}), [commitFilters]);

  useEffect(() => {
    runSearch(filtersRef.current);
    return () => searchRef.current?.abort();
  }, [runSearch]);

  // Lock page scroll behind the bottom sheet (phones only)
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 899px)').matches;
    if (!isSidebarOpen || !phone) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSidebarOpen]);

  const reachable = Math.min(total, MAX_REACHABLE_RESULTS);
  const hasMore = results.length < reachable && page * PAGE_SIZE < MAX_REACHABLE_RESULTS;
  const activeCount = countActiveFilters(filters);
  const hasAnyFilter = activeCount > 0 || !!filters.was?.trim() || !!filters.wo?.trim();

  // ---- filters that run in the browser ----
  const payActive = filters.minVerguetung !== undefined;
  const emailActive = filters.mitEmail === 'true';
  const clientFiltering = payActive || emailActive;

  const payFiltered = useMemo(() => {
    if (!payActive) return results;
    const min = Number(filters.minVerguetung) || 0;
    return results.filter((j) => matchesMinPay(j, min));
  }, [results, payActive, filters.minVerguetung]);

  const { found: emailsFound } = useEmailCheck(emailActive, payFiltered);
  // Derived (not the hook's counter) so it is already correct in the render that follows a page load
  const emailPending = useMemo(
    () => (emailActive ? payFiltered.filter((j) => emailsFound[j.referenznummer] === undefined).length : 0),
    [emailActive, payFiltered, emailsFound]
  );

  const visible = useMemo(
    () => (emailActive ? payFiltered.filter((j) => (emailsFound[j.referenznummer]?.length ?? 0) > 0) : payFiltered),
    [payFiltered, emailActive, emailsFound]
  );

  // Keep fetching pages until enough offers match (bounded, so the API is not hammered)
  useEffect(() => {
    if (!clientFiltering || loading || loadingMore || error || !hasMore) return;
    if (emailActive && emailPending > 0) return;
    if (visible.length >= AUTO_TARGET || autoPages.current >= MAX_AUTO_PAGES) return;
    autoPages.current += 1;
    void loadMore();
  }, [clientFiltering, loading, loadingMore, error, hasMore, emailActive, emailPending, visible.length, loadMore]);

  const scanning = clientFiltering && !error && (loading || loadingMore || emailPending > 0 || (hasMore && visible.length < AUTO_TARGET && autoPages.current < MAX_AUTO_PAGES));
  const locationNote = useMemo(
    () => describeWoOutput(woOutput, lastQuery.wo, lastQuery.umkreis),
    [woOutput, lastQuery.wo, lastQuery.umkreis]
  );
  /** Anything still loading or being checked in the background: shown as one spinner below the offers */
  const busy = scanning || loadingMore;

  // Infinite scroll: load the next page when the end of the list comes into view.
  // The observer is re-created after every page so a sentinel that is still visible triggers again.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || loading || loadingMore || error || !hasMore) return;
    if (emailActive && emailPending > 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: '600px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loading, loadingMore, error, hasMore, emailActive, emailPending, results.length, loadMore, view]);

  const mappable = useMemo(
    () => visible.filter((j) => typeof j.stellenlokationen?.[0]?.breite === 'number').length,
    [visible]
  );

  return (
    <div className="search-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Finde deine <span className="gradient-text">Ausbildung</span>
          </h1>
          <p className="hero-subtitle">
            Durchsuche tausende Ausbildungsangebote in ganz Deutschland
          </p>
          <SearchBar
            onSearch={handleSearch}
            loading={loading}
            initialWas={filters.was || ''}
            initialWo={filters.wo || ''}
          />
        </div>
        <div className="hero-glow" />
      </section>

      {/* Results Section layout */}
      <section className="results-section search-page-layout">
        <FilterSidebar
          filters={filters}
          facets={facets}
          onChange={handleFilterChange}
          onReset={handleFilterReset}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          totalResults={total}
        />

        <div className="results-content">
          <div className="results-top">
            <div className="results-toolbar">
              <button
                type="button"
                className="toggle-filters-btn"
                onClick={() => setIsSidebarOpen(true)}
                aria-haspopup="dialog"
              >
                <Icon name="filter" size={18} />
                Filter{activeCount > 0 ? ` (${activeCount})` : ''}
              </button>

              <div className="view-toggle" role="group" aria-label="Ansicht">
                <button
                  type="button"
                  className={view === 'list' ? 'active' : ''}
                  aria-pressed={view === 'list'}
                  onClick={() => setView('list')}
                >
                  <Icon name="list" size={16} />
                  Liste
                </button>
                <button
                  type="button"
                  className={view === 'map' ? 'active' : ''}
                  aria-pressed={view === 'map'}
                  onClick={() => setView('map')}
                >
                  <Icon name="map" size={16} />
                  Karte
                </button>
              </div>
            </div>

            <div className="results-count-row">
            <h2 className="results-count" aria-live="polite">
              {searched && !loading && !error && (
                clientFiltering ? (
                  <>
                    <span className="gradient-text">{fmt(visible.length)}</span> passende Ergebnisse
                    <span className="results-count-sub">
                      {' '}aus {fmt(results.length)} von {fmt(total)} geprüft
                    </span>
                  </>
                ) : total > 0 ? (
                  <><span className="gradient-text">{fmt(total)}</span> Ergebnisse gefunden</>
                ) : (
                  'Keine Ergebnisse gefunden'
                )
              )}
            </h2>
            {hasAnyFilter && (
              <button type="button" className="filter-clear-all" onClick={handleClearAllFilters}>
                Alle löschen
              </button>
            )}
            </div>
          </div>

          <ActiveFilters filters={filters} onRemove={handleRemoveFilter} />

          {locationNote && !loading && (
            <p className={`location-note ${locationNote.tone}`} role="status">
              <Icon name="pin" size={14} />
              {locationNote.text}
            </p>
          )}

          {error && (
            <div className="error-banner" role="alert">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {loading && (view === 'map' ? <MapSkeleton /> : <JobListSkeleton />)}

          {!loading && visible.length > 0 && view === 'list' && (
            <div className="results-grid">
              {visible.map((job) => (
                <JobCard
                  key={job.referenznummer}
                  job={job}
                  hasEmail={(emailsFound[job.referenznummer]?.length ?? 0) > 0}
                  emails={emailsFound[job.referenznummer]}
                  onClick={() => onSelectJob(job.referenznummer)}
                />
              ))}
            </div>
          )}

          {!loading && visible.length > 0 && view === 'map' && (
            <>
              <Suspense fallback={<MapSkeleton />}>
                <MapView jobs={visible} onSelectJob={onSelectJob} />
              </Suspense>
              <p className="map-note">
                {fmt(mappable)} von {fmt(visible.length)} Angeboten auf der Karte
                {hasMore ? ' – lade mehr, um weitere Orte zu sehen.' : '.'}
              </p>
            </>
          )}

          {!loading && searched && results.length > 0 && visible.length === 0 && !error && !scanning && (
            <div className="empty-state">
              <h3>Keine passenden Angebote unter den geladenen</h3>
              <p>
                Von {fmt(results.length)} geprüften Angeboten erfüllt keines die Vergütungs- bzw. E-Mail-Bedingung.
                {hasMore ? ' Lade weitere Angebote oder lockere den Filter.' : ' Lockere den Filter.'}
              </p>
            </div>
          )}

          {!loading && searched && results.length === 0 && !error && (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
              <h3>Keine Ausbildungen gefunden</h3>
              <p>Versuche es mit anderen Suchbegriffen, einem anderen Ort oder weniger Filtern.</p>
              {activeCount > 0 && (
                <button type="button" className="load-more-btn" onClick={handleClearAllFilters}>
                  Filter zurücksetzen
                </button>
              )}
            </div>
          )}

          {!loading && !error && (hasMore || busy) && results.length > 0 && (
            <div className="scroll-end" ref={sentinelRef} role="status" aria-label="Weitere Angebote werden geladen">
              <span className="spinner-bottom" aria-hidden="true" />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
