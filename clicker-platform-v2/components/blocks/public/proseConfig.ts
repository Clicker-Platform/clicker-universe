/**
 * Shared prose plugin configuration for any block that renders user-authored rich text
 * (multi-paragraph, may contain headings, lists, links, emphasis).
 *
 * Scope (per spec §5.1):
 *   ✅ DefaultTextBlock
 *   ✅ DefaultContentShowcaseBlock row content
 *   ✅ DefaultFAQBlock answer
 *   ❌ Hero subtitle, InlineForm subheading, Branches address, LinkCard description
 *      (single-paragraph — use BODY / BODY_LG / BODY_SM constants instead)
 *
 * Spec: superpowers/specs/2026-05-16-block-typography-system.md §5
 */

/**
 * Default prose styling — theme-foreground text, theme-primary links,
 * 1.65 line-height optimized for long-form reading. Use on light/clean cardStyles.
 */
export const proseClass = [
    'prose prose-neutral max-w-none',
    'prose-headings:font-heading prose-headings:text-[var(--theme-foreground)]',
    'prose-p:font-body prose-p:text-[var(--theme-foreground)] prose-p:leading-[1.65]',
    'prose-a:text-[var(--theme-primary)] prose-a:no-underline hover:prose-a:underline',
    'prose-strong:text-[var(--theme-foreground)] prose-strong:font-semibold',
    'prose-li:text-[var(--theme-foreground)] prose-li:leading-[1.65]',
    'prose-blockquote:text-[var(--theme-foreground)]/80 prose-blockquote:border-l-[var(--theme-primary)]',
].join(' ');

/**
 * Prose variant for glass / dark cardStyles — text lifts toward white,
 * preserving legibility on translucent dark surfaces.
 */
export const proseGlassClass = [
    'prose prose-invert max-w-none',
    'prose-headings:font-heading prose-headings:text-white',
    'prose-p:font-body prose-p:text-white/85 prose-p:leading-[1.65]',
    'prose-a:text-[var(--theme-primary)] prose-a:no-underline hover:prose-a:underline',
    'prose-strong:text-white prose-strong:font-semibold',
    'prose-li:text-white/85 prose-li:leading-[1.65]',
    'prose-blockquote:text-white/70 prose-blockquote:border-l-[var(--theme-primary)]',
].join(' ');

/** Convenience: pick the right variant based on cardStyle. */
export function getProseClass(cardStyle?: string): string {
    return cardStyle === 'glass' ? proseGlassClass : proseClass;
}
