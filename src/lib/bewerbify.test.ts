import { describe, expect, it } from 'vitest';
import type { JobDetail } from '../types';
import { buildBewerbify, bewerbifyForPosting, getBewerbifyBase, pickApplicationEmail, pickContact } from './bewerbify';
import { extractContact } from './contact';

const BASE = 'https://bewerbify.test';

/** Parses the fragment of a generated link back into its parameters. */
function paramsOf(url: string): URLSearchParams {
  const hash = new URL(url).hash;
  expect(hash.startsWith('#')).toBe(true);
  return new URLSearchParams(hash.slice(1));
}

describe('getBewerbifyBase', () => {
  it('uses the configured address without a trailing slash', () => {
    expect(getBewerbifyBase('https://app.example.org/')).toBe('https://app.example.org');
  });

  it('falls back to the default when unset, blank or invalid', () => {
    const fallback = getBewerbifyBase('');
    expect(fallback).toMatch(/^https:\/\//);
    expect(getBewerbifyBase(undefined)).toBe(fallback);
    expect(getBewerbifyBase('   ')).toBe(fallback);
    expect(getBewerbifyBase('not a url')).toBe(fallback);
    expect(getBewerbifyBase('javascript:alert(1)')).toBe(fallback);
  });
});

describe('buildBewerbify', () => {
  it('puts every value in the fragment, never in the query string', () => {
    const { url } = buildBewerbify(
      {
        company: 'Lungenclinic Hemer GmbH',
        street: 'Theo-Funccius-Str. 1',
        city: '58675 Hemer',
        emails: ['bewerbung@lungenclinic.de'],
        people: [{ name: 'Frau Anna Risse' }],
        description: 'Wir bilden aus.',
        ref: '10001-1003851416-S',
      },
      BASE
    );

    expect(url.startsWith(`${BASE}/apply#`)).toBe(true);
    expect(new URL(url).search).toBe('');
    const p = paramsOf(url);
    expect(Object.fromEntries(p)).toEqual({
      v: '1',
      company: 'Lungenclinic Hemer GmbH',
      street: 'Theo-Funccius-Str. 1',
      city: '58675 Hemer',
      email: 'bewerbung@lungenclinic.de',
      salutation: 'Frau',
      contact: 'Risse',
      description: 'Wir bilden aus.',
      ref: '10001-1003851416-S',
    });
  });

  it('omits what it does not know instead of sending empty or "undefined" values', () => {
    const { url } = buildBewerbify({ company: 'Firma', street: '  ', city: undefined, emails: [], people: [] }, BASE);
    expect(Object.fromEntries(paramsOf(url))).toEqual({ v: '1', company: 'Firma' });
    expect(url).not.toMatch(/undefined|null|=(&|$)/);
  });

  it('reports whether an e-mail address is in the link', () => {
    expect(buildBewerbify({ emails: ['a@firma.de'] }, BASE).hasEmail).toBe(true);
    expect(buildBewerbify({ emails: [] }, BASE).hasEmail).toBe(false);
    expect(buildBewerbify({ emails: ['x@a.de', 'y@b.de'] }, BASE).hasEmail).toBe(false);
  });

  it('cuts the values to their maximum lengths', () => {
    const p = paramsOf(buildBewerbify({ company: 'A'.repeat(300), street: 'B'.repeat(300), city: 'C'.repeat(300) }, BASE).url);
    expect(p.get('company')).toHaveLength(120);
    expect(p.get('street')).toHaveLength(120);
    expect(p.get('city')).toHaveLength(80);
  });

  it('encodes umlauts, ampersands and line breaks so they survive the round trip', () => {
    const { url } = buildBewerbify({ company: 'Müller & Söhne', description: 'Zeile eins\n\nZeile zwei & mehr' }, BASE);
    const p = paramsOf(url);
    expect(p.get('company')).toBe('Müller & Söhne');
    expect(p.get('description')).toBe('Zeile eins\n\nZeile zwei & mehr');
  });

  it('turns Markdown and HTML into plain text', () => {
    const p = paramsOf(
      buildBewerbify(
        { description: '## Über uns\n\n**Wir** sind [ein Team](https://x.de).\n\n<p>Aufgaben:</p><ul><li>Kochen</li></ul>' },
        BASE
      ).url
    );
    const text = p.get('description') ?? '';
    expect(text).toContain('Über uns');
    expect(text).toContain('Wir sind ein Team.');
    expect(text).toContain('- Kochen');
    expect(text).not.toMatch(/[#*<>\]]/);
  });

  it('sends the full text, including legal sections', () => {
    const text = 'Wir sind ein Familienbetrieb.\n\nDatenschutzhinweis: Ihre Daten werden gespeichert.\n\nDu lernst Kochen.';
    const description = paramsOf(buildBewerbify({ description: text }, BASE).url).get('description');
    expect(description).toBe(text);
  });

  it('keeps a very long posting whole up to 30000 characters', () => {
    const long = Array.from({ length: 2000 }, (_, i) => `Absatz ${i} ` + 'Wörter mit Umlauten äöü ').join('\n\n');
    const { url } = buildBewerbify({ company: 'Firma', description: long }, BASE);
    const description = paramsOf(url).get('description') ?? '';
    expect(description.length).toBeLessThanOrEqual(30000);
    expect(description.length).toBeGreaterThan(29900);
    expect(description.startsWith('Absatz 0')).toBe(true);
    // Cut at a word boundary: the last word is a whole word of the source text
    const lastWord = description.split(/\s+/).pop() ?? '';
    expect(/^(?:Wörter|mit|Umlauten|äöü|\d+)$/.test(lastWord)).toBe(true);
  });

  it('does not cut a posting under the limit', () => {
    const text = Array.from({ length: 300 }, (_, i) => `Absatz ${i}`).join('\n\n');
    expect(paramsOf(buildBewerbify({ description: text }, BASE).url).get('description')).toBe(text);
  });
});

describe('pickApplicationEmail', () => {
  it('takes a single address', () => {
    expect(pickApplicationEmail(['info@firma.de'])).toBe('info@firma.de');
  });

  it('with several, only an application-style address counts', () => {
    expect(pickApplicationEmail(['info@firma.de', 'bewerbung@firma.de'])).toBe('bewerbung@firma.de');
    expect(pickApplicationEmail(['info@firma.de', 'kontakt@firma.de'])).toBeUndefined();
    expect(pickApplicationEmail(['bewerbung@a.de', 'karriere@a.de'])).toBeUndefined();
  });

  it('never offers data-protection or no-reply addresses', () => {
    expect(pickApplicationEmail(['datenschutz@firma.de'])).toBeUndefined();
    expect(pickApplicationEmail(['noreply@firma.de', 'jobs@firma.de'])).toBe('jobs@firma.de');
  });

  it('rejects anything that is not shaped like an address', () => {
    expect(pickApplicationEmail(['kein-at.de', 'a@b', 'a b@c.de'])).toBeUndefined();
    expect(pickApplicationEmail(undefined)).toBeUndefined();
  });

  it('ignores duplicates', () => {
    expect(pickApplicationEmail(['a@firma.de', 'a@firma.de'])).toBe('a@firma.de');
  });
});

describe('pickContact', () => {
  it('returns salutation and last name only', () => {
    expect(pickContact([{ name: 'Frau Kerstin Crantz' }])).toEqual({ salutation: 'Frau', contact: 'Crantz' });
    expect(pickContact([{ name: 'Herr Dr. Probst' }])).toEqual({ salutation: 'Herr', contact: 'Probst' });
    expect(pickContact([{ name: 'Frau Prof. Dr. Anna Muster-Schmidt' }])).toEqual({ salutation: 'Frau', contact: 'Muster-Schmidt' });
    expect(pickContact([{ name: 'Herr Hans-Jürgen Wieland' }])).toEqual({ salutation: 'Herr', contact: 'Wieland' });
  });

  it('omits both when the salutation is unknown', () => {
    expect(pickContact([{ name: 'Marco Beckmann' }])).toBeUndefined();
  });

  it('omits both when several people are named (unclear who is meant)', () => {
    expect(pickContact([{ name: 'Herr Alt' }, { name: 'Frau Neu' }])).toBeUndefined();
    expect(pickContact([])).toBeUndefined();
    expect(pickContact(undefined)).toBeUndefined();
  });
});

describe('bewerbifyForPosting', () => {
  const detail = {
    firma: 'Lungenclinic Hemer GmbH',
    referenznummer: '10001-1003851416-S',
    stellenlokationen: [
      { adresse: { strasse: 'Theo-Funccius-Str.', hausnummer: '1', plz: '58675', ort: 'Hemer' } },
      { adresse: { strasse: 'Zweitweg', hausnummer: '9', plz: '12345', ort: 'Andernorts' } },
    ],
    stellenangebotsBeschreibung: 'Wir bilden aus.\n\nAnsprechperson:\nFrau Anna Risse\nE-Mail: bewerbung@lungenclinic.de',
  } as JobDetail;

  it('fills the form from the posting and its extracted contact, using the first location', () => {
    const { url, hasEmail } = bewerbifyForPosting(detail, extractContact(detail.stellenangebotsBeschreibung), BASE);
    const p = paramsOf(url);
    expect(hasEmail).toBe(true);
    expect(p.get('company')).toBe('Lungenclinic Hemer GmbH');
    expect(p.get('street')).toBe('Theo-Funccius-Str. 1');
    expect(p.get('city')).toBe('58675 Hemer');
    expect(p.get('email')).toBe('bewerbung@lungenclinic.de');
    expect(p.get('salutation')).toBe('Frau');
    expect(p.get('contact')).toBe('Risse');
    expect(p.get('ref')).toBe('10001-1003851416-S');
  });

  it('works for a posting without a street, an e-mail or a contact', () => {
    const bare = { firma: 'Firma', referenznummer: 'r-1', stellenlokationen: [{ adresse: { plz: '04838', ort: 'Doberschütz' } }] } as JobDetail;
    const { url, hasEmail } = bewerbifyForPosting(bare, extractContact(''), BASE);
    expect(hasEmail).toBe(false);
    expect(Object.fromEntries(paramsOf(url))).toEqual({ v: '1', company: 'Firma', city: '04838 Doberschütz', ref: 'r-1' });
  });
});
