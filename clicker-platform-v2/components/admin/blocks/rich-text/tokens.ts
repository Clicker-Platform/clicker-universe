export interface ColorToken {
    readonly id: string;
    readonly label: string;
    readonly cssVar: string;
}

export interface SizeToken {
    readonly id: string;
    readonly label: string;
    readonly px: number;
}

export interface LineHeightToken {
    readonly id: string;
    readonly label: string;
    readonly multiplier: number;
}

// Per Task 0 verification (2026-05-27): the spec's 8 tokens included
// `secondary`, `muted`, `danger` which are NOT defined in the platform's
// theme system. Decision (option B): drop secondary + danger; remap
// `muted` to the existing `--theme-text-muted` variable. 6 swatches total.
// Add the dropped tokens when the Color Styles system ships.
export const COLOR_TOKENS: readonly ColorToken[] = [
    { id: 'foreground', label: 'Default', cssVar: 'var(--theme-foreground)' },
    { id: 'muted',      label: 'Muted',   cssVar: 'var(--theme-text-muted)' },
    { id: 'primary',    label: 'Primary', cssVar: 'var(--theme-primary)' },
    { id: 'accent',     label: 'Accent',  cssVar: 'var(--theme-accent)' },
    { id: 'success',    label: 'Success', cssVar: 'var(--theme-success)' },
    { id: 'warning',    label: 'Warning', cssVar: 'var(--theme-warning)' },
] as const;

export const HIGHLIGHT_TOKENS: readonly ColorToken[] = [
    { id: 'yellow', label: 'Yellow', cssVar: '#fef08a' },
    { id: 'green',  label: 'Green',  cssVar: '#bbf7d0' },
    { id: 'blue',   label: 'Blue',   cssVar: '#bfdbfe' },
    { id: 'pink',   label: 'Pink',   cssVar: '#fbcfe8' },
    { id: 'purple', label: 'Purple', cssVar: '#e9d5ff' },
    { id: 'orange', label: 'Orange', cssVar: '#fed7aa' },
] as const;

export const SIZE_TOKENS: readonly SizeToken[] = [
    { id: 'xs', label: 'XS', px: 12 },
    { id: 's',  label: 'S',  px: 14 },
    { id: 'm',  label: 'M',  px: 16 },
    { id: 'l',  label: 'L',  px: 18 },
    { id: 'xl', label: 'XL', px: 20 },
] as const;

export const LINE_HEIGHT_TOKENS: readonly LineHeightToken[] = [
    { id: 'tight',   label: 'Tight',   multiplier: 0.85 },
    { id: 'normal',  label: 'Normal',  multiplier: 1.00 },
    { id: 'relaxed', label: 'Relaxed', multiplier: 1.15 },
    { id: 'loose',   label: 'Loose',   multiplier: 1.30 },
] as const;

export type ColorTokenId      = (typeof COLOR_TOKENS)[number]['id'];
export type HighlightTokenId  = (typeof HIGHLIGHT_TOKENS)[number]['id'];
export type SizeTokenId       = (typeof SIZE_TOKENS)[number]['id'];
export type LineHeightTokenId = (typeof LINE_HEIGHT_TOKENS)[number]['id'];

export const isColorToken      = (v: string): v is ColorTokenId      => COLOR_TOKENS.some(t => t.id === v);
export const isHighlightToken  = (v: string): v is HighlightTokenId  => HIGHLIGHT_TOKENS.some(t => t.id === v);
export const isSizeToken       = (v: string): v is SizeTokenId       => SIZE_TOKENS.some(t => t.id === v);
export const isLineHeightToken = (v: string): v is LineHeightTokenId => LINE_HEIGHT_TOKENS.some(t => t.id === v);

export const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
export const isHex = (v: string): boolean => HEX_REGEX.test(v);
