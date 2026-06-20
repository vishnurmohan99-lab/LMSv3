import sanitizeHtml from 'sanitize-html';

export function sanitizePrompt(html: string): string {
  const publicBase = process.env.R2_PUBLIC_BASE_URL ?? '';

  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'span', 'ul', 'ol', 'li', 'img'],
    allowedAttributes: {
      span: ['style'],
      img: ['src', 'alt'],
    },
    allowedStyles: {
      span: {
        'font-size': [/^\d+(?:px|em|rem|%)$/],
      },
    },
    allowedSchemesByTag: { img: ['https'] },
    exclusiveFilter: (frame) => {
      if (frame.tag !== 'img') return false;
      const src = frame.attribs.src ?? '';
      return publicBase.length > 0 && !src.startsWith(publicBase);
    },
  });
}
