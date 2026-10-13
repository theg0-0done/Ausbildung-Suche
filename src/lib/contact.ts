/**
 * Contact data from free-text job descriptions.
 *
 * Design rule: precision over recall. A value is only returned when the text states it in an
 * unmistakable, labelled form (e.g. "Tel.: 0511 12345", "Ansprechpartner: Frau Anna Muster").
 * Anything ambiguous is dropped, so the UI shows nothing instead of something wrong.
 */

export interface ContactPerson {
  name: string;
  /** Job title, only when it is part of the same labelled line ("Name, Rolle | Telefon …") */
  role?: string;
  /** Phone number that the text attaches to this very person */
  phone?: string;
}

export interface ContactInfo {
  emails: string[];
  /** Phone numbers exactly as written in the description */
  phones: string[];
  people: ContactPerson[];
}

// ───────────────────────── e-mail ─────────────────────────

const EMAIL_PATTERN = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;

/**
 * Finds e-mail addresses in free text (job descriptions are Markdown / plain text).
 * Trailing dots and hyphens (end of a sentence) are trimmed; duplicates are removed
 * case-insensitively while keeping the first spelling and order.
 */
export function extractEmails(text: string | undefined | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const found: string[] = [];

  for (const match of text.match(EMAIL_PATTERN) ?? []) {
    const email = match.replace(/[.-]+$/, '');
    // After trimming, the domain must still contain a dot ("a@b." would not)
    if (!/@[^@]+\.[^@.]+$/.test(email)) continue;
    // Retina image names such as logo@2x.png are not addresses
    if (/\.(png|jpe?g|gif|svg|webp)$/i.test(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(email);
  }

  return found;
}

// ───────────────────────── phone ─────────────────────────

/** Labels that introduce a voice number. "Fax" is deliberately absent. */
const PHONE_LABEL = String.raw`(?:Tel(?:efon)?(?:\.?\s*-?\s*Nr\.?|nummer)?|Fon|Mobil(?:funk)?|Handy|Rufnummer|Phone)`;

/** A number: optional +/00 prefix, then digits grouped by space . - / and an optional "(0)". */
const PHONE_NUMBER = String.raw`(?:\+|00)?[\d(][\d \t().\-/–]{4,}\d`;

const PHONE_AFTER_LABEL = new RegExp(
  String.raw`(?<![A-Za-zÄÖÜäöüß])${PHONE_LABEL}[\s:.\-–]*\[?\s*(${PHONE_NUMBER})`,
  'gi'
);

/** Returns the number when it passes every sanity check, otherwise null. */
function cleanPhone(raw: string): string | null {
  // Cut a trailing date / time fragment glued on by the separator class ("… 123 456 bis 15 Uhr" never matches digits only)
  const trimmed = raw.replace(/[\s.\-/–]+$/, '').trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return null;
  // Must look like a dialled number: international prefix or national trunk 0
  if (!/^(\+|00|0)/.test(trimmed)) return null;
  // Dates such as 30.04.2027 or 01.09.2027 are not numbers
  if (/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(trimmed)) return null;
  // Unbalanced parentheses mean the match ran into surrounding prose
  const open = (trimmed.match(/\(/g) ?? []).length;
  const close = (trimmed.match(/\)/g) ?? []).length;
  if (open !== close) return null;
  return trimmed.replace(/\s{2,}/g, ' ');
}

/** Dialable form for a tel: link ("+49 (0) 365 828" → "+493658…", "0511 120-4743" → "05111204743"). */
export function toTelHref(phone: string): string {
  const plus = /^(\+|00)/.test(phone.trim());
  const digits = phone
    .replace(/\(0\)/g, '')
    .replace(/\D/g, '')
    .replace(/^00/, '');
  return `tel:${plus ? '+' : ''}${digits}`;
}

function phoneKey(phone: string): string {
  return phone.replace(/\(0\)/g, '').replace(/\D/g, '').replace(/^00/, '').replace(/^0/, '49');
}

/** Phone numbers that directly follow a Tel./Telefon/Mobil label. */
export function extractPhones(text: string | undefined | null): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const found: string[] = [];

  for (const match of text.matchAll(PHONE_AFTER_LABEL)) {
    const phone = cleanPhone(match[1]);
    if (!phone) continue;
    const key = phoneKey(phone);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(phone);
  }

  // Markdown tel links: [07162 948150-827](https://tel:00497162948150827)
  for (const match of text.matchAll(/\[([^\]]+)\]\((?:https?:\/\/)?tel:([+\d]+)\)/gi)) {
    const phone = cleanPhone(match[1]);
    if (!phone) continue;
    const key = phoneKey(phone);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(phone);
  }

  return found;
}

// ───────────────────────── person ─────────────────────────

const NAME_WORD = String.raw`[A-ZÄÖÜ][a-zäöüß]{1,}(?:-[A-ZÄÖÜ][a-zäöüß]{1,})?`;
const TITLE = String.raw`(?:Dr\.|Prof\.|Prof\. Dr\.)`;
const SALUTATION = String.raw`(?:Frau|Herrn?)`;
/** "Frau Dr. Anna Muster-Schmidt", "Herr Müller" */
const SALUTED_NAME = String.raw`${SALUTATION}[ \t]+(?:${TITLE}[ \t]+)?${NAME_WORD}(?:[ \t]+${NAME_WORD}){0,2}`;
/** "Anna Muster" – two or three capitalised words, only accepted with an explicit label in front */
const FULL_NAME = String.raw`${NAME_WORD}(?:[ \t]+${NAME_WORD}){1,2}`;

/** Capitalised words that are ordinary German nouns/verbs and therefore never part of a person's name. */
const NOT_A_NAME = new Set([
  'ihnen', 'dir', 'euch', 'uns', 'gerne', 'gern', 'unter', 'zur', 'zum', 'bei', 'per', 'und', 'oder',
  'ausbildung', 'bewerbung', 'personal', 'personalabteilung', 'team', 'recruiting', 'human', 'resources',
  'telefon', 'tel', 'mail', 'email', 'kontakt', 'ansprechpartner', 'ansprechpartnerin', 'ansprechperson',
  'verfügung', 'fragen', 'gmbh', 'ag', 'kg', 'se', 'ohg', 'mbh',
]);

/** Endings / beginnings of departments, roles and generic nouns ("Personalabteilung", "Bewerbung", "Service-Team"). */
const NOT_A_NAME_SUFFIX =
  /(ung|heit|keit|schaft|tion|tät|ment|büro|amt|team|dienst|service|stelle|bereich|gruppe|zentrum|personal|recruiting|resources|leiter|leiterin|führer|führerin|direktor|direktorin|manager|managerin|referent|referentin|berater|beraterin|bearbeiter|bearbeiterin|meister|meisterin|ausbilder|ausbilderin|recruiter|recruiterin|koordinator|koordinatorin|assistent|assistentin|vorstand|inhaber|inhaberin|chef|chefin|kollege|kollegin|sekretär|sekretärin|mitarbeiter|mitarbeiterin|beauftragte|beauftragter)$/;
const NOT_A_NAME_PREFIX = /^(personal|bewerb|ausbild|karriere|recruit|human|kunden|service|team)/;

function isNameWord(word: string): boolean {
  const lower = word.toLowerCase();
  return !NOT_A_NAME.has(lower) && !NOT_A_NAME_SUFFIX.test(lower) && !NOT_A_NAME_PREFIX.test(lower);
}

/**
 * Cleans a raw match into "Frau Dr. Erika Muster" form, or null when it is not a person.
 * Trailing words that are plainly not part of a name ("… Muster Telefon", "… Muster Ausbildungsleiterin")
 * are cut off; a salutation needs at least one valid name word, a bare name at least two (first + last).
 */
function normaliseName(raw: string): string | null {
  const tokens = raw.replace(/\s+/g, ' ').trim().split(' ');
  let salutation: string | undefined;
  if (/^(Frau|Herrn?)$/.test(tokens[0])) salutation = tokens.shift() === 'Frau' ? 'Frau' : 'Herr';

  const titles: string[] = [];
  while (tokens.length > 0 && /^(Dr\.|Prof\.)$/.test(tokens[0])) titles.push(tokens.shift() as string);

  const words: string[] = [];
  for (const token of tokens) {
    if (!isNameWord(token) || words.length >= 3) break;
    words.push(token);
  }

  if (words.length < (salutation ? 1 : 2)) return null;
  return [salutation, ...titles, ...words].filter(Boolean).join(' ');
}

/** A line that consists of nothing but a label, e.g. "Ansprechperson:", "### Dein Kontakt:", "**Human Resources |**". */
const LABEL_LINE = new RegExp(
  String.raw`^[\s#*_>\-]*(?:(?:Dein(?:e)?|Ihr(?:e)?|Unser(?:e)?)\s+)?(?:direkte[rn]?\s+)?(?:Ansprechpartner(?:in)?|Ansprechperson|Kontaktperson|Kontakt|Human\s+Resources)[\s*_:|\-–]*$`,
  'i'
);

/** A line that is only a salutation + name (markup and trailing punctuation allowed). */
const SALUTED_LINE = new RegExp(String.raw`^[\s#*_>\-]*(${SALUTED_NAME})[\s*_.,;|]*$`);

const INLINE_LABELLED = new RegExp(
  String.raw`(?<![A-Za-zÄÖÜäöüß])(?:Ansprechpartner(?:in)?|Ansprechperson|Kontaktperson)\s*(?:ist|:)\s*[*_]*\s*(${SALUTED_NAME}|${FULL_NAME})(?![A-Za-zÄÖÜäöüß])`,
  'g'
);

const INLINE_SALUTED_PHONE_VERB = new RegExp(
  String.raw`(?:steht|stehen)\s+(?:Dir|Ihnen|dir|ihnen|euch)\s+(${SALUTED_NAME})(?:\s*\([^)]{2,80}\))?\s+(?:unter|zur|gerne|gern|telefonisch|per)`,
  'g'
);

/** "Herr Müller (02051/ 317-501)" – a salutation + name directly followed by a bracketed number */
const SALUTED_WITH_BRACKET_PHONE = new RegExp(
  String.raw`(${SALUTED_NAME})[ \t]*\([ \t]*(?:${PHONE_LABEL}[\s:.\-–]*)?(${PHONE_NUMBER})[ \t]*[,;)]`,
  'g'
);

/** "Anna Beck, Praxisanleiterin | Telefon +49 365 1967" */
const NAME_ROLE_PHONE_LINE = new RegExp(
  String.raw`^[\s#*_>\-]*(${FULL_NAME}),\s*([^|\n]{3,90}?)\s*\|\s*${PHONE_LABEL}\s*[:.]?\s*(${PHONE_NUMBER})\s*$`,
  'i'
);

/** Text on the same line before the match that marks a non-HR contact (data protection officer, board, imprint …). */
const NOT_HR_CONTEXT = /Datenschutz|Impressum|Geschäftsführ|Vorstand|Inhaber|Registergericht|Betriebsrat|Schwerbehinderten|Beauftragte/i;

/** Any "Frau/Herr Name" – the salutation is what marks the word after it as a person. */
const SALUTED_ANYWHERE = new RegExp(String.raw`(?<![A-Za-zÄÖÜäöüß/])(${SALUTED_NAME})(?![A-Za-zÄÖÜäöüß])`, 'g');

/**
 * "wenden Sie sich gerne an: Mirko Finneisen" – a bare name after a contact phrase. Only accepted
 * when a phone / mail label follows within the same paragraph, because company names look the same.
 */
const CONTACT_PHRASE_NAME = new RegExp(
  String.raw`(?:wenden\s+(?:Sie|Dich|Du)\s+sich\s+(?:gerne\s+|gern\s+|bitte\s+)?an|Rückfragen\s+(?:beantwortet|an)|Fragen\s+beantwortet|Auskünfte\s+erteilt)[\s:*_]*(${FULL_NAME})(?=(?:(?!\n[ \t]*\n)[\s\S]){0,160}?(?:Tel|Telefon|Phone|Mobil|E-?Mail|@))`,
  'g'
);

function tidy(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function salutationOf(name: string): string | undefined {
  return /^(Frau|Herr)\s/.exec(name)?.[1];
}

/** "Frau Muster" and "Erika Muster" are the same person; "Frau Muster" and "Herr Muster" are not. */
function samePerson(a: string, b: string): boolean {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (ka === kb) return true;
  const sa = salutationOf(a);
  const sb = salutationOf(b);
  if (sa && sb && sa !== sb) return false;
  const wa = ka.split(' ');
  const wb = kb.split(' ');
  const [short, long] = wa.length <= wb.length ? [wa, wb] : [wb, wa];
  return short.length === 1 && long.length > 1 && long[long.length - 1] === short[0];
}

function nameKey(name: string): string {
  return name.toLowerCase().replace(/^(?:frau|herr)\s+/, '');
}

/**
 * People named as contact. Only the labelled patterns above are accepted; each candidate must also
 * pass the name sanity check (no common nouns, 1–3 capitalised words).
 */
export function extractPeople(text: string | undefined | null): ContactPerson[] {
  if (!text) return [];
  const people: ContactPerson[] = [];

  const add = (person: ContactPerson) => {
    const name = normaliseName(person.name);
    if (!name) return;
    const existing = people.find((p) => samePerson(p.name, name));
    if (existing) {
      // A full name is more informative than "Frau Renz"
      if (name.length > existing.name.length) existing.name = name;
      if (person.phone && !existing.phone) existing.phone = person.phone;
      if (person.role && !existing.role) existing.role = person.role;
      return;
    }
    people.push({ ...person, name });
  };

  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    // 1) label on its own line, salutation + name on one of the next two non-empty lines
    if (LABEL_LINE.test(line)) {
      let seen = 0;
      for (let j = i + 1; j < lines.length && seen < 2; j += 1) {
        if (lines[j].trim() === '') continue;
        seen += 1;
        const m = SALUTED_LINE.exec(lines[j]);
        if (m) {
          add({ name: m[1] });
          break;
        }
      }
    }

    // 2) "Name, Rolle | Telefon …"
    const row = NAME_ROLE_PHONE_LINE.exec(line);
    if (row) {
      const phone = cleanPhone(row[3]);
      add({ name: row[1], role: tidy(row[2]), ...(phone ? { phone } : {}) });
    }
  }

  // 3) "Ansprechpartner: Marco Beckmann" / "deine Ansprechpartnerin ist Frau Renz"
  for (const m of text.matchAll(INLINE_LABELLED)) add({ name: m[1] });

  // 4) "steht Dir Frau Alexandra Veile unter der Tel.-Nr. …" – the number only counts when its label follows right away
  for (const m of text.matchAll(INLINE_SALUTED_PHONE_VERB)) {
    const start = (m.index ?? 0) + m[0].length;
    const slice = text.slice(start, start + 120);
    const phone = /^.{0,40}?(?:Tel|Telefon)/is.test(slice) ? extractPhones(slice)[0] : undefined;
    add({ name: m[1], ...(phone ? { phone } : {}) });
  }

  // 5) "Herr Müller (02051/ 317-501)"
  for (const m of text.matchAll(SALUTED_WITH_BRACKET_PHONE)) {
    const phone = cleanPhone(m[2]);
    if (phone) add({ name: m[1], phone });
  }

  // 6) "Herr Müller", "Frau Dr. Probe" anywhere – except next to legal / board / data-protection wording
  for (const m of text.matchAll(SALUTED_ANYWHERE)) {
    const index = m.index ?? 0;
    const lineStart = text.lastIndexOf('\n', index) + 1;
    if (NOT_HR_CONTEXT.test(text.slice(Math.max(lineStart, index - 80), index))) continue;
    add({ name: m[1] });
  }

  // 7) bare name after a contact phrase, backed by a phone / mail label
  for (const m of text.matchAll(CONTACT_PHRASE_NAME)) add({ name: m[1] });

  return people;
}

/** Everything that can be stated with confidence about who to contact. */
export function extractContact(text: string | undefined | null): ContactInfo {
  return { emails: extractEmails(text), phones: extractPhones(text), people: extractPeople(text) };
}
