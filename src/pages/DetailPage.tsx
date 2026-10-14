import { useState, useEffect, useRef } from 'react';
import type { JobDetail, JobSearchItem } from '../types';
import { fetchEmployerJobs, fetchJobDetail, getJobUrl, getLogoUrl } from '../api';
import Icon from '../components/Icons';
import type { IconName } from '../components/Icons';
import JobCard from '../components/JobCard';
import { DetailSkeleton, JobCardSkeleton } from '../components/Skeletons';
import DetailSection from '../components/DetailSection';
import ContactCard from '../components/ContactCard';
import { extractContact } from '../lib/contact';
import { pickCompanyUrl, resolveApplyUrl } from '../lib/apply';
import { bewerbifyForPosting } from '../lib/bewerbify';
import RichContentRenderer from '../components/RichContentRenderer';
import RecursiveFieldRenderer from '../components/RecursiveFieldRenderer';

interface DetailPageProps {
  refnr: string;
  onBack: () => void;
  onSelectJob: (refnr: string) => void;
}

// ── helpers ──────────────────────────────────────────────

function formatDate(d?: string) {
  if (!d) return undefined;
  try {
    return new Date(d).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatCurrency(n?: number) {
  if (n === undefined || n === null) return undefined;
  return `${n.toLocaleString('de-DE')} €`;
}

const BILDUNGSABSCHLUSS_MAP: Record<string, string> = {
  HAUPTSCHULABSCHLUSS: 'Hauptschulabschluss',
  MITTLERE_REIFE_MITTLERER_BILDUNGSABSCHLUSS: 'Mittlere Reife',
  FACHHOCHSCHULREIFE: 'Fachhochschulreife',
  ABITUR: 'Abitur',
  OHNE: 'Kein Abschluss erforderlich',
  BELIEBIG: 'Beliebig',
};

const VERGUETUNG_MAP: Record<string, string> = {
  AUSBILDUNGSVERGUETUNG_NACH_JAHREN: 'Nach Lehrjahr gestaffelt',
  KEINE_ANGABEN: 'Keine Angaben',
};

/** Keys rendered in dedicated sections OR internal / hidden */
const KNOWN_KEYS = new Set([
  'stellenangebotsTitel', 'stellenangebotsBeschreibung', 'hauptberuf',
  'referenznummer', 'firma', 'stellenangebotsart', 'ausbildungsart',
  'stellenlokationen', 'eintrittszeitraum', 'veroeffentlichungszeitraum',
  'datumErsteVeroeffentlichung', 'geforderterBildungsabschluss',
  'arbeitszeitVollzeit', 'arbeitszeitTeilzeitVormittag', 'arbeitszeitTeilzeitNachmittag',
  'arbeitszeitTeilzeitAbend', 'arbeitszeitTeilzeitFlexibel',
  'arbeitszeitHeimarbeitTelearbeit', 'arbeitszeitSchichtNachtWochenende',
  'verguetungsangabe', 'ausbildungsverguetungJahr1', 'ausbildungsverguetungJahr2',
  'ausbildungsverguetungJahr3', 'ausbildungsverguetungJahr4',
  'vertragsdauer', 'allianzpartnerUrl', 'allianzpartnerName',
  'arbeitgeberKundennummerHash',
  'istBetreut', 'aenderungsdatum',
  'istGeringfuegigeBeschaeftigung', 'istBehinderungGefordert',
  'homeofficemoeglich', 'quereinstiegGeeignet', 'istPrivateArbeitsvermittlung',
  'istArbeitnehmerUeberlassung', 'chiffrenummer', 'studienform', 'studiengang',
  'externeUrl', 'externeURL',
]);

const ART_MAP: Record<string, string> = {
  AUSBILDUNG: 'Ausbildung',
  DUALES_STUDIUM: 'Duales Studium',
};

const STUDIENFORM_MAP: Record<string, string> = {
  AUSBILDUNGSINTEGRIEREND: 'ausbildungsintegrierend',
  PRAXISINTEGRIEREND: 'praxisintegrierend',
};

const VERTRAGSDAUER_MAP: Record<string, string> = {
  BEFRISTET: 'Befristet',
  UNBEFRISTET: 'Unbefristet',
};

const ICON_EXTERNAL = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const ICON_BACK = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

interface Fact {
  label: string;
  icon: IconName;
  value?: string;
}

// ── Component ────────────────────────────────────────────

export default function DetailPage({ refnr, onBack, onSelectJob }: DetailPageProps) {
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoFailed, setLogoFailed] = useState(false);
  const [employerJobs, setEmployerJobs] = useState<JobSearchItem[] | null>(null);
  const [showStickyApply, setShowStickyApply] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDetail(null);
    setLogoFailed(false);

    async function load() {
      try {
        const data = await fetchJobDetail(refnr, controller.signal);
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Fehler beim Laden der Details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refnr]);

  // More offers from the same employer
  const employerName = detail?.firma;
  useEffect(() => {
    if (!employerName) return;
    const controller = new AbortController();
    setEmployerJobs(null);
    fetchEmployerJobs(employerName, refnr, controller.signal)
      .then((jobs) => {
        if (!controller.signal.aborted) setEmployerJobs(jobs);
      })
      .catch(() => {
        if (!controller.signal.aborted) setEmployerJobs([]);
      });
    return () => controller.abort();
  }, [employerName, refnr]);

  // Phones: show a sticky apply bar once the hero buttons have scrolled out of view
  useEffect(() => {
    const el = actionsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setShowStickyApply(!entry.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [detail]);

  const d = detail ?? ({} as JobDetail);
  const title = d.stellenangebotsTitel || refnr;
  const employer = d.firma || '';
  const jobUrl = getJobUrl(d.referenznummer || refnr);

  // Logo
  const logoHash = d.arbeitgeberKundennummerHash as string | undefined;
  const logoUrl = logoHash ? getLogoUrl(logoHash) : null;

  // Location
  const primaryLoc = d.stellenlokationen?.[0]?.adresse;
  const locationStr = primaryLoc
    ? [
        [primaryLoc.strasse, primaryLoc.hausnummer].filter(Boolean).join(' '),
        primaryLoc.plz,
        primaryLoc.ort,
      ].filter(Boolean).join(', ')
    : '';

  // Working time
  const workingTimes: string[] = [];
  if (d.arbeitszeitVollzeit) workingTimes.push('Vollzeit');
  if (d.arbeitszeitTeilzeitFlexibel) workingTimes.push('Teilzeit');
  if (d.arbeitszeitHeimarbeitTelearbeit) workingTimes.push('Homeoffice');
  if (d.arbeitszeitSchichtNachtWochenende) workingTimes.push('Schichtarbeit');

  // Salary per year
  const salaryEntries = [
    { label: '1. Lehrjahr', value: formatCurrency(d.ausbildungsverguetungJahr1) },
    { label: '2. Lehrjahr', value: formatCurrency(d.ausbildungsverguetungJahr2) },
    { label: '3. Lehrjahr', value: formatCurrency(d.ausbildungsverguetungJahr3) },
    { label: '4. Lehrjahr', value: formatCurrency(d.ausbildungsverguetungJahr4) },
  ].filter((e) => e.value !== undefined);

  const hasSalary =
    salaryEntries.length > 0 ||
    (!!d.verguetungsangabe && !d.verguetungsangabe.startsWith('KEINE_ANGABE'));

  // Education
  const education = d.geforderterBildungsabschluss
    ? BILDUNGSABSCHLUSS_MAP[d.geforderterBildungsabschluss] || d.geforderterBildungsabschluss
    : undefined;

  // The employer's own link when the offer has one; otherwise the offer page on arbeitsagentur.de
  const applyUrl = resolveApplyUrl([d.externeUrl, d.externeURL, d.allianzpartnerUrl], jobUrl);
  const companyUrl = pickCompanyUrl([d.allianzpartnerUrl]);

  const typeLabel = [
    d.ausbildungsart ? ART_MAP[d.ausbildungsart] ?? d.ausbildungsart : 'Ausbildung',
    typeof d.studienform === 'string' ? STUDIENFORM_MAP[d.studienform] ?? d.studienform : '',
  ].filter(Boolean).join(' · ');

  const factRows: Fact[] = [
    { label: 'Art', icon: 'briefcase', value: typeLabel },
    { label: 'Studiengang', icon: 'graduation', value: typeof d.studiengang === 'string' ? d.studiengang : undefined },
    { label: 'Beruf', icon: 'building', value: d.hauptberuf },
    { label: 'Beginn', icon: 'calendar', value: formatDate(d.eintrittszeitraum?.von) },
    { label: 'Arbeitszeit', icon: 'clock', value: workingTimes.join(' · ') || undefined },
    { label: 'Schulabschluss', icon: 'school', value: education },
    {
      label: 'Vertragsdauer',
      icon: 'file',
      value: d.vertragsdauer && d.vertragsdauer !== 'KEINE_ANGABE'
        ? VERTRAGSDAUER_MAP[d.vertragsdauer] ?? d.vertragsdauer
        : undefined,
    },
    { label: 'Ort', icon: 'pin', value: locationStr || undefined },
    { label: 'Online seit', icon: 'globe', value: formatDate(d.datumErsteVeroeffentlichung) },
    { label: 'Aktualisiert', icon: 'refresh', value: formatDate(d.aenderungsdatum) },
  ];
  const facts = factRows.filter((f) => f.value);
  const contact = extractContact(d.stellenangebotsBeschreibung);
  const hasContact = contact.emails.length > 0 || contact.phones.length > 0 || contact.people.length > 0;
  // Pre-filled Bewerbify form: company, address, application e-mail, contact and text of this posting
  const bewerbify = bewerbifyForPosting({ ...d, referenznummer: d.referenznummer || refnr }, contact);
  const showEmployerJobs = !!employerName && (employerJobs === null || employerJobs.length > 0);

  const backButton = (
    <button className="back-btn" onClick={onBack} aria-label="Zurück zur Suche">
      {ICON_BACK}
      <span className="back-label">Zurück zur Suche</span>
    </button>
  );

  if (loading) {
    return (
      <div className="detail-page">
        {backButton}
        <DetailSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="detail-page">
        {backButton}
        <article className="detail-card">
          <div className="error-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            {error}
          </div>
          <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="external-link-btn">
            Auf Arbeitsagentur.de ansehen
            {ICON_EXTERNAL}
          </a>
        </article>
      </div>
    );
  }

  const remaining: Record<string, unknown> = {};
  if (detail) {
    for (const [k, v] of Object.entries(detail)) {
      if (!KNOWN_KEYS.has(k) && v !== null && v !== undefined && v !== '' && v !== false) {
        remaining[k] = v;
      }
    }
  }

  return (
    <div className="detail-page">
      {backButton}

      {/* ── Hero ── */}
      <article className="detail-card detail-hero-card">
        <div className="detail-banner" aria-hidden="true" />
        <div className="detail-hero-body">
          <div className="detail-logo detail-logo-overlap">
            {logoUrl && !logoFailed ? (
              <img
                src={logoUrl}
                alt={`${employer} Logo`}
                className="detail-logo-img"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <div className="logo-placeholder large">
                {employer?.charAt(0)?.toUpperCase() || '?'}
              </div>
            )}
          </div>

          <div className="detail-hero-row">
            <div className="detail-header-info">
              <h1>{title}</h1>
              {employer && <p className="detail-company">{employer}</p>}
              <div className="detail-tags">
                <span className="tag tag-type">{typeLabel}</span>
                {d.eintrittszeitraum?.von && <span className="tag">Ab {formatDate(d.eintrittszeitraum.von)}</span>}
                {locationStr && <span className="tag">{locationStr}</span>}
                {workingTimes.length > 0 && <span className="tag">{workingTimes.join(' · ')}</span>}
              </div>
            </div>

            <div className="detail-actions" ref={actionsRef}>
              <div className="bewerbify-action">
                <a href={bewerbify.url} target="_blank" rel="noopener" className="external-link-btn">
                  Mit Bewerbify bewerben
                  {ICON_EXTERNAL}
                </a>
                <p className={`bewerbify-hint ${bewerbify.hasEmail ? 'found' : ''}`}>
                  {bewerbify.hasEmail
                    ? 'E-Mail-Adresse gefunden'
                    : 'Keine E-Mail im Angebot. Du kannst sie bei Bewerbify selbst eintragen.'}
                </p>
              </div>
              <a href={applyUrl} target="_blank" rel="noopener noreferrer" className="external-link-btn secondary">
                Jetzt bewerben
                {ICON_EXTERNAL}
              </a>
              {applyUrl !== jobUrl && (
                <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="external-link-btn secondary">
                  Auf Arbeitsagentur.de
                </a>
              )}
            </div>
          </div>
        </div>
      </article>

      {/* ── Two-column body ── */}
      <div className="detail-layout">
        <div className="detail-main">
          {d.stellenangebotsBeschreibung && (
            <article className="detail-card block-description">
              <DetailSection title="Über die Ausbildung">
                <RichContentRenderer content={d.stellenangebotsBeschreibung} />
              </DetailSection>
            </article>
          )}

          {d.stellenlokationen && d.stellenlokationen.length > 1 && (
            <article className="detail-card block-locations">
              <DetailSection title="Weitere Arbeitsorte">
                <div className="extra-locations">
                  {d.stellenlokationen.slice(1).map((loc, i) => {
                    const addr = loc.adresse;
                    return (
                      <div key={i} className="tag">
                        {addr ? [
                          [addr.strasse, addr.hausnummer].filter(Boolean).join(' '),
                          addr.plz,
                          addr.ort,
                        ].filter(Boolean).join(', ') : `Standort ${i + 2}`}
                      </div>
                    );
                  })}
                </div>
              </DetailSection>
            </article>
          )}

          {showEmployerJobs && (
            <article className="detail-card block-offers">
              <DetailSection title={`Weitere Angebote von ${employerName}`}>
                <div className="results-grid">
                  {employerJobs === null ? (
                    <>
                      <JobCardSkeleton />
                      <JobCardSkeleton />
                    </>
                  ) : (
                    employerJobs.map((job) => (
                      <JobCard key={job.referenznummer} job={job} onClick={() => onSelectJob(job.referenznummer)} />
                    ))
                  )}
                </div>
              </DetailSection>
            </article>
          )}

          {Object.keys(remaining).length > 0 && (
            <article className="detail-card block-extra">
              <DetailSection title="Weitere Informationen" className="extra-section">
                <RecursiveFieldRenderer data={remaining} />
              </DetailSection>
            </article>
          )}
        </div>

        <aside className="detail-aside">
          {hasContact && <ContactCard contact={contact} className="block-contact" />}

          {hasSalary && (
            <section className="detail-card aside-card block-pay">
              <h2 className="aside-title">Vergütung</h2>
              {salaryEntries.length > 0 ? (
                <ul className="salary-list">
                  {salaryEntries.map((e) => (
                    <li key={e.label}>
                      <span>{e.label}</span>
                      <strong>{e.value}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="detail-subtitle">
                  {d.verguetungsangabe ? VERGUETUNG_MAP[d.verguetungsangabe] || d.verguetungsangabe : ''}
                </p>
              )}
            </section>
          )}

          <section className="detail-card aside-card block-facts">
            <h2 className="aside-title">Auf einen Blick</h2>
            <dl className="facts-list">
              {facts.map((f) => (
                <div key={f.label} className="fact">
                  <span className="fact-icon">
                    <Icon name={f.icon} size={16} />
                  </span>
                  <div className="fact-body">
                    <dt>{f.label}</dt>
                    <dd>{f.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          </section>

          <section className="detail-card aside-card aside-employer block-employer">
            <h2 className="aside-title">Arbeitgeber</h2>
            <div className="aside-employer-row">
              {logoUrl && !logoFailed ? (
                <img src={logoUrl} alt="" className="aside-employer-logo" onError={() => setLogoFailed(true)} />
              ) : (
                <div className="logo-placeholder aside-employer-logo">{employer?.charAt(0)?.toUpperCase() || '?'}</div>
              )}
              <div>
                <strong>{employer}</strong>
                {companyUrl && (
                  <a href={companyUrl} target="_blank" rel="noopener noreferrer" className="aside-link">
                    {companyUrl.replace(/^https?:\/\//i, '').replace(/\/$/, '')}
                  </a>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      <div className={`sticky-apply ${showStickyApply ? 'visible' : ''}`} aria-hidden={!showStickyApply}>
        <a href={bewerbify.url} target="_blank" rel="noopener" className="external-link-btn" tabIndex={showStickyApply ? 0 : -1}>
          Mit Bewerbify bewerben
          {ICON_EXTERNAL}
        </a>
      </div>
    </div>
  );
}
