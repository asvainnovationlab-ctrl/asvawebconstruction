import sanitizeHtml from 'sanitize-html';

/**
 * Allow-list sanitiser for rich text produced by the admin editor. Applied before storage;
 * the web app applies the same policy again before rendering (defence in depth).
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'pre', 'blockquote',
    'ul', 'ol', 'li', 'a', 'img', 'hr', 'br', 'figure', 'figcaption', 'mark', 'sub', 'sup',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    pre: ['class'],
  },
  allowedClasses: { code: [/^language-[a-z0-9-]+$/], pre: [/^language-[a-z0-9-]+$/] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    h1: 'h2',
    a: (tagName, attribs) => {
      const attrs: Record<string, string> = { ...attribs };
      if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
      else delete attrs.target;
      return { tagName, attribs: attrs };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
};

export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, OPTIONS).trim();
}

/** Strips all markup — for fields that must be plain text. */
export function stripHtml(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} });
}
