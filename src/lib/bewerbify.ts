import type { JobDetail } from '../types';
import type { ContactInfo, ContactPerson } from './contact';
import { toPlainText } from './plaintext';

/**
 * Deep link into Bewerbify's application form, pre-filled from a job posting.
 *
 * The data travels in the URL fragment (after "#"), which browsers never send to a server, so HR names and
 * e-mail addresses stay out of Bewerbify's logs and analytics. Nothing is generated or sent by the link:
 * the user checks the form there. Rule for every value: leave it out when unsure, a wrong recipient is
 * worse than none.
 */

/** Used when VITE_BEWERBIFY_URL is not set. The only place this address lives. */
const DEFAULT_BASE_URL = 'https://bewerbify.site';

const LIMITS = {
  company: 120,
  street: 120,
  city: 80,
  email: 254,
  contact: 60,
} as const;

/** Bewerbify filters the text itself, so the full posting goes in, only capped here. */
const MAX_DESCRIPTION_CHARS = 30000;

export interface BewerbifyInput {
  company?: string;
  street?: string;
  city?: string;
  /** Application address as found in the posting, may be several candidates */
  emails?: readonly string[];
  /** People named in the posting, used only when exactly one of them is clearly identified */
  people?: readonly ContactPerson[];
  /** Posting text (Markdown, HTML or plain) */
  description?: string;
  ref?: string;
}

/** Base URL from the environment, validated; falls back to the default. */
export function getBewerbifyBase(raw: string | undefined = import.meta.env.VITE_BEWERBIFY_URL): string {
  const value = raw?.trim();
  if (value) {
    try {
      const url = new URL(value);
      if (url.protocol === 'https:' || url.protocol === 'http:') return url.origin + url.pathname.replace(/\/+$/, '');
    } catch {
      // fall through to the default
    }
  }
  return DEFAULT_BASE_URL;
}

// ───────────────────────── values ─────────────────────────

function clean(value: string | undefined, max: number): string | undefined {
  const text = value?.replace(/\s+/g, ' ').trim().slice(0, max).trim();
  return text ? text : undefined;
}

const EMAIL_SHAPE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
/** Addresses that are never meant for applications. */
const NOT_FOR_APPLICATIONS = /^(?:datenschutz|privacy|impressum|noreply|no-reply|donotreply|abuse|webmaster)/i;
const APPLICATION_LOCAL_PART = /^(?:bewerbung|bewerbungen|karriere|career|careers|jobs?|recruiting|ausbildung|azubi|personal|hr|apply)/i;

/**
 * The application address, or undefined when it is not clear which one it is: a single usable address is
 * taken; with several, only one with an application-style name (bewerbung@, karriere@ …) counts.
 */
export function pickApplicationEmail(emails: readonly string[] | undefined): string | undefined {
  const usable = [...new Set((emails ?? []).map((e) => e.trim()))].filter(
    (e) => e.length <= LIMITS.email && EMAIL_SHAPE.test(e) && !NOT_FOR_APPLICATIONS.test(e.split('@')[0])
  );
  if (usable.length === 1) return usable[0];

  const applicationStyle = usable.filter((e) => APPLICATION_LOCAL_PART.test(e.split('@')[0]));
  return applicationStyle.length === 1 ? applicationStyle[0] : undefined;
}

const LAST_NAME = /^[A-ZÄÖÜ][\p{L}'-]*$/u;

/**
 * "Herr"/"Frau" plus the last name, only when the posting names exactly one person and states the salutation.
 * "Frau Dr. Anna Muster-Schmidt" -> { salutation: "Frau", contact: "Muster-Schmidt" }.
 */
export function pickContact(
  people: readonly ContactPerson[] | undefined
): { salutation: 'Herr' | 'Frau'; contact: string } | undefined {
  if (!people || people.length !== 1) return undefined;

  const match = /^(Frau|Herr)\s+(.+)$/.exec(people[0].name.trim());
  if (!match) return undefined;

  const words = match[2]
    .split(/\s+/)
    .filter((w) => !/^(Dr\.|Prof\.)$/.test(w));
  const last = words[words.length - 1];
  if (!last || last.length > LIMITS.contact || !LAST_NAME.test(last)) return undefined;

  return { salutation: match[1] as 'Herr' | 'Frau', contact: last };
}

// ───────────────────────── link ─────────────────────────

function hashFor(params: Record<string, string>): string {
  return `#${new URLSearchParams(params).toString()}`;
}

/** Text cut to `max` characters at a word boundary; shorter text is returned as it is. */
function capText(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.search(/\s\S*$/);
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd();
}

/** The pre-filled Bewerbify link, plus whether an e-mail address made it into it. */
export function buildBewerbify(
  input: BewerbifyInput,
  base: string = getBewerbifyBase()
): { url: string; hasEmail: boolean } {
  const params: Record<string, string> = { v: '1' };

  const set = (key: string, value: string | undefined) => {
    if (value) params[key] = value;
  };

  set('company', clean(input.company, LIMITS.company));
  set('street', clean(input.street, LIMITS.street));
  set('city', clean(input.city, LIMITS.city));

  const email = pickApplicationEmail(input.emails);
  set('email', email);

  const person = pickContact(input.people);
  if (person) {
    set('salutation', person.salutation);
    set('contact', person.contact);
  }

  set('ref', clean(input.ref, 60));

  // Full text, not trimmed or summarised; only cut at a word boundary when over the cap
  const text = capText(toPlainText(input.description), MAX_DESCRIPTION_CHARS);
  set('description', text);
  const hash = hashFor(params);

  return { url: `${base}/apply${hash}`, hasEmail: email !== undefined };
}

/** Pre-filled Bewerbify link for a posting (detail response + what was extracted from its description). */
export function bewerbifyForPosting(
  detail: JobDetail,
  contact: ContactInfo,
  base?: string
): { url: string; hasEmail: boolean } {
  const location = detail.stellenlokationen?.[0]?.adresse;
  const street = [location?.strasse, location?.hausnummer].filter(Boolean).join(' ');
  const city = [location?.plz, location?.ort].filter(Boolean).join(' ');

  return buildBewerbify(
    {
      company: detail.firma,
      street,
      city,
      emails: contact.emails,
      people: contact.people,
      description: detail.stellenangebotsBeschreibung,
      ref: detail.referenznummer,
    },
    base
  );
}
