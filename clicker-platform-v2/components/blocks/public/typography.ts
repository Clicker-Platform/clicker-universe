/**
 * Block typography token constants. Single source of truth for the H1–H4 heading scale
 * and body sizes used across all Canvas Studio public blocks.
 *
 * Spec: superpowers/specs/2026-05-16-block-typography-system.md §1, §2, §12
 *
 * Each constant is a Tailwind class string ready to drop into a block's `className`.
 * Color is applied separately via the helpers in `./cardStyles.ts`
 * (getHeadingColor / getBodyColor / getMutedColor / getLabelColor / getAccentColor).
 *
 *   <h2
 *     className={H2}
 *     style={{ color: getHeadingColor(cardStyle, theme) }}
 *   >...</h2>
 */

// ──────────────────────────────────────────────────────────────────────────────
// Headings — H1–H4
// ──────────────────────────────────────────────────────────────────────────────

/** Display — Hero title, page-level headline. */
export const H1 = 'text-4xl md:text-6xl font-extrabold leading-tight tracking-tight';

/** Section title — FAQ, Featured Product name, Content Showcase row heading, form heading. */
export const H2 = 'text-3xl md:text-4xl font-bold leading-tight tracking-tight';

/** Subsection / card title — FAQ question, card title, branch name, product name in grid. */
export const H3 = 'text-xl md:text-2xl font-semibold leading-snug';

/** Label / eyebrow — Hero tagline, "OPERATING HOURS", category labels. Always uppercase. */
export const H4 = 'text-xs md:text-sm font-bold tracking-[0.2em] uppercase leading-normal';

/**
 * Tile / card-label tier — for titles in dense n-up grids where H3 wraps awkwardly:
 *   • QuickActions grid-mode link titles (3–6 up, ~120px tiles)
 *   • ProductsBlockClient product names (auto-fit minmax 140px)
 *   • LinkCard titles (consumed by QuickActions list mode)
 *
 * Visually between H3 and BODY: still semibold to read as a heading, but small
 * enough to fit dense layouts without forcing text-wrap mid-word.
 */
export const TILE_TITLE = 'text-sm md:text-base font-semibold leading-tight';

// ──────────────────────────────────────────────────────────────────────────────
// Body text
// ──────────────────────────────────────────────────────────────────────────────

/** Lead paragraph — Hero subtitle, form subheading. */
export const BODY_LG = 'text-lg font-normal leading-normal';

/** Standard body paragraph. */
export const BODY = 'text-base font-normal leading-normal';

/** Caption / secondary — price, address, helper text. */
export const BODY_SM = 'text-sm font-normal leading-normal';

// ──────────────────────────────────────────────────────────────────────────────
// Emphasis weights (use sparingly, only when default weight needs strengthening)
// ──────────────────────────────────────────────────────────────────────────────

/** For inline emphasis inside body text. */
export const EMPHASIS_WEIGHT = 'font-medium';

// ──────────────────────────────────────────────────────────────────────────────
// Buttons — see spec §8 and DefaultButtonBlock
// ──────────────────────────────────────────────────────────────────────────────

/** Button text styling. Never auto-uppercase; user types caps if they want caps. */
export const BUTTON_TEXT = 'text-sm md:text-base font-semibold leading-normal';
