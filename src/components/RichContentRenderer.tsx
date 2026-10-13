import { useMemo } from 'react';
import { marked } from 'marked';

interface RichContentRendererProps {
  content: string;
  className?: string;
}

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,    // GFM line breaks
  gfm: true,       // GitHub Flavored Markdown
});

/**
 * Renders a string that may be Markdown, HTML, or plain text.
 * - Markdown (#, ##, -, **bold**) → parsed via `marked`
 * - HTML tags → rendered directly (dangerouslySetInnerHTML)
 * - Plain text → split into paragraphs
 */
export default function RichContentRenderer({ content, className = '' }: RichContentRendererProps) {
  const html = useMemo(() => {
    if (!content || !content.trim()) return '';

    const looksLikeHtml = /<[a-z][\s\S]*>/i.test(content);

    // Pre-process to detect tagline-like isolated lines (only if not raw HTML)
    let processedContent = content;
    if (!looksLikeHtml) {
      // The API sends bullets as " * item" (indented), which Markdown would not treat as a list
      processedContent = processedContent.replace(/^[^\S\r\n]*[*•][^\S\r\n]+/gm, '- ');
      processedContent = processedContent
        .split(/\n{2,}/)
        .map((chunk) => {
          const t = chunk.trim();
          // A tagline is short, single-line, and not already a markdown list/heading
          const isTagline =
            t.length >= 2 &&
            t.length <= 85 &&
            !t.includes('\n') &&
            !/^[-*•]/.test(t) &&
            !/^#{1,6}\s/.test(t);
            
          if (isTagline) {
            return `<span class="detail-tagline">${t}</span>`;
          }
          return chunk;
        })
        .join('\n\n');
    }

    const looksLikeMarkdown = /^#{1,6}\s|^\*\*|^-\s|^\d+\.\s/m.test(processedContent);

    if (looksLikeMarkdown) {
      return marked.parse(processedContent, { async: false }) as string;
    }

    if (looksLikeHtml) {
      return content;
    }

    // Plain text fallback: wrap paragraphs in <p> tags
    return processedContent
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p}</p>`)
      .join('');
  }, [content]);

  if (!html) return null;

  return (
    <div
      className={`detail-rich-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
