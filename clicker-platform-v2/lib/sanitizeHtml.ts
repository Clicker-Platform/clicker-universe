import DOMPurify from 'isomorphic-dompurify';

const HEX_DECLARATION = /^(color|background-color)\s*:\s*(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))$/;

let richTextSanitizationActive = false;

/**
 * Keep only `color: #hex` and `background-color: #hex` style declarations.
 * Returns either a sanitized style string or empty (in which case the caller
 * drops the attribute entirely).
 */
function sanitizeStyleValue(value: string): string {
    const declarations = value.split(';').map(s => s.trim()).filter(Boolean);
    const safe: string[] = [];
    for (const decl of declarations) {
        const match = decl.match(HEX_DECLARATION);
        if (match) {
            safe.push(`${match[1]}: ${match[2]}`);
        }
    }
    return safe.join('; ');
}

// Global hook on the DOMPurify singleton; scoped to active rich-text calls only.
// Without the scoping flag, other DOMPurify consumers in the codebase
// (app/[tenant]/*) would also have their style attrs filtered, which would be
// a silent behavioral change.
DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (!richTextSanitizationActive) return;
    if (data.attrName !== 'style') return;
    const cleaned = sanitizeStyleValue(data.attrValue);
    if (cleaned) {
        data.attrValue = cleaned;
    } else {
        data.keepAttr = false;
    }
});

const RICH_TEXT_CONFIG = {
    ALLOWED_TAGS: [
        'p', 'br', 'hr', 'span', 'div',
        'strong', 'em', 'b', 'i', 'u', 's', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li',
        'blockquote', 'pre', 'code',
        'a', 'img',
        'iframe', 'video', 'source',
        'figure', 'figcaption',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    ALLOWED_ATTR: [
        'href', 'target', 'rel', 'title',
        'src', 'alt', 'width', 'height', 'loading',
        'class', 'style',
        'allow', 'allowfullscreen', 'frameborder',
        'controls', 'autoplay', 'muted', 'loop', 'playsinline', 'poster',
        'type',
        'colspan', 'rowspan',
        'data-video-embed', 'data-src', 'data-provider',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
};

export function sanitizeRichText(html: string | undefined | null): string {
    if (!html) return '';
    richTextSanitizationActive = true;
    try {
        return DOMPurify.sanitize(html, RICH_TEXT_CONFIG) as unknown as string;
    } finally {
        richTextSanitizationActive = false;
    }
}
