import { useState } from 'react';
import type { JobSearchItem } from '../types';
import { getLogoUrl } from '../api';
import { getPayLabel } from '../lib/labels';
import Icon from './Icons';
import { buildBewerbify } from '../lib/bewerbify';

interface JobCardProps {
  job: JobSearchItem;
  onClick: (job: JobSearchItem) => void;
  /** The description contains an e-mail address (known once the e-mail filter has checked it). */
  hasEmail?: boolean;
  /** Addresses found in the description (known once the e-mail filter has checked it), used for the Bewerbify link. */
  emails?: readonly string[];
}

function getTypeLabel(job: JobSearchItem): string {
  if (job.ausbildungsart === 'DUALES_STUDIUM') return 'Duales Studium';
  if (job.ausbildungsart === 'AUSBILDUNG') return 'Ausbildung';
  return job.stellenangebotsart === 'AUSBILDUNG' ? 'Ausbildung' : (job.stellenangebotsart ?? '');
}

function getWorkingTime(job: JobSearchItem): string {
  const partTime =
    job.arbeitszeitTeilzeitVormittag ||
    job.arbeitszeitTeilzeitNachmittag ||
    job.arbeitszeitTeilzeitAbend ||
    job.arbeitszeitTeilzeitFlexibel;
  if (job.arbeitszeitVollzeit && partTime) return 'Voll- & Teilzeit';
  if (job.arbeitszeitVollzeit) return 'Vollzeit';
  if (partTime) return 'Teilzeit';
  return '';
}

export default function JobCard({ job, onClick, hasEmail, emails }: JobCardProps) {
  const [logoFailed, setLogoFailed] = useState(false);
  const employer = job.firma ?? '';
  const initial = employer.charAt(0).toUpperCase() || '?';
  const addr = job.stellenlokationen?.[0]?.adresse;
  const location = [addr?.plz, addr?.ort].filter(Boolean).join(' ');
  const start = job.eintrittszeitraum?.von;
  const logoUrl = job.arbeitgeberKundennummerHash ? getLogoUrl(job.arbeitgeberKundennummerHash) : null;
  const typeLabel = getTypeLabel(job);
  const workingTime = getWorkingTime(job);
  const pay = getPayLabel(job);
  // The search result has no description, so the form is pre-filled with company, address and reference only
  const bewerbifyUrl = buildBewerbify({
    company: employer,
    street: [addr?.strasse, addr?.hausnummer].filter(Boolean).join(' '),
    city: location,
    emails,
    ref: job.referenznummer,
  }).url;

  return (
    <article className="job-card" onClick={() => onClick(job)} tabIndex={0} role="button"
      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) onClick(job); }}
    >
      <div className="job-card-logo">
        {logoUrl && !logoFailed ? (
          <img
            src={logoUrl}
            alt={`${employer} Logo`}
            loading="lazy"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <div className="logo-placeholder">
            {initial}
          </div>
        )}
      </div>
      <div className="job-card-body">
        <h3 className="job-card-title">{job.stellenangebotsTitel || job.hauptberuf}</h3>
        <p className="job-card-company">{employer}</p>
        <div className="job-card-tags">
          {typeLabel && <span className="chip chip-type">{typeLabel}</span>}
          {workingTime && <span className="chip">{workingTime}</span>}
          {pay && (
            <span className="chip chip-pay">
              <Icon name="euro" size={12} />
              {pay}
            </span>
          )}
          {hasEmail && (
            <span className="chip chip-icon">
              <Icon name="mail" size={12} />
              E-Mail
            </span>
          )}
          {location && (
            <span className="chip chip-icon">
              <Icon name="pin" size={12} />
              {location}
              {typeof job.entfernung === 'number' && <span className="chip-dim"> · {job.entfernung} km</span>}
            </span>
          )}
          {start && (
            <span className="chip chip-icon">
              <Icon name="calendar" size={12} />
              Ab {new Date(start).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>
      <a
        className="job-card-apply"
        href={bewerbifyUrl}
        target="_blank"
        rel="noopener"
        onClick={(e) => e.stopPropagation()}
      >
        Bewerben
      </a>
    </article>
  );
}
