import 'server-only';
import sanitizeHtml from 'sanitize-html';

/**
 * Second line of defence: the API sanitises rich text on write, and the web app sanitises it
 * again before rendering with the same allow-list.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ['p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 's', 'u', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'hr', 'br', 'figure', 'figcaption', 'mark', 'sub', 'sup'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'], img: ['src', 'alt', 'title', 'width', 'height', 'loading'], code: ['class'], pre: ['class'] },
  allowedClasses: { code: [/^language-[a-z0-9-]+$/], pre: [/^language-[a-z0-9-]+$/] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    h1: 'h2',
    a: (tagName, attribs) => {
      const attrs = { ...attribs };
      if (attrs.target === '_blank') attrs.rel = 'noopener noreferrer';
      else delete attrs.target;
      return { tagName, attribs: attrs };
    },
  },
};

export function sanitize(html: string | null | undefined): string {
  return html ? sanitizeHtml(html, OPTIONS) : '';
}
