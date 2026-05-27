# Rich Text Editor — B Preset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing Tiptap rich text editor (currently H2/H3 + bold/italic/strike/link/image/video) to a research-backed "basic but complete" editor: H1–H4, font size, text color, highlight, alignment, line height, with active-state sync that follows the caret.

**Architecture:** Three layers, each with a single responsibility. (1) Sanitizer config in `lib/sanitizeHtml.ts` is tightened to allowlist a narrowly-constrained inline `style` (hex colors only) and the new `rt-*` class prefix. (2) New CSS file `components/blocks/public/rich-text-classes.css` defines all `rt-color-*`, `rt-bg-*`, `rt-size-*`, `rt-lh-*`, `rt-align-*` rules using `var(--theme-*)` so the same content renders correctly across templates. (3) Toolbar is decomposed into small per-control components (`HeadingPopover`, `ColorPopover`, etc.) consumed by a wrapper-agnostic `Toolbar` shell — this same `Toolbar` is reused later by a `BubbleMenu` wrapper for inline canvas editing. New Tiptap extensions (`FontSize`, `LineHeight`, color/highlight with token attributes) are added incrementally with tests for each.

**Tech Stack:** Tiptap v3, ProseMirror, DOMPurify, React 18+, Next.js, Tailwind + `@tailwindcss/typography`, Vitest.

**Spec:** `superpowers/specs/2026-05-27-rich-text-editor-b-preset.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `components/blocks/public/rich-text-classes.css` | All `.rt-*` CSS rules (colors via theme vars, sizes, line-heights, alignment, highlights). Single file shipped to the public bundle. |
| `components/admin/blocks/rich-text/tokens.ts` | Single source of truth for token IDs and label/value pairs: color tokens, highlight tokens, size tokens (with px values), line-height presets (with multipliers). Imported by every popover. |
| `components/admin/blocks/rich-text/extensions/FontSize.ts` | Tiptap extension — adds a `data-font-size` + `class="rt-size-{token}"` attribute to paragraph nodes. |
| `components/admin/blocks/rich-text/extensions/LineHeight.ts` | Tiptap extension — adds `data-line-height` + `class="rt-lh-{token}"` to paragraph/heading/listItem nodes. |
| `components/admin/blocks/rich-text/extensions/TokenColor.ts` | Extends `@tiptap/extension-color`. Adds `colorToken` attribute alongside the existing color; renders class for tokens, inline style for hex. |
| `components/admin/blocks/rich-text/extensions/TokenHighlight.ts` | Same pattern for `@tiptap/extension-highlight`. |
| `components/admin/blocks/rich-text/popovers/Popover.tsx` | Generic portaled popover primitive (Floating UI-free; uses `createPortal` and click-outside-to-close, matches MediaPicker portal pattern). |
| `components/admin/blocks/rich-text/popovers/HeadingPopover.tsx` | H1/H2/H3/H4 + Paragraph + Code block menu. |
| `components/admin/blocks/rich-text/popovers/ColorPopover.tsx` | Text color picker (8 tokens + recent + custom hex). Reused by `HighlightPopover` via a shared `<ColorPickerBody>` sub-component. |
| `components/admin/blocks/rich-text/popovers/HighlightPopover.tsx` | Background-color picker. |
| `components/admin/blocks/rich-text/popovers/FontSizePopover.tsx` | XS/S/M/L/XL list, paragraphs only (disabled state when selection includes heading/list). |
| `components/admin/blocks/rich-text/popovers/LineHeightPopover.tsx` | Tight/Normal/Relaxed/Loose. |
| `components/admin/blocks/rich-text/hooks/useEditorState.ts` | Subscribes to editor selection changes and returns reactive `{ isActive, getAttributes }` accessors. Solves the "toolbar doesn't update when caret moves" bug. |
| `components/admin/blocks/rich-text/hooks/useRecentColors.ts` | localStorage-backed list of last 6 custom hex colors (per browser, not per site — UX nicety only). |
| `components/admin/blocks/rich-text/__tests__/extensions.test.ts` | Vitest unit tests for the four custom extensions. |
| `components/admin/blocks/rich-text/__tests__/Toolbar.test.tsx` | RTL tests for the toolbar's active-state sync and popover open/close. |
| `lib/__tests__/sanitizeHtml.test.ts` | Vitest tests for the new sanitizer hook (per spec §3.4 test list). |

### Modified files

| Path | What changes |
|---|---|
| `lib/sanitizeHtml.ts` | Add `'style'` to `ALLOWED_ATTR`; add `uponSanitizeAttribute` hook that keeps only `color: #hex` / `background-color: #hex`. |
| `components/admin/blocks/rich-text/RichTextEditor.tsx` | Accept `preset` prop (only `'basic'` for now), load new extensions, mount new `<Toolbar>` shell. |
| `components/admin/blocks/rich-text/Toolbar.tsx` | Rewrite as wrapper-agnostic shell consuming the new popover components. Lose direct inline button definitions for the new controls. |
| `components/blocks/public/proseConfig.ts` | **Audit-then-tune.** Read the current file (already has thoughtful tuning); confirm whether the user-reported "lists too tall" symptom comes from `prose-li:leading-snug` (currently set) or from something downstream. If `proseConfig` is already correct, leave it alone and find the real cause. Spec §3.6 prescribed Scale B values, but the existing file already uses a 15→18px responsive scale and `leading-snug` on `li`. Do not overwrite without evidence. |
| `app/layout.tsx` (or wherever global CSS is imported) | Add `import '@/components/blocks/public/rich-text-classes.css'`. **Verify the actual file before editing** — Next.js convention varies by app router setup. |

---

## Sequencing rationale

The order is chosen so each task produces a working, testable artifact and so risky verifications happen before code that depends on them.

1. **Verifications first** (Task 0). No code, just reading and reporting. Confirms the spec's assumptions before any commit.
2. **Tokens and CSS** (Tasks 1–2). Pure data + pure CSS. No editor logic. Easy to test in isolation and review visually.
3. **Sanitizer** (Task 3). Foundation for everything that stores `style`. Test-first; if this breaks, content is silently lost.
4. **Custom Tiptap extensions** (Tasks 4–7). Each extension is independent. Test each in isolation via Vitest with a headless ProseMirror.
5. **Reactive selection hook** (Task 8). Required by every popover. Built once, tested once.
6. **Popovers** (Tasks 9–13). Built bottom-up: generic `Popover` primitive first, then the 5 type-specific popovers.
7. **Toolbar shell** (Task 14). Glues everything together. Stays wrapper-agnostic.
8. **RichTextEditor wiring** (Task 15). The integration point. Toggling old → new behind a feature shape (`preset` prop).
9. **`proseConfig` audit + tuning** (Task 16). Done late because we need a working editor to A/B compare against existing public render.
10. **Mobile pass** (Task 17). Adapt touch targets and popover positioning at `< 768px`.
11. **Real-device test pass** (Task 18). User-driven, on iPhone XR + Fold 6 + iPad Pro.

---

## Task 0: Pre-implementation verifications (no commits)

**Files:** Read-only. Produces a short markdown report in `superpowers/notes/2026-05-27-rte-impl-verifications.md`.

This task exists because the spec explicitly lists seven items that must be verified, not guessed (spec §12). Skipping this task risks the rest of the plan being wrong.

- [ ] **Step 1: Verify theme CSS variables exist**

Run: `grep -rE -- "--theme-(foreground|muted|primary|secondary|accent|success|warning|danger)" clicker-platform-v2/lib/templates clicker-platform-v2/components/TemplateProvider.tsx 2>/dev/null | head -30`

For each of the 8 tokens (foreground, muted, primary, secondary, accent, success, warning, danger), record whether at least one template defines the variable. **If any are missing across all templates,** mark them in the report; the affected swatches will be dropped from the picker (Task 9) rather than rendering blank.

- [ ] **Step 2: Verify Tiptap v3 default keyboard shortcuts**

Run: `cd clicker-platform-v2 && cat node_modules/@tiptap/extension-heading/dist/index.d.ts | grep -A 5 addKeyboardShortcuts`

Record which `Cmd+Alt+N` shortcuts Tiptap binds by default. Spec §8 prescribes `Cmd+Alt+1..4` for headings and `Cmd+Alt+0` for paragraph; some of these are already bound by StarterKit. Note any that need *not* to be re-added in Task 15.

- [ ] **Step 3: Verify class-name prefix has no collision**

Run: `cd clicker-platform-v2 && grep -rE 'className=.*"[^"]*\brt-[a-z]' --include="*.tsx" 2>/dev/null | grep -v node_modules`

Expect empty output. If anything matches, switch the prefix in the report to `rte-` and update Tasks 1, 2, 4–7, 9–11 accordingly before starting.

- [ ] **Step 4: Verify list-line-height issue's actual source**

Open the dev server, create a text block with a numbered list ("1. List 1, 2. List 3"), screenshot it. Then open `components/blocks/public/proseConfig.ts` and read the `prose-li:leading-snug` rule. If the rendered list still looks too tall despite `leading-snug` (which is 1.375), the cause is NOT `proseConfig` — it's likely a template/cardStyle override (e.g., MRB) or the editor's `RichTextEditor.tsx` admin styling overriding the rendered output's line-height. Record the actual source in the report so Task 16 fixes the right file.

- [ ] **Step 5: Verify Next.js global CSS import location**

Run: `find clicker-platform-v2/app -maxdepth 2 -name "layout.tsx" -o -name "globals.css" 2>/dev/null | head -5; grep -l "globals.css\|index.css" clicker-platform-v2/app/layout.tsx 2>/dev/null`

Record the canonical file where global CSS is imported. Task 2 will add `rich-text-classes.css` to this same file.

- [ ] **Step 6: Verify Vitest is configured for React + DOM tests**

Run: `cd clicker-platform-v2 && cat vitest.config.ts`

Confirm `environment: 'jsdom'` or `'happy-dom'` is set. If only `node` environment is configured, Tasks 14 (`Toolbar.test.tsx`) needs a config addition, which becomes a sub-step of Task 14.

- [ ] **Step 7: Write the report**

Create `superpowers/notes/2026-05-27-rte-impl-verifications.md` summarizing all findings. Do NOT commit this file unless asked — it's a working note for the implementer. Subsequent tasks reference this report when they need to apply a finding (e.g., "if Step 1 showed `--theme-warning` is missing, skip the warning swatch in `tokens.ts`").

---

## Task 1: Token definitions

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/tokens.ts`
- Test: `clicker-platform-v2/components/admin/blocks/rich-text/__tests__/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/__tests__/tokens.test.ts
import { describe, it, expect } from 'vitest';
import {
    COLOR_TOKENS,
    HIGHLIGHT_TOKENS,
    SIZE_TOKENS,
    LINE_HEIGHT_TOKENS,
    isColorToken,
    isSizeToken,
    isLineHeightToken,
} from '../tokens';

describe('tokens', () => {
    it('exposes exactly 8 color tokens with stable IDs', () => {
        expect(COLOR_TOKENS.map(t => t.id)).toEqual([
            'foreground', 'muted', 'primary', 'secondary',
            'accent', 'success', 'warning', 'danger',
        ]);
    });

    it('every color token has a CSS variable reference', () => {
        for (const t of COLOR_TOKENS) {
            expect(t.cssVar).toMatch(/^var\(--theme-[a-z]+\)$/);
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/__tests__/tokens.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement tokens.ts**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/tokens.ts

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

export const COLOR_TOKENS: readonly ColorToken[] = [
    { id: 'foreground', label: 'Default',   cssVar: 'var(--theme-foreground)' },
    { id: 'muted',      label: 'Muted',     cssVar: 'var(--theme-muted)' },
    { id: 'primary',    label: 'Primary',   cssVar: 'var(--theme-primary)' },
    { id: 'secondary',  label: 'Secondary', cssVar: 'var(--theme-secondary)' },
    { id: 'accent',     label: 'Accent',    cssVar: 'var(--theme-accent)' },
    { id: 'success',    label: 'Success',   cssVar: 'var(--theme-success)' },
    { id: 'warning',    label: 'Warning',   cssVar: 'var(--theme-warning)' },
    { id: 'danger',     label: 'Danger',    cssVar: 'var(--theme-danger)' },
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
```

If Task 0 Step 1 found missing CSS vars, **remove those entries from `COLOR_TOKENS`** (and update the test's expected id list).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/__tests__/tokens.test.ts --run`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/tokens.ts \
        clicker-platform-v2/components/admin/blocks/rich-text/__tests__/tokens.test.ts
git commit -m "feat(rich-text): add token definitions (color, size, line-height)"
```

---

## Task 2: Rich-text CSS classes

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/rich-text-classes.css`
- Modify: the file identified in Task 0 Step 5 (likely `clicker-platform-v2/app/globals.css` or the layout that imports it)

- [ ] **Step 1: Write the CSS file**

```css
/* clicker-platform-v2/components/blocks/public/rich-text-classes.css
 *
 * Defines all `.rt-*` classes used by the rich text editor. Class names
 * are deliberately verbose and prefixed to avoid colliding with Tailwind
 * or template overrides.
 *
 * Cascade strategy: rules use the `.prose` parent selector for higher
 * specificity than the `prose` plugin's defaults. If `prose` is later
 * loaded inside a CSS layer that wins regardless, switch to @layer.
 */

/* ---------- Token colors (use theme CSS variables) ---------- */
.prose .rt-color-foreground { color: var(--theme-foreground); }
.prose .rt-color-muted      { color: var(--theme-muted); }
.prose .rt-color-primary    { color: var(--theme-primary); }
.prose .rt-color-secondary  { color: var(--theme-secondary); }
.prose .rt-color-accent     { color: var(--theme-accent); }
.prose .rt-color-success    { color: var(--theme-success); }
.prose .rt-color-warning    { color: var(--theme-warning); }
.prose .rt-color-danger     { color: var(--theme-danger); }

/* Freeform hex stays as inline style on the same span; .rt-color-custom
 * is a marker class only (no color rule here). The inline `style="color: #..."`
 * is preserved by the sanitizer hook for this case. */
.prose .rt-color-custom     { /* color comes from inline style */ }

/* ---------- Highlight tokens (literal hex, not theme vars — these are
 * deliberately constant warm/cool pastels independent of theme) ---------- */
.prose .rt-bg-yellow { background-color: #fef08a; padding: 0 2px; border-radius: 2px; }
.prose .rt-bg-green  { background-color: #bbf7d0; padding: 0 2px; border-radius: 2px; }
.prose .rt-bg-blue   { background-color: #bfdbfe; padding: 0 2px; border-radius: 2px; }
.prose .rt-bg-pink   { background-color: #fbcfe8; padding: 0 2px; border-radius: 2px; }
.prose .rt-bg-purple { background-color: #e9d5ff; padding: 0 2px; border-radius: 2px; }
.prose .rt-bg-orange { background-color: #fed7aa; padding: 0 2px; border-radius: 2px; }
.prose .rt-bg-custom { padding: 0 2px; border-radius: 2px; /* bg from inline style */ }

/* ---------- Font size (paragraphs only — see FontSize extension) ---------- */
.prose .rt-size-xs { font-size: 12px; }
.prose .rt-size-s  { font-size: 14px; }
.prose .rt-size-m  { font-size: 16px; }
.prose .rt-size-l  { font-size: 18px; }
.prose .rt-size-xl { font-size: 20px; }

/* ---------- Line-height presets (multipliers).
 * Values are absolute, calibrated for each preset to read well at the
 * 16px Body M default. Smaller / larger sizes inherit naturally because
 * line-height is unitless and CSS multiplies by the element's font-size.
 * That is why these are unitless — applying `tight` to an H1 stays
 * proportional. */
.prose .rt-lh-tight   { line-height: 1.32; }
.prose .rt-lh-normal  { line-height: 1.55; }
.prose .rt-lh-relaxed { line-height: 1.78; }
.prose .rt-lh-loose   { line-height: 2.0; }

/* ---------- Alignment (paragraphs and headings only) ---------- */
.prose .rt-align-left   { text-align: left; }
.prose .rt-align-center { text-align: center; }
.prose .rt-align-right  { text-align: right; }
```

- [ ] **Step 2: Verify the file is imported into the global bundle**

Open the file identified in Task 0 Step 5 (most likely `clicker-platform-v2/app/globals.css`). Add:

```css
@import '../components/blocks/public/rich-text-classes.css';
```

If the Task 0 finding showed CSS is imported via `import './globals.css'` in `app/layout.tsx` instead, that's the file to edit — adjust the relative path accordingly.

- [ ] **Step 3: Smoke-test in the browser**

Start the dev server: `cd clicker-platform-v2 && pnpm dev`.
Open any tenant page on `localhost:3000`. In Chrome DevTools, find any element inside a `.prose` container, add a class `rt-color-primary` via the elements panel. Confirm the text color changes to the theme's primary color. Repeat with `rt-size-xl`, `rt-lh-loose`, `rt-align-center`.

If a class has no visible effect, the prose plugin is winning the cascade. Switch to a CSS layer:

```css
@layer rich-text-classes {
    /* same rules, but without the .prose prefix */
}
```

And in `globals.css` ensure the layer order:

```css
@layer base, components, utilities, rich-text-classes;
```

Document the chosen strategy in `superpowers/notes/2026-05-27-rte-impl-verifications.md`.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/rich-text-classes.css \
        clicker-platform-v2/app/globals.css
git commit -m "feat(rich-text): add rt-* CSS classes for token-based formatting"
```

(Adjust paths if the Task 0 finding identified different files.)

---

## Task 3: Sanitizer — allowlist constrained inline style

**Files:**
- Modify: `clicker-platform-v2/lib/sanitizeHtml.ts`
- Create: `clicker-platform-v2/lib/__tests__/sanitizeHtml.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// clicker-platform-v2/lib/__tests__/sanitizeHtml.test.ts
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

    it('strips rgb()/rgba()', () => {
        const html = '<span style="color: rgb(255, 0, 0)">x</span>';
        expect(sanitizeRichText(html)).not.toMatch(/rgb/);
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd clicker-platform-v2 && pnpm vitest lib/__tests__/sanitizeHtml.test.ts --run`
Expected: FAIL — `style` attribute is stripped (8 of the 11 should fail; the 3 strip-tests will probably pass since DOMPurify already strips them by default).

- [ ] **Step 3: Modify the sanitizer**

Replace the contents of `clicker-platform-v2/lib/sanitizeHtml.ts` with:

```ts
import DOMPurify from 'isomorphic-dompurify';

const HEX_DECLARATION = /^(color|background-color)\s*:\s*(#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8}))$/;

/**
 * Keep only `color: #hex` and `background-color: #hex` style declarations.
 * Returns either a sanitized style string or empty (in which case the caller
 * drops the attribute entirely).
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

DOMPurify.addHook('uponSanitizeAttribute', (_node, data) => {
    if (data.attrName === 'style') {
        const cleaned = sanitizeStyleValue(data.attrValue);
        if (cleaned) {
            data.attrValue = cleaned;
        } else {
            data.keepAttr = false;
        }
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
    FORBID_TAGS: ['script', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
};

export function sanitizeRichText(html: string | undefined | null): string {
    if (!html) return '';
    return DOMPurify.sanitize(html, RICH_TEXT_CONFIG) as unknown as string;
}
```

Two notes on the change:
- The hook is registered **once at module load**, not per-call. DOMPurify retains hooks across calls.
- `'style'` is removed from `FORBID_TAGS` (it was implicitly there via not being in `ALLOWED_ATTR`); the new control is the hook, which is strictly tighter than no-allowlist.

- [ ] **Step 4: Run tests — all pass**

Run: `cd clicker-platform-v2 && pnpm vitest lib/__tests__/sanitizeHtml.test.ts --run`
Expected: PASS — all 11 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/sanitizeHtml.ts \
        clicker-platform-v2/lib/__tests__/sanitizeHtml.test.ts
git commit -m "feat(sanitize): allow constrained inline style (color/background-color hex only)"
```

---

## Task 4: TokenColor extension

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/TokenColor.ts`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/TokenColor.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/TokenColor.test.ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import TextStyle from '@tiptap/extension-text-style';
import { TokenColor } from '../TokenColor';

function makeEditor() {
    return new Editor({
        extensions: [Document, Paragraph, Text, TextStyle, TokenColor],
        content: '<p>hello world</p>',
    });
}

describe('TokenColor extension', () => {
    it('sets a token color via setTokenColor command and renders rt-color-* class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('primary');
        expect(editor.getHTML()).toContain('class="rt-color-primary"');
    });

    it('sets a freeform hex via setCustomColor and renders inline style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomColor('#a1b2c3');
        const html = editor.getHTML();
        expect(html).toContain('class="rt-color-custom"');
        expect(html).toContain('style="color: #a1b2c3"');
    });

    it('unsetColor removes both class and style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('primary');
        editor.commands.unsetTokenColor();
        expect(editor.getHTML()).not.toContain('rt-color-');
    });

    it('round-trips through getHTML/setContent', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenColor('accent');
        const html = editor.getHTML();
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        expect(editor2.getHTML()).toContain('class="rt-color-accent"');
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/TokenColor.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extension**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/TokenColor.ts
import { Mark, mergeAttributes } from '@tiptap/core';
import { isColorToken, type ColorTokenId } from '../tokens';

export interface TokenColorOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tokenColor: {
            setTokenColor: (token: ColorTokenId) => ReturnType;
            setCustomColor: (hex: string) => ReturnType;
            unsetTokenColor: () => ReturnType;
        };
    }
}

export const TokenColor = Mark.create<TokenColorOptions>({
    name: 'tokenColor',

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            token: {
                default: null as string | null,
                parseHTML: el => {
                    const classes = (el.getAttribute('class') || '').split(/\s+/);
                    const tokenClass = classes.find(c => c.startsWith('rt-color-') && c !== 'rt-color-custom');
                    return tokenClass ? tokenClass.replace('rt-color-', '') : null;
                },
                renderHTML: attrs => {
                    if (!attrs.token || !isColorToken(attrs.token)) return {};
                    return { class: `rt-color-${attrs.token}` };
                },
            },
            hex: {
                default: null as string | null,
                parseHTML: el => {
                    if (!(el.getAttribute('class') || '').includes('rt-color-custom')) return null;
                    const style = el.getAttribute('style') || '';
                    const match = style.match(/color:\s*(#[0-9a-fA-F]{3,8})/);
                    return match ? match[1] : null;
                },
                renderHTML: attrs => {
                    if (!attrs.hex) return {};
                    return { class: 'rt-color-custom', style: `color: ${attrs.hex}` };
                },
            },
        };
    },

    parseHTML() {
        return [
            { tag: 'span[class*="rt-color-"]' },
        ];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setTokenColor: (token) => ({ commands }) => {
                if (!isColorToken(token)) return false;
                return commands.setMark(this.name, { token, hex: null });
            },
            setCustomColor: (hex) => ({ commands }) => {
                if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return false;
                return commands.setMark(this.name, { token: null, hex });
            },
            unsetTokenColor: () => ({ commands }) => commands.unsetMark(this.name),
        };
    },
});
```

- [ ] **Step 4: Run tests — all pass**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/TokenColor.test.ts --run`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/extensions/TokenColor.ts \
        clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/TokenColor.test.ts
git commit -m "feat(rich-text): TokenColor extension for theme + hex text color"
```

---

## Task 5: TokenHighlight extension

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/TokenHighlight.ts`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/TokenHighlight.test.ts`

Same pattern as Task 4, replacing `color` with `background-color` and `rt-color-*` with `rt-bg-*`. Token IDs are the 6 highlight colors from `HIGHLIGHT_TOKENS`.

- [ ] **Step 1: Write the failing test**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/TokenHighlight.test.ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import TextStyle from '@tiptap/extension-text-style';
import { TokenHighlight } from '../TokenHighlight';

function makeEditor() {
    return new Editor({
        extensions: [Document, Paragraph, Text, TextStyle, TokenHighlight],
        content: '<p>hello world</p>',
    });
}

describe('TokenHighlight extension', () => {
    it('sets a token highlight and renders rt-bg-* class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenHighlight('yellow');
        expect(editor.getHTML()).toContain('class="rt-bg-yellow"');
    });

    it('sets a freeform hex and renders inline background-color', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setCustomHighlight('#fde047');
        const html = editor.getHTML();
        expect(html).toContain('class="rt-bg-custom"');
        expect(html).toContain('style="background-color: #fde047"');
    });

    it('unsetHighlight removes both class and style', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setTokenHighlight('yellow');
        editor.commands.unsetTokenHighlight();
        expect(editor.getHTML()).not.toContain('rt-bg-');
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/TokenHighlight.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extension**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/TokenHighlight.ts
import { Mark, mergeAttributes } from '@tiptap/core';
import { isHighlightToken, type HighlightTokenId } from '../tokens';

export interface TokenHighlightOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        tokenHighlight: {
            setTokenHighlight: (token: HighlightTokenId) => ReturnType;
            setCustomHighlight: (hex: string) => ReturnType;
            unsetTokenHighlight: () => ReturnType;
        };
    }
}

export const TokenHighlight = Mark.create<TokenHighlightOptions>({
    name: 'tokenHighlight',

    addOptions() {
        return { HTMLAttributes: {} };
    },

    addAttributes() {
        return {
            token: {
                default: null as string | null,
                parseHTML: el => {
                    const classes = (el.getAttribute('class') || '').split(/\s+/);
                    const tokenClass = classes.find(c => c.startsWith('rt-bg-') && c !== 'rt-bg-custom');
                    return tokenClass ? tokenClass.replace('rt-bg-', '') : null;
                },
                renderHTML: attrs => {
                    if (!attrs.token || !isHighlightToken(attrs.token)) return {};
                    return { class: `rt-bg-${attrs.token}` };
                },
            },
            hex: {
                default: null as string | null,
                parseHTML: el => {
                    if (!(el.getAttribute('class') || '').includes('rt-bg-custom')) return null;
                    const style = el.getAttribute('style') || '';
                    const match = style.match(/background-color:\s*(#[0-9a-fA-F]{3,8})/);
                    return match ? match[1] : null;
                },
                renderHTML: attrs => {
                    if (!attrs.hex) return {};
                    return { class: 'rt-bg-custom', style: `background-color: ${attrs.hex}` };
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[class*="rt-bg-"]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
    },

    addCommands() {
        return {
            setTokenHighlight: (token) => ({ commands }) => {
                if (!isHighlightToken(token)) return false;
                return commands.setMark(this.name, { token, hex: null });
            },
            setCustomHighlight: (hex) => ({ commands }) => {
                if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return false;
                return commands.setMark(this.name, { token: null, hex });
            },
            unsetTokenHighlight: () => ({ commands }) => commands.unsetMark(this.name),
        };
    },
});
```

- [ ] **Step 4: Run tests — all pass**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/TokenHighlight.test.ts --run`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/extensions/TokenHighlight.ts \
        clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/TokenHighlight.test.ts
git commit -m "feat(rich-text): TokenHighlight extension for theme + hex highlight"
```

---

## Task 6: FontSize extension

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/FontSize.ts`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/FontSize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/FontSize.test.ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Text from '@tiptap/extension-text';
import { FontSize } from '../FontSize';

function makeEditor(content = '<p>hello</p>') {
    return new Editor({
        extensions: [Document, Paragraph, Heading.configure({ levels: [1, 2] }), Text, FontSize],
        content,
    });
}

describe('FontSize extension', () => {
    it('sets size class on paragraph node', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setFontSize('l');
        expect(editor.getHTML()).toContain('class="rt-size-l"');
    });

    it('rejects unknown size tokens', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        const ok = editor.commands.setFontSize('xxl' as any);
        expect(ok).toBe(false);
        expect(editor.getHTML()).not.toContain('rt-size-');
    });

    it('does NOT set size on a heading (paragraphs only)', () => {
        const editor = makeEditor('<h1>title</h1>');
        editor.commands.selectAll();
        editor.commands.setFontSize('l');
        expect(editor.getHTML()).not.toContain('rt-size-l');
    });

    it('unsetFontSize removes the class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setFontSize('xl');
        editor.commands.unsetFontSize();
        expect(editor.getHTML()).not.toContain('rt-size-');
    });

    it('preserves size through round-trip', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setFontSize('s');
        const html = editor.getHTML();
        const editor2 = makeEditor();
        editor2.commands.setContent(html);
        expect(editor2.getHTML()).toContain('rt-size-s');
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/FontSize.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extension**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/FontSize.ts
import { Extension } from '@tiptap/core';
import { isSizeToken, type SizeTokenId } from '../tokens';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fontSize: {
            setFontSize: (token: SizeTokenId) => ReturnType;
            unsetFontSize: () => ReturnType;
        };
    }
}

export const FontSize = Extension.create({
    name: 'fontSize',

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph'],
                attributes: {
                    fontSize: {
                        default: null as string | null,
                        parseHTML: el => {
                            const classes = (el.getAttribute('class') || '').split(/\s+/);
                            const c = classes.find(x => x.startsWith('rt-size-'));
                            return c ? c.replace('rt-size-', '') : null;
                        },
                        renderHTML: attrs => {
                            if (!attrs.fontSize) return {};
                            return { class: `rt-size-${attrs.fontSize}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setFontSize: (token) => ({ chain, state }) => {
                if (!isSizeToken(token)) return false;
                // Reject if selection touches anything other than paragraphs.
                const { from, to } = state.selection;
                let containsNonParagraph = false;
                state.doc.nodesBetween(from, to, (node) => {
                    if (node.isBlock && node.type.name !== 'paragraph') {
                        containsNonParagraph = true;
                        return false;
                    }
                });
                if (containsNonParagraph) return false;
                return chain().updateAttributes('paragraph', { fontSize: token }).run();
            },
            unsetFontSize: () => ({ chain }) =>
                chain().updateAttributes('paragraph', { fontSize: null }).run(),
        };
    },
});
```

- [ ] **Step 4: Run tests — all pass**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/FontSize.test.ts --run`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/extensions/FontSize.ts \
        clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/FontSize.test.ts
git commit -m "feat(rich-text): FontSize extension (paragraphs only)"
```

---

## Task 7: LineHeight extension

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/LineHeight.ts`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/LineHeight.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/LineHeight.test.ts
import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Heading from '@tiptap/extension-heading';
import Text from '@tiptap/extension-text';
import BulletList from '@tiptap/extension-bullet-list';
import ListItem from '@tiptap/extension-list-item';
import { LineHeight } from '../LineHeight';

function makeEditor(content = '<p>hello</p>') {
    return new Editor({
        extensions: [Document, Paragraph, Heading.configure({ levels: [1, 2] }), Text, BulletList, ListItem, LineHeight],
        content,
    });
}

describe('LineHeight extension', () => {
    it('sets line-height class on a paragraph', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setLineHeight('tight');
        expect(editor.getHTML()).toContain('class="rt-lh-tight"');
    });

    it('sets line-height class on a heading', () => {
        const editor = makeEditor('<h1>title</h1>');
        editor.commands.selectAll();
        editor.commands.setLineHeight('loose');
        expect(editor.getHTML()).toContain('rt-lh-loose');
    });

    it('sets line-height class on list items', () => {
        const editor = makeEditor('<ul><li>one</li><li>two</li></ul>');
        editor.commands.selectAll();
        editor.commands.setLineHeight('tight');
        const html = editor.getHTML();
        expect(html).toContain('rt-lh-tight');
    });

    it('rejects unknown tokens', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        expect(editor.commands.setLineHeight('extra-tight' as any)).toBe(false);
    });

    it('unsetLineHeight removes the class', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        editor.commands.setLineHeight('relaxed');
        editor.commands.unsetLineHeight();
        expect(editor.getHTML()).not.toContain('rt-lh-');
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/LineHeight.test.ts --run`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the extension**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/extensions/LineHeight.ts
import { Extension } from '@tiptap/core';
import { isLineHeightToken, type LineHeightTokenId } from '../tokens';

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        lineHeight: {
            setLineHeight: (token: LineHeightTokenId) => ReturnType;
            unsetLineHeight: () => ReturnType;
        };
    }
}

const NODE_TYPES = ['paragraph', 'heading', 'listItem'] as const;

export const LineHeight = Extension.create({
    name: 'lineHeight',

    addGlobalAttributes() {
        return [
            {
                types: [...NODE_TYPES],
                attributes: {
                    lineHeight: {
                        default: null as string | null,
                        parseHTML: el => {
                            const classes = (el.getAttribute('class') || '').split(/\s+/);
                            const c = classes.find(x => x.startsWith('rt-lh-'));
                            return c ? c.replace('rt-lh-', '') : null;
                        },
                        renderHTML: attrs => {
                            if (!attrs.lineHeight) return {};
                            return { class: `rt-lh-${attrs.lineHeight}` };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setLineHeight: (token) => ({ chain }) => {
                if (!isLineHeightToken(token)) return false;
                const c = chain();
                for (const type of NODE_TYPES) {
                    c.updateAttributes(type, { lineHeight: token });
                }
                return c.run();
            },
            unsetLineHeight: () => ({ chain }) => {
                const c = chain();
                for (const type of NODE_TYPES) {
                    c.updateAttributes(type, { lineHeight: null });
                }
                return c.run();
            },
        };
    },
});
```

- [ ] **Step 4: Run tests — all pass**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/extensions/__tests__/LineHeight.test.ts --run`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/extensions/LineHeight.ts \
        clicker-platform-v2/components/admin/blocks/rich-text/extensions/__tests__/LineHeight.test.ts
git commit -m "feat(rich-text): LineHeight extension (paragraph, heading, listItem)"
```

---

## Task 8: useEditorState — reactive selection sync

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/hooks/useEditorState.ts`

This hook fixes the user-reported bug: "selecting text of H3, the toolbar stays in H2." Tiptap doesn't trigger React re-renders on selection change by default; this hook subscribes to `transaction` events and forces a state update.

- [ ] **Step 1: Implement the hook**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/hooks/useEditorState.ts
import { Editor } from '@tiptap/core';
import { useSyncExternalStore } from 'react';

/**
 * Re-renders the consumer on every editor transaction so toolbar buttons,
 * popover triggers, and disabled-state logic reflect the current selection.
 *
 * Wrap calls like `editor.isActive('heading', {level: 2})` in this hook to
 * get reactive updates as the caret moves.
 */
export function useEditorState<T>(
    editor: Editor | null,
    selector: (editor: Editor | null) => T,
): T {
    return useSyncExternalStore(
        (notify) => {
            if (!editor) return () => {};
            editor.on('transaction', notify);
            editor.on('selectionUpdate', notify);
            editor.on('focus', notify);
            editor.on('blur', notify);
            return () => {
                editor.off('transaction', notify);
                editor.off('selectionUpdate', notify);
                editor.off('focus', notify);
                editor.off('blur', notify);
            };
        },
        () => selector(editor),
        () => selector(editor),
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/hooks/useEditorState.ts
git commit -m "feat(rich-text): useEditorState hook for reactive selection sync"
```

(No test for this hook; it is exercised indirectly by toolbar tests in Task 14.)

---

## Task 9: useRecentColors hook

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/hooks/useRecentColors.ts`

- [ ] **Step 1: Implement**

```ts
// clicker-platform-v2/components/admin/blocks/rich-text/hooks/useRecentColors.ts
import { useCallback, useEffect, useState } from 'react';
import { isHex } from '../tokens';

const STORAGE_KEY = 'rte:recent-colors';
const MAX = 6;

function read(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === 'string' && isHex(v)).slice(0, MAX);
    } catch {
        return [];
    }
}

export function useRecentColors() {
    const [recent, setRecent] = useState<string[]>(() => read());

    useEffect(() => {
        // Sync once on mount in case localStorage changed in another tab.
        setRecent(read());
    }, []);

    const push = useCallback((hex: string) => {
        if (!isHex(hex)) return;
        setRecent(prev => {
            const next = [hex, ...prev.filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, MAX);
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch { /* quota / private mode — silently ignore */ }
            return next;
        });
    }, []);

    return { recent, push };
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/hooks/useRecentColors.ts
git commit -m "feat(rich-text): useRecentColors hook (localStorage, max 6)"
```

---

## Task 10: Popover primitive

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/Popover.tsx`

- [ ] **Step 1: Implement**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/Popover.tsx
'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PopoverProps {
    open: boolean;
    onClose: () => void;
    anchor: HTMLElement | null;
    children: ReactNode;
    placement?: 'bottom-start' | 'bottom' | 'bottom-end';
}

/**
 * Anchored, portaled, click-outside-to-close popover. Lives at document.body
 * to escape any transformed ancestor (same lesson as the MediaPicker portal).
 *
 * On mobile (< 768px viewport), the popover ignores `anchor` and centers
 * on the screen, because anchoring to a small target inside a bottom-sheet
 * produces clipped results.
 */
export function Popover({ open, onClose, anchor, children, placement = 'bottom-start' }: PopoverProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{ top: number; left: number; centered: boolean }>({ top: 0, left: 0, centered: false });

    useLayoutEffect(() => {
        if (!open || !anchor) return;
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        if (isMobile) {
            setPosition({ top: 0, left: 0, centered: true });
            return;
        }
        const r = anchor.getBoundingClientRect();
        const offset = 4;
        let left: number;
        switch (placement) {
            case 'bottom':       left = r.left + r.width / 2; break;
            case 'bottom-end':   left = r.right; break;
            case 'bottom-start':
            default:             left = r.left;
        }
        setPosition({ top: r.bottom + offset, left, centered: false });
    }, [open, anchor, placement]);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: MouseEvent) => {
            if (!ref.current) return;
            if (ref.current.contains(e.target as Node)) return;
            if (anchor && anchor.contains(e.target as Node)) return;
            onClose();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', onPointer);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onPointer);
            document.removeEventListener('keydown', onKey);
        };
    }, [open, anchor, onClose]);

    if (!open || typeof document === 'undefined') return null;

    const style: React.CSSProperties = position.centered
        ? { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 60 }
        : { position: 'fixed', top: position.top, left: position.left, zIndex: 60,
            transform: placement === 'bottom' ? 'translateX(-50%)' : placement === 'bottom-end' ? 'translateX(-100%)' : 'none' };

    return createPortal(
        <div ref={ref} style={style} className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl shadow-xl">
            {children}
        </div>,
        document.body,
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/popovers/Popover.tsx
git commit -m "feat(rich-text): Popover primitive (portaled, anchored, mobile-centered)"
```

---

## Task 11: HeadingPopover

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/HeadingPopover.tsx`

- [ ] **Step 1: Implement**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/HeadingPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import { Popover } from './Popover';
import { useEditorState } from '../hooks/useEditorState';

interface Props { editor: Editor | null; }

const OPTIONS = [
    { kind: 'heading', level: 1 as const, label: 'Heading 1', sample: 'text-2xl font-bold' },
    { kind: 'heading', level: 2 as const, label: 'Heading 2', sample: 'text-xl font-semibold' },
    { kind: 'heading', level: 3 as const, label: 'Heading 3', sample: 'text-lg font-semibold' },
    { kind: 'heading', level: 4 as const, label: 'Heading 4', sample: 'text-base font-semibold' },
    { kind: 'paragraph' as const, label: 'Paragraph', sample: 'text-sm' },
    { kind: 'codeBlock' as const, label: 'Code block', sample: 'text-sm font-mono' },
];

export function HeadingPopover({ editor }: Props) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const currentLabel = useEditorState(editor, (ed) => {
        if (!ed) return 'Paragraph';
        if (ed.isActive('heading', { level: 1 })) return 'H1';
        if (ed.isActive('heading', { level: 2 })) return 'H2';
        if (ed.isActive('heading', { level: 3 })) return 'H3';
        if (ed.isActive('heading', { level: 4 })) return 'H4';
        if (ed.isActive('codeBlock')) return 'Code';
        return 'Paragraph';
    });

    const apply = (opt: typeof OPTIONS[number]) => {
        if (!editor) return;
        if (opt.kind === 'heading') editor.chain().focus().toggleHeading({ level: opt.level }).run();
        else if (opt.kind === 'codeBlock') editor.chain().focus().toggleCodeBlock().run();
        else editor.chain().focus().setParagraph().run();
        setOpen(false);
    };

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                className="h-[30px] px-2 rounded-md text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
                title="Block type"
            >
                <span>{currentLabel}</span>
                <ChevronDown size={12} className="text-neutral-400" />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <div className="p-2 min-w-[180px]">
                    {OPTIONS.map(opt => (
                        <button
                            key={opt.kind === 'heading' ? `h${opt.level}` : opt.kind}
                            type="button"
                            onClick={() => apply(opt)}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                        >
                            <span className={opt.sample}>{opt.label}</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/popovers/HeadingPopover.tsx
git commit -m "feat(rich-text): HeadingPopover (H1-H4 + paragraph + code block)"
```

---

## Task 12: ColorPopover and HighlightPopover

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPickerBody.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPopover.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/HighlightPopover.tsx`

ColorPickerBody is shared so both text-color and highlight popovers stay in sync. Each calls its own set/unset command.

- [ ] **Step 1: Implement ColorPickerBody (shared)**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPickerBody.tsx
'use client';

import { useState } from 'react';
import { HEX_REGEX, type ColorToken } from '../tokens';

interface Props {
    tokens: readonly ColorToken[];
    recent: string[];
    onPickToken: (id: string) => void;
    onPickHex: (hex: string) => void;
    onClear?: () => void;
}

export function ColorPickerBody({ tokens, recent, onPickToken, onPickHex, onClear }: Props) {
    const [hexInput, setHexInput] = useState('');
    const inputOk = HEX_REGEX.test(hexInput);

    return (
        <div className="p-3 min-w-[220px]">
            <div className="text-[10px] uppercase tracking-wide text-neutral-500 mb-2">Theme colors</div>
            <div className="grid grid-cols-8 gap-1.5">
                {tokens.map(t => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onPickToken(t.id)}
                        title={t.label}
                        className="w-6 h-6 rounded-md border border-black/10 hover:scale-110 transition-transform"
                        style={{ background: t.cssVar }}
                    />
                ))}
            </div>

            {recent.length > 0 && (
                <>
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500 mt-3 mb-2">Recent</div>
                    <div className="grid grid-cols-8 gap-1.5">
                        {recent.map((hex, i) => (
                            <button
                                key={`${hex}-${i}`}
                                type="button"
                                onClick={() => onPickHex(hex)}
                                title={hex}
                                className="w-6 h-6 rounded-md border border-black/10 hover:scale-110 transition-transform"
                                style={{ background: hex }}
                            />
                        ))}
                    </div>
                </>
            )}

            <div className="mt-3 flex gap-1.5">
                <input
                    type="text"
                    value={hexInput}
                    onChange={e => setHexInput(e.target.value)}
                    placeholder="#aabbcc"
                    className="flex-1 px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                />
                <button
                    type="button"
                    disabled={!inputOk}
                    onClick={() => { onPickHex(hexInput); setHexInput(''); }}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Apply
                </button>
            </div>

            {onClear && (
                <button
                    type="button"
                    onClick={onClear}
                    className="w-full mt-2 px-2 py-1 text-xs text-neutral-500 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-md"
                >
                    Clear
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Implement ColorPopover**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Popover } from './Popover';
import { ColorPickerBody } from './ColorPickerBody';
import { useRecentColors } from '../hooks/useRecentColors';
import { COLOR_TOKENS, isColorToken } from '../tokens';

export function ColorPopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const { recent, push } = useRecentColors();

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title="Text color"
                className="h-[30px] w-[30px] rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center text-neutral-700 dark:text-neutral-300 font-semibold"
            >
                A
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <ColorPickerBody
                    tokens={COLOR_TOKENS}
                    recent={recent}
                    onPickToken={(id) => {
                        if (!editor || !isColorToken(id)) return;
                        editor.chain().focus().setTokenColor(id).run();
                        setOpen(false);
                    }}
                    onPickHex={(hex) => {
                        if (!editor) return;
                        editor.chain().focus().setCustomColor(hex).run();
                        push(hex);
                        setOpen(false);
                    }}
                    onClear={() => {
                        if (!editor) return;
                        editor.chain().focus().unsetTokenColor().run();
                        setOpen(false);
                    }}
                />
            </Popover>
        </>
    );
}
```

- [ ] **Step 3: Implement HighlightPopover (mirrors ColorPopover)**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/HighlightPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { Popover } from './Popover';
import { ColorPickerBody } from './ColorPickerBody';
import { useRecentColors } from '../hooks/useRecentColors';
import { HIGHLIGHT_TOKENS, isHighlightToken } from '../tokens';

export function HighlightPopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);
    const { recent, push } = useRecentColors();

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title="Highlight"
                className="h-[30px] w-[30px] rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center justify-center"
            >
                <span className="px-1 rounded-sm bg-yellow-200 text-neutral-900 font-bold text-xs">A</span>
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <ColorPickerBody
                    tokens={HIGHLIGHT_TOKENS}
                    recent={recent}
                    onPickToken={(id) => {
                        if (!editor || !isHighlightToken(id)) return;
                        editor.chain().focus().setTokenHighlight(id).run();
                        setOpen(false);
                    }}
                    onPickHex={(hex) => {
                        if (!editor) return;
                        editor.chain().focus().setCustomHighlight(hex).run();
                        push(hex);
                        setOpen(false);
                    }}
                    onClear={() => {
                        if (!editor) return;
                        editor.chain().focus().unsetTokenHighlight().run();
                        setOpen(false);
                    }}
                />
            </Popover>
        </>
    );
}
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPickerBody.tsx \
        clicker-platform-v2/components/admin/blocks/rich-text/popovers/ColorPopover.tsx \
        clicker-platform-v2/components/admin/blocks/rich-text/popovers/HighlightPopover.tsx
git commit -m "feat(rich-text): ColorPopover + HighlightPopover with shared body"
```

---

## Task 13: FontSizePopover and LineHeightPopover

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/FontSizePopover.tsx`
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/popovers/LineHeightPopover.tsx`

- [ ] **Step 1: Implement FontSizePopover**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/FontSizePopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import { Popover } from './Popover';
import { SIZE_TOKENS, isSizeToken } from '../tokens';
import { useEditorState } from '../hooks/useEditorState';

export function FontSizePopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    // Disabled when selection touches any non-paragraph block.
    const disabled = useEditorState(editor, (ed) => {
        if (!ed) return true;
        const { from, to } = ed.state.selection;
        let bad = false;
        ed.state.doc.nodesBetween(from, to, (node) => {
            if (node.isBlock && node.type.name !== 'paragraph') { bad = true; return false; }
        });
        return bad;
    });

    const current = useEditorState(editor, (ed) => {
        if (!ed) return null;
        const attrs = ed.getAttributes('paragraph');
        return isSizeToken(attrs.fontSize) ? attrs.fontSize : null;
    });

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                disabled={disabled}
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title={disabled ? 'Font size applies to paragraphs only' : 'Font size'}
                className="h-[30px] px-2 rounded-md text-xs font-medium hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <span>Aa {current ? current.toUpperCase() : 'M'}</span>
                <ChevronDown size={10} className="text-neutral-400" />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <div className="p-2 min-w-[140px]">
                    {SIZE_TOKENS.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                editor?.chain().focus().setFontSize(t.id).run();
                                setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                        >
                            <span style={{ fontSize: t.px }}>Body {t.label}</span>
                            <span className="text-[10px] font-mono text-neutral-400">{t.px}px</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}
```

- [ ] **Step 2: Implement LineHeightPopover**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/popovers/LineHeightPopover.tsx
'use client';

import { useRef, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { ChevronDown } from 'lucide-react';
import { Popover } from './Popover';
import { LINE_HEIGHT_TOKENS, isLineHeightToken } from '../tokens';
import { useEditorState } from '../hooks/useEditorState';

export function LineHeightPopover({ editor }: { editor: Editor | null }) {
    const [open, setOpen] = useState(false);
    const anchorRef = useRef<HTMLButtonElement>(null);

    const current = useEditorState(editor, (ed) => {
        if (!ed) return 'normal';
        for (const type of ['paragraph', 'heading', 'listItem']) {
            const v = ed.getAttributes(type).lineHeight;
            if (isLineHeightToken(v)) return v;
        }
        return 'normal';
    });

    return (
        <>
            <button
                ref={anchorRef}
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => setOpen(o => !o)}
                title="Line height"
                className="h-[30px] px-2 rounded-md text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-800 inline-flex items-center gap-1"
            >
                <span>↕ {current.charAt(0).toUpperCase() + current.slice(1)}</span>
                <ChevronDown size={10} className="text-neutral-400" />
            </button>
            <Popover open={open} onClose={() => setOpen(false)} anchor={anchorRef.current}>
                <div className="p-2 min-w-[180px]">
                    {LINE_HEIGHT_TOKENS.map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => {
                                editor?.chain().focus().setLineHeight(t.id).run();
                                setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center justify-between"
                        >
                            <span>{t.label}</span>
                            <span className="text-[10px] font-mono text-neutral-400">×{t.multiplier.toFixed(2)}</span>
                        </button>
                    ))}
                </div>
            </Popover>
        </>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/popovers/FontSizePopover.tsx \
        clicker-platform-v2/components/admin/blocks/rich-text/popovers/LineHeightPopover.tsx
git commit -m "feat(rich-text): FontSizePopover (paragraphs only) + LineHeightPopover"
```

---

## Task 14: Toolbar shell (wrapper-agnostic)

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/rich-text/Toolbar.tsx` (rewrite)
- Create: `clicker-platform-v2/components/admin/blocks/rich-text/__tests__/Toolbar.test.tsx`

- [ ] **Step 1: Verify Vitest DOM environment**

Per Task 0 Step 6, confirm `vitest.config.ts` has `environment: 'jsdom'` or `'happy-dom'`. If not, add it:

```ts
// vitest.config.ts
export default defineConfig({
    test: {
        environment: 'happy-dom', // already installed transitively with @testing-library
        // ... existing
    },
});
```

- [ ] **Step 2: Write the failing toolbar test**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/__tests__/Toolbar.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Toolbar } from '../Toolbar';

function makeEditor() {
    return new Editor({
        extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } })],
        content: '<h3>title</h3>',
    });
}

describe('Toolbar', () => {
    it('renders without crashing when given an editor', () => {
        const editor = makeEditor();
        render(<Toolbar editor={editor} />);
        expect(screen.getByTitle('Bold')).toBeTruthy();
    });

    it('reflects current heading level in the block-type button', () => {
        const editor = makeEditor();
        editor.commands.selectAll();
        render(<Toolbar editor={editor} />);
        expect(screen.getByText('H3')).toBeTruthy();
    });

    it('does not render any sidebar-specific positioning class', () => {
        const editor = makeEditor();
        const { container } = render(<Toolbar editor={editor} />);
        const root = container.firstChild as HTMLElement;
        // Wrapper-agnostic — must NOT include sticky/fixed/sidebar layout classes.
        expect(root.className).not.toMatch(/\bsticky\b/);
        expect(root.className).not.toMatch(/\bfixed\b/);
        expect(root.className).not.toMatch(/\bw-80\b/);
    });
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/__tests__/Toolbar.test.tsx --run`
Expected: FAIL — the existing `Toolbar` doesn't render the new popovers and may have positioning classes.

- [ ] **Step 4: Rewrite Toolbar.tsx**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/Toolbar.tsx
'use client';

import type { Editor } from '@tiptap/core';
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Quote,
    Link2, Image as ImageIcon, Film,
    Undo, Redo,
    AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';
import { useState } from 'react';
import { LinkSelector } from './LinkSelector';
import { VideoSelector } from './VideoSelector';
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { HeadingPopover } from './popovers/HeadingPopover';
import { ColorPopover } from './popovers/ColorPopover';
import { HighlightPopover } from './popovers/HighlightPopover';
import { FontSizePopover } from './popovers/FontSizePopover';
import { LineHeightPopover } from './popovers/LineHeightPopover';
import { useEditorState } from './hooks/useEditorState';

interface ToolbarProps { editor: Editor | null; }

export const Toolbar = ({ editor }: ToolbarProps) => {
    const [linkSelectorOpen, setLinkSelectorOpen] = useState(false);
    const [videoSelectorOpen, setVideoSelectorOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const boldActive   = useEditorState(editor, e => !!e?.isActive('bold'));
    const italicActive = useEditorState(editor, e => !!e?.isActive('italic'));
    const ulineActive  = useEditorState(editor, e => !!e?.isActive('underline'));
    const strikeActive = useEditorState(editor, e => !!e?.isActive('strike'));
    const bulletActive = useEditorState(editor, e => !!e?.isActive('bulletList'));
    const orderedActive = useEditorState(editor, e => !!e?.isActive('orderedList'));
    const quoteActive  = useEditorState(editor, e => !!e?.isActive('blockquote'));
    const alignLeft    = useEditorState(editor, e => !!e?.isActive({ textAlign: 'left' }));
    const alignCenter  = useEditorState(editor, e => !!e?.isActive({ textAlign: 'center' }));
    const alignRight   = useEditorState(editor, e => !!e?.isActive({ textAlign: 'right' }));

    if (!editor) return null;

    const Btn = ({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) => (
        <button
            type="button"
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
            title={title}
            className={`h-[30px] w-[30px] rounded-md inline-flex items-center justify-center transition-colors
                ${active
                    ? 'bg-blue-500 text-white'
                    : 'text-neutral-700 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800'}`}
        >
            {children}
        </button>
    );
    const Sep = () => <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-1" />;

    return (
        <div className="flex flex-wrap gap-1 p-2 bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 items-center">
            <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={14} /></Btn>
            <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={14} /></Btn>
            <Sep />
            <HeadingPopover editor={editor} />
            <Sep />
            <Btn active={boldActive}   onClick={() => editor.chain().focus().toggleBold().run()}      title="Bold"><Bold size={14} /></Btn>
            <Btn active={italicActive} onClick={() => editor.chain().focus().toggleItalic().run()}    title="Italic"><Italic size={14} /></Btn>
            <Btn active={ulineActive}  onClick={() => editor.chain().focus().toggleUnderline().run()} title="Underline"><UnderlineIcon size={14} /></Btn>
            <Btn active={strikeActive} onClick={() => editor.chain().focus().toggleStrike().run()}    title="Strikethrough"><Strikethrough size={14} /></Btn>
            <Sep />
            <ColorPopover editor={editor} />
            <HighlightPopover editor={editor} />
            <Sep />
            <FontSizePopover editor={editor} />
            <LineHeightPopover editor={editor} />
            <Sep />
            <Btn active={alignLeft}   onClick={() => editor.chain().focus().setTextAlign('left').run()}   title="Align left"><AlignLeft size={14} /></Btn>
            <Btn active={alignCenter} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="Align center"><AlignCenter size={14} /></Btn>
            <Btn active={alignRight}  onClick={() => editor.chain().focus().setTextAlign('right').run()}  title="Align right"><AlignRight size={14} /></Btn>
            <Sep />
            <Btn active={bulletActive}  onClick={() => editor.chain().focus().toggleBulletList().run()}  title="Bullet list"><List size={14} /></Btn>
            <Btn active={orderedActive} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={14} /></Btn>
            <Btn active={quoteActive}   onClick={() => editor.chain().focus().toggleBlockquote().run()}  title="Blockquote"><Quote size={14} /></Btn>
            <Sep />
            <Btn onClick={() => setLinkSelectorOpen(v => !v)}  title="Link"><Link2 size={14} /></Btn>
            <Btn onClick={() => setPickerOpen(true)}           title="Image"><ImageIcon size={14} /></Btn>
            <Btn onClick={() => setVideoSelectorOpen(v => !v)} title="Video"><Film size={14} /></Btn>

            <LinkSelector editor={editor} isOpen={linkSelectorOpen} onClose={() => setLinkSelectorOpen(false)} />
            <VideoSelector editor={editor} isOpen={videoSelectorOpen} onClose={() => setVideoSelectorOpen(false)} />
            <MediaPicker
                open={pickerOpen}
                onClose={() => setPickerOpen(false)}
                onSelect={({ url }) => { editor.chain().focus().setImage({ src: url }).run(); setPickerOpen(false); }}
                accept="image"
            />
        </div>
    );
};
```

- [ ] **Step 5: Run tests — all pass**

Run: `cd clicker-platform-v2 && pnpm vitest components/admin/blocks/rich-text/__tests__/Toolbar.test.tsx --run`
Expected: PASS — 3 tests green.

- [ ] **Step 6: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/Toolbar.tsx \
        clicker-platform-v2/components/admin/blocks/rich-text/__tests__/Toolbar.test.tsx \
        clicker-platform-v2/vitest.config.ts
git commit -m "feat(rich-text): wrapper-agnostic Toolbar shell with active-state sync"
```

---

## Task 15: Wire extensions into RichTextEditor + preset prop

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/rich-text/RichTextEditor.tsx`

- [ ] **Step 1: Install missing Tiptap packages**

Run: `cd clicker-platform-v2 && pnpm add @tiptap/extension-text-style @tiptap/extension-color @tiptap/extension-highlight @tiptap/extension-text-align`

(Use the existing `^3.x` versions to match the rest of the Tiptap install. If pnpm resolves to a different major, abort and reconcile before continuing.)

- [ ] **Step 2: Rewrite RichTextEditor.tsx**

```tsx
// clicker-platform-v2/components/admin/blocks/rich-text/RichTextEditor.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextStyle from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { VideoEmbed } from './VideoEmbedExtension';
import { Toolbar } from './Toolbar';
import { TokenColor } from './extensions/TokenColor';
import { TokenHighlight } from './extensions/TokenHighlight';
import { FontSize } from './extensions/FontSize';
import { LineHeight } from './extensions/LineHeight';

export type RichTextPreset = 'basic'; // 'full' is reserved for the future blog editor

interface RichTextEditorProps {
    value?: string;
    onChange: (html: string) => void;
    placeholder?: string;
    preset?: RichTextPreset;
}

export const RichTextEditor = ({ value, onChange, placeholder = 'Write something amazing...', preset = 'basic' }: RichTextEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                heading: { levels: [1, 2, 3, 4] },
            }),
            Image.configure({
                allowBase64: true,
                inline: true,
                HTMLAttributes: { class: 'max-w-full h-auto my-4' },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'text-blue-400 underline decoration-blue-400/30 hover:decoration-blue-400 font-medium cursor-pointer transition-all',
                },
            }),
            Placeholder.configure({ placeholder }),
            TextStyle,
            TokenColor,
            TokenHighlight,
            FontSize,
            LineHeight,
            TextAlign.configure({ types: ['paragraph', 'heading'] }),
            VideoEmbed as any,
        ],
        content: value,
        editorProps: {
            attributes: {
                class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[150px] px-4 py-4 prose-headings:font-heading dark:prose-headings:text-neutral-100 prose-p:text-neutral-700 dark:prose-p:text-neutral-200 prose-p:font-body prose-strong:text-neutral-900 dark:prose-strong:text-neutral-100 prose-ul:text-neutral-700 dark:prose-ul:text-neutral-300 prose-ol:text-neutral-700 dark:prose-ol:text-neutral-300 prose-blockquote:text-neutral-600 dark:prose-blockquote:text-neutral-300 prose-blockquote:border-l-blue-500 prose-a:text-blue-400',
            },
        },
        immediatelyRender: false,
        onUpdate: ({ editor }) => onChange(editor.getHTML()),
    });

    return (
        <div
            className="bg-gray-50 dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden shadow-lg"
            style={{
                ['--theme-foreground' as any]: '#e5e5e5',
                ['--theme-primary' as any]: '#60a5fa',
                ['--theme-radius' as any]: '1rem',
                ['--font-heading' as any]: 'inherit',
                ['--font-body' as any]: 'inherit',
            }}
        >
            <Toolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
};
```

(The `preset` prop is accepted but currently only one value is allowed — future C-preset implementation will branch on it.)

- [ ] **Step 3: Manual smoke-test in the dev environment**

Start the dev server: `cd clicker-platform-v2 && pnpm dev`.
Navigate to `localhost:3000/admin/canvas`, open any page with a text block, and verify every toolbar control works end-to-end:

1. Type a heading; click H1 → text becomes H1; caret in H1 → toolbar shows "H1".
2. Select a word, click text color → pick Primary → word turns Primary color. Verify the `style="color: …"` is NOT present (token mode).
3. Select a word, click text color → "+ Apply" with hex `#ff8800` → word turns orange; verify the saved HTML has `class="rt-color-custom" style="color: #ff8800"`.
4. Select a paragraph, click font size XL → font grows.
5. Same paragraph: click line-height "Tight" → text packs tighter.
6. Click in a heading, font size button is disabled with tooltip.
7. Save the page; reload the canvas; verify everything renders identically.
8. Visit the public page (`localhost:3000/<your-slug>`); verify everything renders identically.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/RichTextEditor.tsx \
        clicker-platform-v2/package.json clicker-platform-v2/pnpm-lock.yaml
git commit -m "feat(rich-text): wire B preset (color, highlight, size, line-height, align)"
```

---

## Task 16: Audit and (maybe) tune proseConfig.ts

**Files:**
- Read: `clicker-platform-v2/components/blocks/public/proseConfig.ts`
- Possibly modify the same file.

This task is intentionally late so we can A/B against the working editor.

- [ ] **Step 1: Reproduce the user-reported list issue**

In the dev environment, create a text block with a numbered list of three items. Inspect the rendered output in DevTools.
- Note the computed `line-height` of `<li>` and the inner `<p>`.
- Note the computed `margin` between `<li>`s.
- Compare against the screenshot the user originally provided (lists rendered visibly too tall).

- [ ] **Step 2: Decide based on evidence**

Case A: the `proseConfig.ts` rules (`prose-li:my-1.5 prose-li:leading-snug`) already produce reasonable spacing, but a specific template overrides them. **Action:** find the template override (likely in `lib/templates/<id>/styles.ts` or a `Mrb*` block) and tighten it. Do NOT modify `proseConfig.ts`.

Case B: `proseConfig.ts` is the culprit (e.g., `leading-relaxed` on the parent overrides `leading-snug` on `li`). **Action:** modify `proseConfig.ts` to use Scale B values per spec §3.6, AND verify with the dev server that the rendered list now matches the Scale B mockup.

- [ ] **Step 3: If modifying proseConfig.ts, spot-check 3 tenant pages on staging**

Before committing, deploy to staging (`pnpm deploy:staging` or the project's equivalent) and visually verify three existing tenant pages do not regress. List the pages in the commit message.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/proseConfig.ts
git commit -m "fix(prose): tighten list line-height to match Scale B"
```

Or, if no change was needed:

```bash
echo "No proseConfig changes — list issue was in <template name>; addressed in <commit>." >> superpowers/notes/2026-05-27-rte-impl-verifications.md
```

---

## Task 17: Mobile pass

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/rich-text/Toolbar.tsx`

- [ ] **Step 1: Add mobile-sized variants**

The `Btn` component is the only place where size is set. Replace `h-[30px] w-[30px]` with `h-[40px] w-[40px] md:h-[30px] md:w-[30px]`. Same for popover trigger buttons (HeadingPopover, ColorPopover, etc.) — sweep each popover trigger.

Spec command (to apply consistently):
- Default: 40px height, 40px min-width.
- `md:` (768px+): 30px height, 30px min-width.

- [ ] **Step 2: Verify Popover already centers on mobile**

The `Popover` component (Task 10) already detects `window.innerWidth < 768` and switches to screen-centered positioning. No additional changes needed.

- [ ] **Step 3: Manual smoke-test in the dev environment with the browser's device emulator**

Open DevTools → Device toolbar → iPhone XR (414×896). Open a text block, exercise the toolbar:
- Are the buttons large enough to tap accurately?
- Does the color popover center on screen?
- Does the soft keyboard (simulated by clicking a text input in the toolbar) not overlap?

Emulator is NOT a substitute for the real-device test in Task 18, but catches gross issues.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/rich-text/Toolbar.tsx \
        clicker-platform-v2/components/admin/blocks/rich-text/popovers/*.tsx
git commit -m "feat(rich-text): 40px touch targets and screen-centered popovers on mobile"
```

---

## Task 18: Real-device test pass

**Files:** None. This is a user-driven verification step.

- [ ] **Step 1: Get the dev server's LAN URL**

Start the dev server. Find the Mac's LAN IP: `ipconfig getifaddr en0`. The URL is `http://<that-ip>:3000`.

- [ ] **Step 2: Test on iPhone XR**

Open the URL on the phone (must be on the same Wi-Fi). Open `/admin/canvas`, edit a text block. Verify (and report yes/no for each):
1. Every toolbar button can be tapped with a thumb without misfires.
2. The soft keyboard does not cover the toolbar.
3. Each of the 5 popovers opens centered on the screen and closes on tap-outside.
4. Realistic editing session works end-to-end (type a paragraph, change a heading, color a word, add a list, undo, redo).

- [ ] **Step 3: Test on Fold 6**

Same URL. Test BOTH folded (cover screen) and unfolded (inner screen), and in BOTH portrait and landscape. Report yes/no for the same 4 items.

- [ ] **Step 4: Test on iPad Pro**

Same URL. Test BOTH portrait and landscape, BOTH full-screen and split-screen Safari. Report yes/no.

- [ ] **Step 5: Fix any reported failures**

If a specific failure mode is reported, write a sub-task for it. Common likely issues and fix sketches:
- "Popover positioned off-screen on Fold 6 portrait" → tighten `Popover.tsx` to clamp `left` within viewport bounds.
- "Soft keyboard covers toolbar when scrolled" → ensure the editor container is scrollable independently of the bottom sheet.
- "Apple Pencil selection drops toolbar visibility" → in `useEditorState`, also subscribe to `'pointerup'` events.

- [ ] **Step 6: Commit any device fixes**

For each fix:

```bash
git add <files>
git commit -m "fix(rich-text): <specific device issue>"
```

---

## Self-Review

**Spec coverage check** (every section of the spec must map to a task):

- §1 Why → Tasks 4–7, 11–14 close each user-reported gap.
- §2 Decisions log → encoded throughout; no separate task needed.
- §3.1 Component shape → Tasks 10–14.
- §3.2 Tiptap extensions → Tasks 4–7 + Task 15.
- §3.3 Storage model → Tasks 4–7 (extension renderHTML) + Task 2 (CSS).
- §3.4 Sanitizer changes → Task 3.
- §3.5 Public render path → Task 2 + Task 15 Step 3 smoke-test point 8.
- §3.6 prose defaults → Task 16.
- §4 Toolbar layout → Tasks 10–14.
- §5 Type scale → Task 2 CSS values + Task 16.
- §6 Color tokens → Task 1 + Task 0 Step 1 verification.
- §7 Mobile behavior → Tasks 17–18.
- §8 Keyboard shortcuts → **Gap.** Spec §8 prescribes specific shortcuts (Cmd+Alt+1..4, Cmd+Alt+0, Cmd+Shift+H, Cmd+Shift+L/E/R). Verified Task 0 Step 2 covers detecting Tiptap defaults, but no task actually adds the new bindings. **Fix:** add Task 15 Step 2.5 to register `addKeyboardShortcuts` for the highlight and align shortcuts. Heading shortcuts are already in StarterKit.
- §9 Conflict resolution → Task 6 (FontSize blocks non-paragraphs) + Task 14 (mixed-state via useEditorState).
- §10 Undo/redo behavior → no code needed; using Tiptap defaults satisfies the spec.
- §11 Out of scope → enforced by not implementing.
- §12 Implementation prerequisites → Task 0.
- §13 Risks → addressed inline at relevant tasks.
- §14 Acceptance criteria → Task 18 + ad-hoc verification.

**Fixing the §8 gap inline:**

### Task 15 (addendum): Add keyboard shortcuts

Append to Task 15, between Steps 2 and 3:

- [ ] **Step 2.5: Add highlight and align keyboard shortcuts**

In `RichTextEditor.tsx`, after the `extensions` array, register a small extension that adds the new shortcuts. Add at the top:

```ts
import { Extension } from '@tiptap/core';
```

And inside the `extensions` array, append:

```ts
Extension.create({
    name: 'rteShortcuts',
    addKeyboardShortcuts() {
        return {
            'Mod-Shift-h': () => this.editor.chain().focus().setTokenHighlight('yellow').run(),
            'Mod-Shift-l': () => this.editor.chain().focus().setTextAlign('left').run(),
            'Mod-Shift-e': () => this.editor.chain().focus().setTextAlign('center').run(),
            'Mod-Shift-r': () => this.editor.chain().focus().setTextAlign('right').run(),
        };
    },
}),
```

(Heading shortcuts `Mod-Alt-1..4` and `Mod-Alt-0` are already provided by StarterKit per Task 0 Step 2; do not re-add.)

**Placeholder scan:** no "TBD", "TODO", "implement later" tokens in this plan.

**Type consistency:** verified — `ColorTokenId`, `SizeTokenId`, `LineHeightTokenId`, `setTokenColor`, `setCustomColor`, `setTokenHighlight`, `setCustomHighlight`, `setFontSize`, `setLineHeight` are defined in their respective tasks and consumed consistently downstream.

---

## Execution

Plan complete and saved to `superpowers/plans/2026-05-27-rich-text-editor-b-preset.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
