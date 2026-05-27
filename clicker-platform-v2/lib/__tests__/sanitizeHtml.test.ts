import { describe, it, expect } from 'vitest';
import { sanitizeRichText } from '../sanitizeHtml';

describe('sanitizeRichText — inline style allowlist', () => {
    it('keeps color: #hex', () => {
        const html = '<span style="color: #fff">x</span>';
        expect(sanitizeRichText(html)).toContain('style="color: #fff"');
    });

    it('keeps background-color: #hex', () => {
        const html = '<span style="background-color: #fde047">x</span>';
        expect(sanitizeRichText(html)).toContain('background-color: #fde047');
    });

    it('keeps 8-digit hex with alpha', () => {
        const html = '<span style="color: #a1b2c380">x</span>';
        expect(sanitizeRichText(html)).toContain('#a1b2c380');
    });

    it('strips named CSS colors', () => {
        const html = '<span style="color: red">x</span>';
        expect(sanitizeRichText(html)).not.toContain('color: red');
    });

    it('strips background with url()', () => {
        const html = '<span style="background: url(javascript:alert(1))">x</span>';
        const out = sanitizeRichText(html);
        expect(out).not.toMatch(/url/i);
        expect(out).not.toMatch(/javascript/i);
    });

    it('keeps valid color and drops malicious sibling declaration in same style', () => {
        const html = '<span style="color: #fff; background: url(x)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).toContain('color: #fff');
        expect(out).not.toMatch(/url/i);
    });

    it('strips CSS expression()', () => {
        const html = '<span style="color: expression(alert(1))">x</span>';
        const out = sanitizeRichText(html);
        expect(out).not.toMatch(/expression/i);
    });

    it('still strips <script> as before', () => {
        const html = '<p>safe</p><script>alert(1)</script>';
        expect(sanitizeRichText(html)).not.toMatch(/<script/i);
    });

    it('still strips onerror attributes as before', () => {
        const html = '<img src="x" onerror="alert(1)">';
        expect(sanitizeRichText(html)).not.toMatch(/onerror/i);
    });

    it('preserves rt-* classes (token-based formatting path)', () => {
        const html = '<span class="rt-color-primary">x</span>';
        expect(sanitizeRichText(html)).toContain('class="rt-color-primary"');
    });

    it('does not leak style filtering to direct DOMPurify.sanitize calls', async () => {
        const DOMPurify = (await import('isomorphic-dompurify')).default;
        // First, run our rich-text sanitizer to ensure the hook is registered.
        sanitizeRichText('<p>warmup</p>');
        // Now a direct DOMPurify call must NOT have its style attribute filtered.
        const html = '<span style="color: red; font-size: 99px">x</span>';
        const out = DOMPurify.sanitize(html);
        // 'red' is a named color we would normally strip — confirm it survives the direct call.
        expect(out).toContain('color: red');
    });

    it('keeps color: rgb(r, g, b) — browsers normalize hex to rgb via CSSOM', () => {
        const html = '<span style="color: rgb(161, 178, 195)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).toMatch(/style="color:\s*rgb\(161,\s*178,\s*195\)"/);
    });

    it('keeps background-color: rgb()', () => {
        const html = '<span style="background-color: rgb(254, 240, 138)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).toContain('background-color: rgb(254, 240, 138)');
    });

    it('keeps color: rgba(r, g, b, a) with alpha', () => {
        const html = '<span style="color: rgba(161, 178, 195, 0.5)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).toMatch(/rgba\(161,\s*178,\s*195,\s*0\.5\)/);
    });

    it('rejects rgb() with out-of-range numbers', () => {
        const html = '<span style="color: rgb(999, 0, 0)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).not.toMatch(/rgb\(999/);
    });

    it('rejects rgb() with non-numeric content', () => {
        const html = '<span style="color: rgb(red, 0, 0)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).not.toMatch(/rgb\(red/);
    });

    it('rejects rgba() with malformed alpha', () => {
        const html = '<span style="color: rgba(0, 0, 0, 2.5)">x</span>';
        const out = sanitizeRichText(html);
        expect(out).not.toMatch(/rgba\(0,\s*0,\s*0,\s*2\.5/);
    });
});
