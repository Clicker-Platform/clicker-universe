import DOMPurify from 'isomorphic-dompurify';

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
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ADD_ATTR: ['target'],
    FORBID_TAGS: ['script', 'style', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
};

export function sanitizeRichText(html: string | undefined | null): string {
    if (!html) return '';
    return DOMPurify.sanitize(html, RICH_TEXT_CONFIG) as unknown as string;
}
