import { describe, expect, it } from 'vitest';
import { toPlainText } from './plaintext';

describe('toPlainText', () => {
  it('strips Markdown', () => {
    expect(toPlainText('### Titel\n\n**fett** und *kursiv* mit [Link](https://x.de)')).toBe('Titel\n\nfett und kursiv mit Link');
  });

  it('turns bullets into dashes', () => {
    expect(toPlainText(' * eins\n * zwei\n• drei')).toBe('- eins\n- zwei\n- drei');
  });

  it('strips HTML and keeps block breaks', () => {
    expect(toPlainText('<p>Eins</p><p>Zwei<br>drei</p>')).toBe('Eins\nZwei\ndrei');
    expect(toPlainText('<ul><li>a</li><li>b</li></ul>')).toBe('- a\n- b');
  });

  it('decodes entities', () => {
    expect(toPlainText('Müller&nbsp;&amp;&nbsp;Söhne &#228;')).toBe('Müller & Söhne ä');
  });

  it('removes leftovers of broken bold markers', () => {
    expect(toPlainText('Vergütung:**** 1080€')).toBe('Vergütung: 1080€');
    expect(toPlainText('Melde dich einfach bei uns! \\\\**')).toBe('Melde dich einfach bei uns!');
  });

  it('keeps hashtags and arrows, they are real text', () => {
    expect(toPlainText('#AusbildungAltmark2027 -> melde dich')).toBe('#AusbildungAltmark2027 -> melde dich');
  });

  it('collapses blank lines and handles empty input', () => {
    expect(toPlainText('a\r\n\r\n\r\n\r\nb')).toBe('a\n\nb');
    expect(toPlainText(undefined)).toBe('');
    expect(toPlainText('')).toBe('');
  });

  it('leaves no markup characters behind', () => {
    expect(toPlainText('<div class="x">Hallo <b>Welt</b></div>')).toBe('Hallo Welt');
  });
});
