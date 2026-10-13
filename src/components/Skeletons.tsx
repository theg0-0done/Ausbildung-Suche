/** Placeholder shapes shown while data loads: grey blocks that pulse softly while a glassy sheen sweeps across. */

export function JobCardSkeleton() {
  return (
    <div className="job-card skeleton-card" aria-hidden="true">
      <div className="skeleton skeleton-logo" />
      <div className="job-card-body">
        <div className="skeleton skeleton-line w-70" />
        <div className="skeleton skeleton-line w-40" />
        <div className="skeleton-chips">
          <div className="skeleton skeleton-chip" style={{ width: 54 }} />
          <div className="skeleton skeleton-chip" style={{ width: 92 }} />
          <div className="skeleton skeleton-chip" style={{ width: 120 }} />
        </div>
      </div>
    </div>
  );
}

export function JobListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="results-grid" role="status" aria-busy="true" aria-label="Lade Ausbildungsplätze">
      {Array.from({ length: count }, (_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MapSkeleton() {
  return <div className="skeleton map-skeleton" role="status" aria-busy="true" aria-label="Lade Karte" />;
}

export function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Lade Anzeige">
      <article className="detail-card detail-hero-card" aria-hidden="true">
        <div className="detail-banner" />
        <div className="detail-hero-body">
          <div className="skeleton skeleton-logo detail-skeleton-logo" />
          <div className="skeleton skeleton-line w-70" style={{ height: 28 }} />
          <div className="skeleton skeleton-line w-40" />
          <div className="skeleton-chips">
            <div className="skeleton skeleton-chip" style={{ width: 90 }} />
            <div className="skeleton skeleton-chip" style={{ width: 130 }} />
            <div className="skeleton skeleton-chip" style={{ width: 110 }} />
          </div>
        </div>
      </article>
      <div className="detail-layout" aria-hidden="true">
        <div className="detail-main">
          <article className="detail-card">
            <div className="skeleton skeleton-line w-40" style={{ height: 22 }} />
            {[100, 96, 100, 88, 94, 60].map((w, i) => (
              <div key={i} className="skeleton skeleton-line" style={{ width: `${w}%` }} />
            ))}
            <div className="skeleton skeleton-line w-40" style={{ height: 22, marginTop: 24 }} />
            {[92, 100, 80].map((w, i) => (
              <div key={i} className="skeleton skeleton-line" style={{ width: `${w}%` }} />
            ))}
          </article>
        </div>
        <aside className="detail-aside">
          <section className="detail-card aside-card">
            <div className="skeleton skeleton-line w-55" style={{ height: 18 }} />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-fact">
                <div className="skeleton skeleton-icon" />
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-line w-40" style={{ height: 10 }} />
                  <div className="skeleton skeleton-line w-70" style={{ height: 14, marginBottom: 0 }} />
                </div>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
