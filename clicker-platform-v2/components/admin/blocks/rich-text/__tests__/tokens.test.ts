import { describe, it, expect } from 'vitest';
import {
    COLOR_TOKENS,
    SIZE_TOKENS,
    LINE_HEIGHT_TOKENS,
    isColorToken,
    isSizeToken,
    isLineHeightToken,
} from '../tokens';

describe('tokens', () => {
    it('exposes exactly 6 color tokens with stable IDs', () => {
        // Reduced from 8 to 6 per Task 0 finding — secondary and danger are
        // not defined in any template; deferred to Color Styles work.
        expect(COLOR_TOKENS.map(t => t.id)).toEqual([
            'foreground', 'muted', 'primary',
            'accent', 'success', 'warning',
        ]);
    });

    it('every color token has a CSS variable reference', () => {
        for (const t of COLOR_TOKENS) {
            expect(t.cssVar).toMatch(/^var\(--theme-[a-z-]+\)$/);
        }
    });

    it('exposes exactly 5 size tokens with px values', () => {
        expect(SIZE_TOKENS.map(t => t.id)).toEqual(['xs', 's', 'm', 'l', 'xl']);
        expect(SIZE_TOKENS.find(t => t.id === 'm')!.px).toBe(16);
    });

    it('exposes 4 line-height tokens with multipliers', () => {
        expect(LINE_HEIGHT_TOKENS.map(t => t.id)).toEqual([
            'tight', 'normal', 'relaxed', 'loose',
        ]);
        expect(LINE_HEIGHT_TOKENS.find(t => t.id === 'normal')!.multiplier).toBe(1.0);
    });

    it('isColorToken narrows correctly', () => {
        expect(isColorToken('primary')).toBe(true);
        expect(isColorToken('nope')).toBe(false);
    });

    it('isSizeToken narrows correctly', () => {
        expect(isSizeToken('m')).toBe(true);
        expect(isSizeToken('xxl')).toBe(false);
    });

    it('isLineHeightToken narrows correctly', () => {
        expect(isLineHeightToken('tight')).toBe(true);
        expect(isLineHeightToken('extra-tight')).toBe(false);
    });
});
