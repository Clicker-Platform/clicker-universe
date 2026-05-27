import DOMPurify from 'isomorphic-dompurify';

// Accepts:
//   color: #abc | #aabbcc | #aabbccdd
//   color: rgb(r, g, b)        — integers 0-255, decimals not allowed
//   color: rgba(r, g, b, a)    — a is 0-1 with optional decimal
// Browser CSSOM normalizes inline-style hex into rgb() form on innerHTML
// serialization, so we must accept the rgb form on the round-trip even though
// the editor's color picker only produces hex.
const HEX_RE  = String.raw`#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})`;
const RGB_RE  = String.raw`rgb\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*\)`;
const RGBA_RE = String.raw`rgba\(\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:25[0-5]|2[0-4]\d|1?\d?\d)\s*,\s*(?:0|1|0?\.\d+)\s*\)`;

const HEX_DECLARATION = new RegExp(`^(color|background-color)\\s*:\\s*(${HEX_RE}|${RGB_RE}|${RGBA_RE})$`);

let richTextSanitizationActive = false;

/**
 * Keep only `color` and `background-color` style declarations whose value is
 * an accepted hex / rgb() / rgba() literal. Returns either a sanitized style
 * string or empty (in which case the caller drops the attribute entirely).
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
