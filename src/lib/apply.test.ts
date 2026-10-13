import { describe, expect, it } from 'vitest';
import { isArbeitsagenturUrl, pickCompanyUrl, resolveApplyUrl, toAbsoluteUrl } from './apply';

const OFFER = 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10001-1-S';

describe('toAbsoluteUrl', () => {
  it('adds https to bare hosts and leaves full URLs alone', () => {
    expect(toAbsoluteUrl('www.firma.de')).toBe('https://www.firma.de');
    expect(toAbsoluteUrl('http://firma.de/jobs')).toBe('http://firma.de/jobs');
  });
});

describe('isArbeitsagenturUrl', () => {
  it.each(['arbeitsagentur.de', 'http://www.arbeitsagentur.de', 'https://www.arbeitsagentur.de/jobsuche', 'rest.arbeitsagentur.de'])(
    'recognises %s',
    (url) => expect(isArbeitsagenturUrl(url)).toBe(true)
  );

  it.each(['www.deichmann.com', 'https://notarbeitsagentur.de', 'https://arbeitsagentur.de.evil.com'])(
    'does not match %s',
    (url) => expect(isArbeitsagenturUrl(url)).toBe(false)
  );
});

describe('resolveApplyUrl', () => {
  it('uses the employer link when the offer has one', () => {
    expect(resolveApplyUrl([undefined, undefined, 'www.deichmann.com'], OFFER)).toBe('https://www.deichmann.com');
  });

  it('prefers an external application link over the company site', () => {
    expect(resolveApplyUrl(['https://jobs.firma.de/apply/1', undefined, 'www.firma.de'], OFFER)).toBe(
      'https://jobs.firma.de/apply/1'
    );
  });

  it('falls back to the offer page when the only link is the Arbeitsagentur start page', () => {
    expect(resolveApplyUrl([undefined, undefined, 'http://www.arbeitsagentur.de'], OFFER)).toBe(OFFER);
    expect(resolveApplyUrl([undefined, undefined, 'arbeitsagentur.de'], OFFER)).toBe(OFFER);
  });

  it('falls back to the offer page without any link, with blanks or with junk', () => {
    expect(resolveApplyUrl([], OFFER)).toBe(OFFER);
    expect(resolveApplyUrl(['', '   ', null, 42], OFFER)).toBe(OFFER);
    expect(resolveApplyUrl(['javascript:alert(1)'], OFFER)).toBe(OFFER);
  });
});

describe('pickCompanyUrl', () => {
  it('skips Arbeitsagentur links and returns the next real one', () => {
    expect(pickCompanyUrl(['arbeitsagentur.de', 'www.firma.de'])).toBe('https://www.firma.de');
    expect(pickCompanyUrl(['arbeitsagentur.de'])).toBeNull();
  });
});
