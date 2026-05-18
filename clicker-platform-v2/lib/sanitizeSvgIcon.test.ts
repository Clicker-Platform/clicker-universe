import { describe, it, expect } from 'vitest';
import { sanitizeSvgIcon } from './sanitizeSvgIcon';

const LUCIDE_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

describe('sanitizeSvgIcon', () => {
    it('returns empty string for non-SVG input', () => {
        expect(sanitizeSvgIcon('')).toBe('');
        expect(sanitizeSvgIcon('hello world')).toBe('');
        expect(sanitizeSvgIcon('<div>not svg</div>')).toBe('');
    });

    it('strips <script> tags', () => {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>alert(1)</script><path d="M1 1"/></svg>`;
        const out = sanitizeSvgIcon(malicious);
        expect(out).not.toContain('<script');
        expect(out).not.toContain('alert');
        expect(out).toContain('<path');
    });

    it('strips on* event handlers', () => {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="alert(1)"><path d="M1 1" onclick="alert(2)"/></svg>`;
        const out = sanitizeSvgIcon(malicious);
        expect(out).not.toContain('onload');
        expect(out).not.toContain('onclick');
        expect(out).not.toContain('alert');
    });

    it('strips href and xlink:href to prevent external refs', () => {
        const malicious = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><use href="http://evil.com/x.svg#a"/><use xlink:href="http://evil.com/y.svg#b"/></svg>`;
        const out = sanitizeSvgIcon(malicious);
        expect(out).not.toContain('evil.com');
        expect(out).not.toContain('href=');
    });

    it('preserves Lucide-shaped paste with currentColor stroke', () => {
        const out = sanitizeSvgIcon(LUCIDE_CHECK);
        expect(out).toContain('<svg');
        expect(out).toContain('<path');
        expect(out).toContain('d="M20 6 9 17l-5-5"');
        expect(out).toContain('currentColor');
    });

    it('normalizes hardcoded stroke color to currentColor', () => {
        const hardcoded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" stroke="#000000" fill="none"><path d="M1 1" stroke="#ff0000"/></svg>`;
        const out = sanitizeSvgIcon(hardcoded);
        expect(out).not.toContain('#000000');
        expect(out).not.toContain('#ff0000');
        expect(out.match(/currentColor/g)?.length).toBeGreaterThanOrEqual(2);
    });

    it('leaves fill="none" intact', () => {
        const out = sanitizeSvgIcon(LUCIDE_CHECK);
        expect(out).toContain('fill="none"');
    });

    it('forces width="1em" and height="1em" on root svg', () => {
        const out = sanitizeSvgIcon(LUCIDE_CHECK);
        expect(out).toMatch(/<svg[^>]*\swidth="1em"/);
        expect(out).toMatch(/<svg[^>]*\sheight="1em"/);
    });
});
