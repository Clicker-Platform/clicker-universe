import DOMPurify from 'isomorphic-dompurify';

const SVG_TAGS = [
    'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse',
    'defs', 'linearGradient', 'radialGradient', 'stop', 'mask', 'clipPath', 'title',
];

const SVG_ATTRS = [
    'viewBox', 'xmlns', 'class', 'transform', 'opacity',
    'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin',
    'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
    'points', 'width', 'height', 'offset', 'stop-color',
];

// Runs AFTER DOMPurify, which normalizes attribute quotes to double quotes.
// Do not call on raw/untrusted input or single-quoted/unquoted attrs will bypass.
function normalizeColors(svg: string): string {
    return svg.replace(/(stroke|fill)="([^"]*)"/g, (_match, attr, value) => {
        const v = value.trim().toLowerCase();
        if (v === 'none' || v === 'currentcolor' || v === '') return `${attr}="${value}"`;
        return `${attr}="currentColor"`;
    });
}

function forceRootSize(svg: string): string {
    return svg.replace(/<svg\b([^>]*)>/i, (_full, attrs) => {
        const cleaned = (attrs as string)
            .replace(/(^|\s)width\s*=\s*"[^"]*"/i, '')
            .replace(/(^|\s)height\s*=\s*"[^"]*"/i, '');
        return `<svg${cleaned} width="1em" height="1em">`;
    });
}

export function sanitizeSvgIcon(input: string | null | undefined): string {
    if (!input) return '';
    const trimmed = input.trim();
    if (!trimmed.toLowerCase().includes('<svg')) return '';

    const purified = DOMPurify.sanitize(trimmed, {
        ALLOWED_TAGS: SVG_TAGS,
        ALLOWED_ATTR: SVG_ATTRS,
        FORBID_ATTR: ['href', 'xlink:href', 'style'],
        FORBID_TAGS: ['script', 'style', 'foreignObject'],
    });

    if (!purified || !purified.toLowerCase().includes('<svg')) return '';

    const normalized = normalizeColors(purified);
    const sized = forceRootSize(normalized);
    return sized;
}
