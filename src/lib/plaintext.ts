/**
 * Job descriptions arrive as Markdown, HTML or plain text. These helpers turn them into clean plain text
 * (line breaks as "\n").
 */

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#160;': ' ',
  '&shy;': '',
};

function decodeEntities(text: string): string {
  return text
    .replace(/&(?:nbsp|amp|lt|gt|quot|apos|shy|#39|#160);/g, (m) => ENTITIES[m] ?? m)
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)));
}

/** Markdown / HTML / plain text -> plain text with "\n" line breaks. Never returns markup. */
export function toPlainText(source: string | undefined | null): string {
  if (!source) return '';

  let text = source.replace(/\r\n?/g, '\n');

  // HTML: block-level tags become line breaks, everything else is dropped
  text = text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|li|h[1-6]|tr|ul|ol|table|section)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '');

  text = decodeEntities(text);

  text = text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1') // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links keep their text
    .replace(/^[ \t]*#{1,6}[ \t]+/gm, '') // headings ("# Titel"; a hashtag has no space after the #)
    .replace(/^[ \t]*[*•][ \t]+/gm, '- ') // bullets
    .replace(/(\*\*|__)(.+?)\1/g, '$2') // bold
    .replace(/(?<![\w*])\*(?!\s)([^*\n]+?)\*(?![\w*])/g, '$1') // italic
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*{2,}/g, '') // leftovers of broken bold markers such as "****" or "\\**"
    .replace(/\\+(?=\s|$)/g, '') // stray backslashes at the end of a word or line
    .replace(/\\([*_#\-.[\]()])/g, '$1'); // markdown escapes

  return text
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
