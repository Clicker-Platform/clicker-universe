/**
 * Block typography token helpers. Single source of truth for the H1–H4 heading scale
 * and body sizes used across all Canvas Studio public blocks.
 *
 * Spec: superpowers/specs/2026-05-16-block-typography-system.md §1, §2, §12
 *
 * Each helper accepts a DeviceView and returns the appropriate Tailwind class string.
 *   - In Canvas Studio mobile/tablet preview, only the size for that viewport is emitted,
 *     so the preview matches the real device render (Tailwind's md:/lg: breakpoints fire
 *     on real viewport, not preview frame, so we can't rely on them inside Canvas).
 *   - On the public site (deviceView = 'responsive') and in desktop preview, both base
 *     and md: classes are emitted so Tailwind picks the right one normally.
 *
 * Color is applied separately via the helpers in `./cardStyles.ts`
 * (getHeadingColor / getBodyColor / getMutedColor / getLabelColor / getAccentColor).
 *
 *   const deviceView = useDeviceView();
 *
 *   <h2
 *     className={H2(deviceView)}
 *     style={{ color: getHeadingColor(cardStyle, theme) }}
 *   >...</h2>
 */

import { dv, type DeviceView } from '@/components/DeviceViewContext';

// ──────────────────────────────────────────────────────────────────────────────
// Headings — H1–H4
// ──────────────────────────────────────────────────────────────────────────────

/** Display 3XL — oversized hero/landing headline, one tier above 2XL. */
export const DISPLAY_3XL = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-6xl', 'md:text-8xl')} font-extrabold leading-[0.95] tracking-tight`;

/** Display 2XL — large hero headline, one tier above H1. */
export const DISPLAY_2XL = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-5xl', 'md:text-7xl')} font-extrabold leading-tight tracking-tight`;

/** Display — Hero title, page-level headline. */
export const H1 = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-4xl', 'md:text-6xl')} font-extrabold leading-tight tracking-tight`;

/** Section title — FAQ, Featured Product name, Content Showcase row heading, form heading. */
export const H2 = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-3xl', 'md:text-4xl')} font-bold leading-tight tracking-tight`;

/** Subsection / card title — FAQ question, card title, branch name, product name in grid. */
export const H3 = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-xl', 'md:text-2xl')} font-semibold leading-snug`;

/** Label / eyebrow — Hero tagline, "OPERATING HOURS", category labels. Always uppercase. */
export const H4 = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-xs', 'md:text-sm')} font-bold tracking-[0.2em] uppercase leading-normal`;

/**
 * Tile / card-label tier — for titles in dense n-up grids where H3 wraps awkwardly:
 *   • QuickActions grid-mode link titles (3–6 up, ~120px tiles)
 *   • ProductsBlockClient product names (auto-fit minmax 140px)
 *   • LinkCard titles (consumed by QuickActions list mode)
 *
 * Visually between H3 and BODY: still semibold to read as a heading, but small
 * enough to fit dense layouts without forcing text-wrap mid-word.
 */
export const TILE_TITLE = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-sm', 'md:text-base')} font-semibold leading-tight`;

// ──────────────────────────────────────────────────────────────────────────────
// Body text — no breakpoint variants, but kept as functions for API consistency
// so call sites uniformly read `BODY(deviceView)` and future-proof against future
// breakpoint additions without churning every callsite again.
// ──────────────────────────────────────────────────────────────────────────────

/** Lead paragraph — Hero subtitle, form subheading. */
export const BODY_LG = (_deviceView: DeviceView) => 'text-lg font-normal leading-normal';

/** Standard body paragraph. */
export const BODY = (_deviceView: DeviceView) => 'text-base font-normal leading-normal';

/** Caption / secondary — price, address, helper text. */
export const BODY_SM = (_deviceView: DeviceView) => 'text-sm font-normal leading-normal';

// ──────────────────────────────────────────────────────────────────────────────
// Sub-heading scale — supporting text that sits below a heading. Deliberately
// pitched ABOVE body but BELOW the heading tiers, so a sub-heading reads as a
// lead/standfirst rather than a paragraph. Four presets (S/M/L/XL); M is the
// default. Weight/style (bold, underline) are layered on separately at the call
// site so this stays a pure size scale.
// ──────────────────────────────────────────────────────────────────────────────

// Size only — no font-weight here. Weight is applied separately at the call site
// (font-normal / font-bold) so the bold toggle isn't fighting a baked-in weight
// class of equal specificity (whichever Tailwind emits last would win otherwise).
export const SUBHEADING_SIZE = {
    s:  (deviceView: DeviceView) => `${dv(deviceView, 'text-base', 'md:text-lg')} leading-snug`,
    m:  (deviceView: DeviceView) => `${dv(deviceView, 'text-lg', 'md:text-xl')} leading-snug`,
    l:  (deviceView: DeviceView) => `${dv(deviceView, 'text-xl', 'md:text-2xl')} leading-snug`,
    xl: (deviceView: DeviceView) => `${dv(deviceView, 'text-2xl', 'md:text-3xl')} leading-snug`,
} as const;

export type SubheadingSize = keyof typeof SUBHEADING_SIZE;

// ──────────────────────────────────────────────────────────────────────────────
// Emphasis weights (use sparingly, only when default weight needs strengthening)
// ──────────────────────────────────────────────────────────────────────────────

/** For inline emphasis inside body text. */
export const EMPHASIS_WEIGHT = 'font-medium';

// ──────────────────────────────────────────────────────────────────────────────
// Buttons — see spec §8 and DefaultButtonBlock
// ──────────────────────────────────────────────────────────────────────────────

/** Button text styling. Never auto-uppercase; user types caps if they want caps. */
export const BUTTON_TEXT = (deviceView: DeviceView) =>
    `${dv(deviceView, 'text-sm', 'md:text-base')} font-semibold leading-normal`;
