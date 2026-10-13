import { describe, expect, it } from 'vitest';
import { extractContact, extractEmails, extractPeople, extractPhones, toTelHref } from './contact';

describe('extractEmails', () => {
  it('finds an address inside prose and drops the sentence-ending dot', () => {
    expect(extractEmails('Bewirb dich per Mail an karriere@firma.de.')).toEqual(['karriere@firma.de']);
  });

  it('finds addresses in Markdown and links', () => {
    expect(extractEmails('**Kontakt:** [jobs@beispiel-gmbh.com](mailto:jobs@beispiel-gmbh.com)')).toEqual([
      'jobs@beispiel-gmbh.com',
    ]);
  });

  it('removes duplicates case-insensitively and keeps order', () => {
    expect(extractEmails('a@x.de, B@y.de und A@X.DE')).toEqual(['a@x.de', 'B@y.de']);
  });

  it('supports subdomains, plus-tags and underscores', () => {
    expect(extractEmails('max_muster+job@hr.example.co.uk')).toEqual(['max_muster+job@hr.example.co.uk']);
  });

  it('ignores retina image file names', () => {
    expect(extractEmails('<img src="logo@2x.png"> kontakt@firma.de')).toEqual(['kontakt@firma.de']);
  });

  it('returns an empty list when there is none', () => {
    expect(extractEmails('Keine Adresse hier, nur @ und foo@bar')).toEqual([]);
    expect(extractEmails(undefined)).toEqual([]);
    expect(extractEmails('')).toEqual([]);
  });
});

describe('extractPhones', () => {
  it.each([
    ['Tel.: +49 (0) 5131 123456', '+49 (0) 5131 123456'],
    ['Telefon 040/41902-321', '040/41902-321'],
    ['Telefon: 0511 120-4743', '0511 120-4743'],
    ['Phone: 0228 933790', '0228 933790'],
    ['Mobil: +49 1520 2712492', '+49 1520 2712492'],
    ['Tel.-Nr.: 02143 28320', '02143 28320'],
    ['Telefonnummer:\n+49 (3741) 250410', '+49 (3741) 250410'],
    ['[tel. +49 681 99 20 26 2]', '+49 681 99 20 26 2'],
    ['(Tel.: 06561/15-2070)', '06561/15-2070'],
  ])('reads %j', (text, expected) => {
    expect(extractPhones(text)).toEqual([expected]);
  });

  it('reads the visible number of a markdown tel link', () => {
    expect(extractPhones('Tel.-Nr. [07162 948150-827](https://tel:00497162948150827) gerne')).toEqual(['07162 948150-827']);
  });

  it('never returns fax numbers', () => {
    expect(extractPhones('Fax: +49 34244 50342')).toEqual([]);
    expect(extractPhones('Telefon 0511 111111, Fax 0511 222222')).toEqual(['0511 111111']);
  });

  it('ignores numbers that are not introduced by a phone label', () => {
    expect(extractPhones('Stellen-Nr.: 189547, Bewerbungsfrist bis 30.04.2027, PLZ 04838')).toEqual([]);
    expect(extractPhones('Ruf uns an unter 0511 123456')).toEqual([]);
  });

  it('rejects dates, years and too-short numbers after a label', () => {
    expect(extractPhones('Telefon 30.04.2027')).toEqual([]);
    expect(extractPhones('Mobil 2027 und mehr')).toEqual([]);
    expect(extractPhones('Tel. 12345')).toEqual([]);
  });

  it('never runs a number into the next line (postcodes, dates)', () => {
    expect(extractPhones('Telefon: 0511 123456\n30159 Hannover')).toEqual(['0511 123456']);
    expect(extractPhones('Tel. 0511 123456\n\n2027')).toEqual(['0511 123456']);
  });

  it('does not match inside longer words', () => {
    expect(extractPhones('Telefonisch erreichbar 0511 123456')).toEqual([]);
  });

  it('removes duplicates written in different formats', () => {
    expect(extractPhones('Tel. 0511 123456 oder Telefon: 0511-123456')).toEqual(['0511 123456']);
  });
});

describe('toTelHref', () => {
  it('builds dialable links', () => {
    expect(toTelHref('+49 (0) 365 828 1967')).toBe('tel:+493658281967');
    expect(toTelHref('0511 120-4743')).toBe('tel:05111204743');
    expect(toTelHref('0049 511 123456')).toBe('tel:+49511123456');
  });
});

describe('extractPeople', () => {
  it('reads a salutation line below a label line', () => {
    expect(extractPeople('Ansprechperson:\n\nFrau Erika Mustermann\nTelefon: 0511 1')).toEqual([{ name: 'Frau Erika Mustermann' }]);
    expect(extractPeople('### Dein Kontakt:\n\nFrau Erika Beispiel\n')).toEqual([{ name: 'Frau Erika Beispiel' }]);
  });

  it('reads an inline label', () => {
    expect(extractPeople('**Ansprechpartner: Max Beispiel**')).toEqual([{ name: 'Max Beispiel' }]);
    expect(extractPeople('deine Ansprechpartnerin ist Frau Muster!')).toEqual([{ name: 'Frau Muster' }]);
    expect(extractPeople('Dein Ansprechpartner ist Herr Probst.')).toEqual([{ name: 'Herr Probst' }]);
  });

  it('reads a name with its role and phone from one line', () => {
    expect(extractPeople('Erika Muster, Zentrale Praxisanleiterin | Telefon +49 (0) 365 828 1967')).toEqual([
      { name: 'Erika Muster', role: 'Zentrale Praxisanleiterin', phone: '+49 (0) 365 828 1967' },
    ]);
  });

  it('attaches a phone only when the text puts it directly next to the person', () => {
    expect(extractPeople('steht Dir Frau Erika Probe unter der Tel.-Nr. [07162 948150-827](https://tel:00497162948150827) gerne zur Verfügung')).toEqual([
      { name: 'Frau Erika Probe', phone: '07162 948150-827' },
    ]);
    expect(extractPeople('beantworten Ihnen gerne Herr Alt (02051 / 317-505) oder Herr Neu (02051/ 317-501).')).toEqual([
      { name: 'Herr Alt', phone: '02051 / 317-505' },
      { name: 'Herr Neu', phone: '02051/ 317-501' },
    ]);
  });

  it('reads a labelled number in brackets right after the name', () => {
    expect(extractPeople('freut sich Frau Erika Probe (Tel.: +49 511 762-3457) auf Ihren Anruf')).toEqual([
      { name: 'Frau Erika Probe', phone: '+49 511 762-3457' },
    ]);
    expect(extractPeople('steht Herr Max Beispiel (Tel.: 0511 123456, E-Mail: a@b.de) zur Verfügung')).toEqual([
      { name: 'Herr Max Beispiel', phone: '0511 123456' },
    ]);
  });

  it('takes a name after "Frau" / "Herr" / "Herrn" wherever it stands', () => {
    expect(extractPeople('Hörmann KG\nFrau Lisa Erdmann\nGewerbeallee 17')).toEqual([{ name: 'Frau Lisa Erdmann' }]);
    expect(extractPeople('Bitte senden Sie die Unterlagen an Herrn Dr. Probst, Hauptstr. 1')).toEqual([{ name: 'Herr Dr. Probst' }]);
    expect(extractPeople('bewerben Sie sich zu Händen Frau Grossgart.')).toEqual([{ name: 'Frau Grossgart' }]);
    expect(extractPeople('Herr Hans-Jürgen Wieland - bewerbung@x.de')).toEqual([{ name: 'Herr Hans-Jürgen Wieland' }]);
  });

  it('cuts words that follow the name but are not part of it', () => {
    expect(extractPeople('Frau Erika Probe Telefon: 0511 123456')).toEqual([{ name: 'Frau Erika Probe' }]);
    expect(extractPeople('Herr Muster Ausbildungsleiter')).toEqual([{ name: 'Herr Muster' }]);
  });

  it('rejects a salutation that is followed by a role or an ordinary word', () => {
    expect(extractPeople('Frau Geschäftsführerin Beispiel')).toEqual([]);
    expect(extractPeople('Herr Ausbildung')).toEqual([]);
    expect(extractPeople('Frau Bewerbung bitte')).toEqual([]);
  });

  it('skips names next to board, imprint or data-protection wording', () => {
    expect(extractPeople('Datenschutzbeauftragter: Herr Max Muster')).toEqual([]);
    expect(extractPeople('Geschäftsführer Herr Max Muster')).toEqual([]);
    expect(extractPeople('Inhaber: Frau Erika Muster')).toEqual([]);
    expect(extractPeople('Impressum – Vertreten durch Herrn Muster')).toEqual([]);
  });

  it('accepts a bare name after a contact phrase only when a phone / mail label backs it up', () => {
    expect(extractPeople('Bei Fragen wenden Sie sich gerne an:\nMaria Beispiel\nTelefonnummer:\n+49 3741 250410')).toEqual([
      { name: 'Maria Beispiel' },
    ]);
    expect(extractPeople('Bei Fragen wenden Sie sich gerne an:\nMaria Beispiel\n\nWir freuen uns auf dich.')).toEqual([]);
    expect(extractPeople('wenden Sie sich an die Karl Dahm Gruppe, E-Mail info@x.de')).toEqual([]);
  });

  it('ignores departments, generic nouns and neutral words', () => {
    expect(extractPeople('Ansprechpartner: Personalabteilung Musterstadt')).toEqual([]);
    expect(extractPeople('Ansprechpartner: Human Resources')).toEqual([]);
    expect(extractPeople('Kontakt: Bewerbung online')).toEqual([]);
    expect(extractPeople('Egal ob Frau oder Mann, wir freuen uns auf dich')).toEqual([]);
    expect(extractPeople('Du bist Ansprechpartner/in für Bürger')).toEqual([]);
    expect(extractPeople('Frauen und Männer sind willkommen. Herren- und Damenmode')).toEqual([]);
    expect(extractPeople('Herr/Frau Muster')).toEqual([]);
  });

  it('never reads a name across a line break', () => {
    expect(extractPeople('Ansprechpartner: Erika Muster\nBewerbung bitte per Mail')).toEqual([{ name: 'Erika Muster' }]);
  });

  it('merges a short mention into the fuller name', () => {
    const people = extractPeople('Ansprechpartner: Erika Muster\n\nSprechen Sie gerne mit Frau Muster, Ansprechpartnerin ist Frau Muster.');
    expect(people).toHaveLength(1);
    expect(people[0].name).toBe('Erika Muster');
  });
});

describe('extractContact', () => {
  it('combines all three and is empty for plain text', () => {
    const c = extractContact('Ansprechperson:\nFrau Erika Probe\nTelefon: 0511 123456\nMail: erika@probe.de');
    expect(c.people.map((p) => p.name)).toEqual(['Frau Erika Probe']);
    expect(c.phones).toEqual(['0511 123456']);
    expect(c.emails).toEqual(['erika@probe.de']);
    expect(extractContact('Wir bieten eine tolle Ausbildung.')).toEqual({ emails: [], phones: [], people: [] });
  });
});
