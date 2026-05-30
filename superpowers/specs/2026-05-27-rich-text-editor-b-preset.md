# Rich Text Editor — B Preset ("Basic")

**Date:** 2026-05-27
**Status:** Spec — awaiting user review
**Scope:** Upgrade the rich text editor used by the `text` block (and other consumers) from the current minimal toolbar to a research-backed "basic but complete" editor.
**Out of scope:** Inline canvas editing, blog/C-preset, slash menu, tables, find/replace, AI commands (see §11).

---

## 1. Why

The current editor exposes only H2/H3, bold/italic/strike/code, list/quote, link, image, video. Users have flagged five concrete gaps:

1. No H1 or H4 (only H2/H3).
2. No font size control for body text.
3. Toolbar active state doesn't update when caret moves into H3.
4. No control over line height — lists render visibly too tall, no way to fix.
5. No text color picker.

This pass closes those gaps and adds the controls that, together, qualify the editor as a "real" rich text editor: highlight color, text alignment, and a typography system that follows the rule line-height ratio decreases as font-size grows (verified across Tailwind, Material, Butterick, WCAG, multiple typography sources).

This is the **B preset**. A future **C preset** (blog editor) is anticipated but not built; the architecture supports it via a `preset` prop.

## 2. Decisions log

Every decision below was reached through brainstorming (2026-05-27 session, dynamic visual-companion). Decisions are locked unless re-opened.

| Topic | Decision | Why |
|---|---|---|
| Scope tier | B (Basic), not C (Editorial) | C requires toolbar redesign (bubble + overflow); not justified for the text block use case |
| Architecture | `preset="basic" \| "full"` prop; only "basic" implemented now | Future blog editor reuses same component |
| Toolbar component | **Wrapper-agnostic** — same buttons, different wrapper (sticky bar today, BubbleMenu future) | Inline-editing migration cost stays low (~80 lines + wrapper swap) |
| Type scale | Scale B — Major Third (1.25×): H1 32/1.15, H2 26/1.20, H3 20/1.30, H4 17/1.40; Body M 16/1.55 default | Research-backed default for content-heavy small-business marketing pages |
| Line-height presets (user-facing) | Tight ×0.85, Normal ×1.0, Relaxed ×1.15, Loose ×1.30 | Multipliers scale correctly across all sizes; avoids "Tight on H1 = unreadable crash" |
| Line-height applies to | Paragraphs, headings, AND list items | Closes the user-reported "list line-height too tall" pain |
| Font family | NOT configurable per selection | Font Pack remains sole source of font choice (per CLAUDE.md rule) |
| Text color | Theme tokens (8) + recent custom + freeform hex | Future Color Styles system swaps token source; freeform respects usability ask |
| Color storage | **Class-based for tokens** (`class="rt-color-primary"`); **constrained inline style for hex** (`style="color: #abc"`) | Sanitizer audit (lib/sanitizeHtml.ts) shows `style` and most `data-*` are stripped; class is allowed; selective `style` allowlist via DOMPurify hook |
| Freeform color format | Hex only (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) | Smallest sanitizer surface; picker outputs hex natively |
| Highlight color | Same pattern as text color, lighter token palette + clear button | |
| Alignment | Left, Center, Right — paragraphs and headings only | Skip justify (poor web rendering), skip lists (looks broken) |
| Toolbar layout | C-hybrid: 12 inline controls + 5 popovers (heading, color, highlight, font-size, line-height) | Compresses best in 320px sidebar; same popovers reused inline |
| Mobile breakpoint | Inherit platform `useIsMobile()` (< 768px) | Don't redesign the platform's responsive strategy |
| Mobile UI | Bottom sheet (existing platform pattern), 40px touch targets, custom popovers centered on screen | |
| Tablet portrait (iPad ~834px) | Accepts desktop sidebar; cramped-but-workable | Revisit with evidence after real-device testing |
| Keyboard shortcuts | Tiptap defaults + Cmd+Alt+1..4 (heading), Cmd+Alt+0 (paragraph), Cmd+Shift+H (highlight), Cmd+Shift+L/E/R (align) | Match Google Docs / Notion conventions |
| Placeholder | Static string only (current behavior) | Revisit with slash-menu in future inline-editing work |
| Block/inline conflicts | Alignment = whole containing block; font-size disabled on headings/lists; mixed-state controls show neutral | Standard editor behavior |
| Migration of existing content | Lazy: existing HTML keeps `prose` defaults; update `prose` config to Scale B's defaults (CSS-only) | No HTML rewrites; visual improvement is global |
| Undo behavior | Each toolbar change = one undo step; no live preview, no coalescing | Simple, predictable, matches Google Docs / Notion |
| MediaPicker | Already portaled via React portal (separate fix, shipped earlier in this session) | |

## 3. Architecture

### 3.1 Component shape

```
RichTextEditor (props: value, onChange, preset = 'basic', placeholder?)
└── Tiptap useEditor() with preset-specific extensions
└── ToolbarWrapper (sticky bar today; BubbleMenu in future inline pass)
    └── Toolbar (wrapper-agnostic; receives editor, renders controls per preset)
        ├── HistoryGroup (Undo, Redo)
        ├── BlockTypePopover (H1/H2/H3/H4, Paragraph, Code block)
        ├── InlineMarksGroup (B, I, U, S)
        ├── TextColorPopover (8 tokens + recent + custom)
        ├── HighlightPopover (8 tokens + clear + custom)
        ├── FontSizePopover (paragraphs only; disabled otherwise)
        ├── LineHeightPopover (Tight/Normal/Relaxed/Loose)
        ├── AlignGroup (Left/Center/Right — inline buttons)
        ├── ListsGroup (Bullet, Numbered, Quote)
        └── InsertGroup (Link, Image via MediaPicker, Video)
```

**Critical:** the `Toolbar` component does NOT know whether it's mounted in a sticky bar or a BubbleMenu. Future inline editing reuses it as-is.

### 3.2 Tiptap extensions (B preset)

- StarterKit (already installed — includes Underline in v3)
- `@tiptap/extension-link` (already installed)
- `@tiptap/extension-image` (already installed)
- `@tiptap/extension-placeholder` (already installed)
- `@tiptap/extension-text-style` v3.x stable — base for color/font-size/line-height attributes
- `@tiptap/extension-color` v3.x stable — extended with custom `colorToken` attribute
- `@tiptap/extension-highlight` v3.x stable — extended with custom `highlightToken` attribute
- `@tiptap/extension-text-align` v3.x stable — applied to `paragraph` and `heading` only
- **Custom extension `FontSize`** (~30 lines) — adds `data-font-size` token attr + matching class
- **Custom extension `LineHeight`** (~30 lines) — adds `data-line-height` token attr + matching class; applied to paragraph, heading, listItem
- Existing `VideoEmbed` (already in repo)

**Honest note:** `@tiptap/extension-font-size` exists officially but only as pre-release `3.0.0-next.3`. We write our own ~30-line extension to avoid pre-release dependency. No official line-height extension exists; same approach.

### 3.3 Storage model

Every formatting choice serializes to HTML with class names (for token-based intent) and minimal inline style (only for freeform hex). Verified against `lib/sanitizeHtml.ts` (DOMPurify-based — already used; this spec extends its config, doesn't introduce new unsanitized paths).

**Token colors:**
```html
<span class="rt-color-primary">brand text</span>
```
CSS: `.rt-color-primary { color: var(--theme-primary); }`. No inline style, no `data-*` needed (`class` is already allowlisted).

**Freeform hex colors:**
```html
<span class="rt-color-custom" style="color: #a1b2c3">custom text</span>
```
The `style` attribute survives only via a DOMPurify `uponSanitizeAttribute` hook that allows `style` declarations of the form `color: #hex` and `background-color: #hex`, rejecting everything else (incl. multiple declarations with one malicious).

**Font size and line height (block-level):**
```html
<p class="rt-size-lg rt-lh-relaxed">…</p>
<h2 class="rt-lh-tight">…</h2>
<ul><li class="rt-lh-tight">…</li></ul>
```

**Alignment:**
```html
<p class="rt-align-center">…</p>
```

**Highlights:**
```html
<span class="rt-bg-yellow">…</span>
<span class="rt-bg-custom" style="background-color: #fde047">…</span>
```

### 3.4 Sanitizer changes (lib/sanitizeHtml.ts)

Verified current state: `style` is NOT in `ALLOWED_ATTR`; only three `data-*` attrs are allowlisted. The changes are minimal and additive — they tighten, not loosen, the sanitizer's surface:

1. Add `'style'` to `ALLOWED_ATTR`.
2. Add `uponSanitizeAttribute` hook: when `attr.name === 'style'`, parse declarations, keep only `color: #hex` and `background-color: #hex` with valid hex format (`/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/`), drop everything else. Reject the entire attribute if no valid declarations remain.
3. Allowlist `'class'` (already there) is sufficient for token-based formatting; no new `data-*` needed.

**Required tests** (must be in `lib/sanitizeHtml.test.ts`):
- `style="color: #fff"` survives.
- `style="background-color: #fde047"` survives.
- `style="color: red"` (named color) is stripped — picker outputs hex only.
- `style="color: rgb(255, 0, 0)"` is stripped.
- `style="background: url(javascript:alert(1))"` is stripped.
- `style="color: #fff; background: url(...)"` — color survives, background dropped.
- `style="color: expression(...)"` — stripped.
- `<script>` and event handlers — already covered by existing DOMPurify config; verify still works.

### 3.5 Public render path

- `DefaultTextBlock` (existing) requires **no logic changes** — it already renders sanitized HTML and continues to do so. The sanitizer config tightening in §3.4 is the only change that affects the public path.
- New CSS file `components/blocks/public/rich-text-classes.css` (~30 rules) defines `.rt-color-*`, `.rt-bg-*`, `.rt-size-*`, `.rt-lh-*`, `.rt-align-*`. Imported once globally (per Next.js convention to be verified during impl).
- Class-rule specificity must beat Tailwind's `prose` plugin. Two acceptable strategies; pick during impl based on what works:
  - **a)** Increase specificity: `.prose .rt-color-primary { … }`.
  - **b)** CSS layers: place `rt-*` rules in a layer that overrides `prose`.

**Honest flag:** Strategy must be verified by rendering a paragraph with both `prose` and `rt-color-*` in a real test page. I will not commit a strategy from reading alone.

### 3.6 `prose` defaults update (lazy migration / A2)

Modify `components/blocks/public/proseConfig.ts` (or whichever file defines the prose plugin's overrides) to align body text with Scale B:

- `prose-p:text-base prose-p:leading-[1.55]` (16px / 1.55)
- `prose-h1:text-[32px] prose-h1:leading-[1.15]`
- `prose-h2:text-[26px] prose-h2:leading-[1.2]`
- `prose-h3:text-[20px] prose-h3:leading-[1.3]`
- `prose-h4:text-[17px] prose-h4:leading-[1.4]`
- `prose-ul:leading-[1.55] prose-ol:leading-[1.55]` — fixes the user-reported list-too-tall issue
- `prose-li:my-1` — tightens item-to-item spacing

**Risk to acknowledge:** existing tenant pages will visually shift slightly. We call this out in release notes and spot-check 3–5 real tenant pages on staging before merging to prod.

## 4. Toolbar layout (C-hybrid)

12 always-visible controls grouped by purpose, 5 popovers. Full mockup at `.superpowers/brainstorm/3470-1779836886/content/toolbar-c-hybrid.html` (toolbar-c-hybrid-v2.html for inventory table).

| Group | Controls | UX | Clicks |
|---|---|---|---|
| History | Undo, Redo | Inline | 1 |
| Block type | H1, H2, H3, H4 + Paragraph + Code block | Popover | 2 |
| Inline marks | Bold, Italic, Underline, Strike | Inline toggles | 1 |
| Text color | 8 theme + recent + custom hex | Popover | 2 |
| Highlight | 8 theme + clear + custom hex | Popover | 2 |
| Font size | XS/S/M/L/XL (paragraphs only) | Popover | 2 |
| Line height | Tight/Normal/Relaxed/Loose | Popover | 2 |
| Align | Left, Center, Right | Inline (3 buttons) | 1 |
| Lists | Bullet, Numbered, Blockquote | Inline | 1 |
| Insert | Link, Image, Video | Inline (each opens own dialog) | 1+ |

**Active-state sync:** every control must reflect the current selection's state (fixes user-reported "H3 selected, toolbar still shows H2" bug). Tiptap exposes this via `editor.isActive('heading', {level: 3})` etc. — wire each control's `isActive` to a selection-aware reactive value.

## 5. Type scale (Scale B, Major Third 1.25×)

Default values for the B preset:

| Token | Size | Line-height (default) | Computed |
|---|---|---|---|
| H1 | 32px | 1.15 | 36.8px |
| H2 | 26px | 1.20 | 31.2px |
| H3 | 20px | 1.30 | 26px |
| H4 | 17px | 1.40 | 23.8px |
| Body M | 16px | 1.55 | 24.8px (default) |
| Body S | 14px | 1.60 | 22.4px |
| Body XS | 12px | 1.65 | 19.8px |

**Line-height presets** (multipliers applied on top of the default):

| Preset | Multiplier | Body M result |
|---|---|---|
| Tight | ×0.85 | 1.32 |
| Normal | ×1.00 | 1.55 (default) |
| Relaxed | ×1.15 | 1.78 |
| Loose | ×1.30 | 2.01 |

Verified rule (research): **line-height ratio decreases as size grows.** Headings get tighter line-heights; small text gets looser. Sources: Tailwind defaults, Material Design, Matthew Butterick "Practical Typography", WCAG 2.2 SC 1.4.12, Aleksandr Hovhannisyan "Don't Use a Fixed Line Height".

## 6. Color tokens

Text color (8 swatches in primary row):

| Token | CSS variable |
|---|---|
| Foreground | `var(--theme-foreground)` |
| Muted | `var(--theme-muted)` |
| Primary | `var(--theme-primary)` |
| Secondary | `var(--theme-secondary)` |
| Accent | `var(--theme-accent)` |
| Success | `var(--theme-success)` |
| Warning | `var(--theme-warning)` |
| Danger | `var(--theme-danger)` |

**Honest flag:** Not all eight CSS variables are guaranteed defined by every template today. Impl prerequisite: grep `lib/templates/` and `TemplateProvider` to confirm presence; if any are missing, either add them to the theme system or shrink the token list. Do not ship a color that renders blank.

Highlight palette: yellow, green, blue, pink, purple, orange (6 + clear + custom). Stored as `rt-bg-yellow` etc. Concrete colors decided during impl (visual review).

**Forward-compatibility for Color Styles revamp:** when the new system ships, only the source of the token list changes; the popover UI and the storage model stay identical.

## 7. Mobile behavior

| Viewport | Layout | Controls |
|---|---|---|
| < 768px | Bottom sheet (existing `MobileBottomSheet`) | 40px touch targets, popovers centered on screen |
| ≥ 768px | Desktop right sidebar (existing) | 30px controls, popovers anchored to button |

- iPad portrait (834px): desktop sidebar, accepted as cramped-but-workable. Add a note: revisit if user testing shows it's painful.
- iPad landscape, Fold 6 unfolded landscape: desktop sidebar.
- Apple Pencil: Tiptap handles natively; verify selection stays active during Pencil drag.

**Test plan:**
1. iPhone XR portrait + landscape.
2. Fold 6 folded + unfolded, portrait + landscape.
3. iPad Pro portrait + landscape, full-screen + split-screen.

Each test: tap reliability, soft-keyboard collision, popover positioning.

## 8. Keyboard shortcuts

Tiptap defaults plus:

- `Cmd+Alt+1` / `Cmd+Alt+2` / `Cmd+Alt+3` / `Cmd+Alt+4` → set heading level
- `Cmd+Alt+0` → set paragraph
- `Cmd+Shift+H` → toggle highlight (default theme highlight color)
- `Cmd+Shift+L` / `Cmd+Shift+E` / `Cmd+Shift+R` → align left/center/right

No shortcuts for color/size/line-height (too many options to map cleanly).

**Verify during impl:** which of these Tiptap v3 StarterKit binds by default. Don't double-bind.

## 9. Conflict resolution

- **Alignment** always operates on the entire containing block(s) of the selection.
- **Font-size** dropdown is disabled (grayed) when selection includes any heading or list item. Tooltip: "Font size applies to paragraphs only — use the heading menu for headings."
- **Mixed-state controls** (selection spans formats): button shows neutral (no active highlight); choosing a value applies it uniformly to the entire selection.

## 10. Undo/redo behavior

Each toolbar action = one Tiptap history step. No live preview on hover. No coalescing of rapid same-control changes.

## 11. Explicitly out of scope

These belong to future work and must not be smuggled in:

1. Slash menu (`/heading`, `/list`)
2. Tables
3. Code block language picker / syntax highlighting (plain `<code>` block only)
4. Indent / outdent buttons
5. Subscript / superscript
6. Find & replace
7. Collaborative editing / multi-cursor
8. AI commands ("rewrite this paragraph")
9. Image-in-text resizing / per-image alignment
10. Custom inline marks (callouts, badges, mentions)
11. Drag-to-reorder paragraphs inside the editor
12. Canvas-side inline editing mounting (toolbar is wrapper-agnostic to enable this later; the canvas integration itself is a separate spec)
13. C preset (blog editor) configuration

## 12. Implementation prerequisites (must verify, must not guess)

Before writing implementation, the plan must include explicit verification steps for:

1. **Sanitizer behavior** — write `lib/sanitizeHtml.test.ts` cases (per §3.4) and confirm they pass before relying on the sanitizer hook.
2. **`prose` specificity** — render a paragraph with both `prose` and `rt-color-primary`; confirm color wins. If not, decide between increased specificity vs CSS layers.
3. **Theme CSS variables presence** — grep `lib/templates/` and `TemplateProvider`; confirm all 8 text-color tokens are defined; shrink list or add missing tokens if not.
4. **Tiptap v3 default keyboard shortcuts** — check StarterKit source to avoid double-binding.
5. **Class-name prefix collision** — grep for existing `rt-`, `tt-`, or `rte-` prefixes; pick a non-colliding one.
6. **List selection in Tiptap** — verify that line-height applied to a list item works correctly across the three selection modes (caret inside text, list-item selection, multi-item selection).
7. **Mobile bottom-sheet integration** — confirm `MobileBottomSheet` can host the editor without breaking soft-keyboard behavior.

## 13. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `prose` defaults change shifts existing tenant pages visually | High (intentional) | Release notes; spot-check 3–5 tenant pages on staging |
| `prose` cascade beats `rt-*` classes | Medium | Test before commit; fall back to CSS layers or specificity bumps |
| DOMPurify `style` allowlist hook lets through edge-case payload | Low | Test with malicious payloads (see §3.4 test list); hex regex is restrictive |
| Theme CSS var missing for one of 8 tokens → colored text renders blank | Medium | Verify all 8 vars exist; shrink token list if needed |
| Apple Pencil selection drops toolbar visibility | Low-medium | Real-device test on iPad Pro |
| Font-size pre-release `@tiptap/extension-font-size` not used; our 30-line custom extension drifts from Tiptap's API conventions | Low | Pattern is well-documented; ~30 lines we own and control |
| Inline-editing migration in future requires more than 80 lines | Medium | The "wrapper-agnostic" promise is structural — verify by code review that no `position: sticky` or sidebar-specific assumption leaks into Toolbar |

## 14. Acceptance criteria

The editor is considered shipped when:

1. All five user-reported gaps are closed (H1/H4 access, font size, active-state sync, line-height, text color).
2. C-hybrid toolbar renders cleanly in 320px sidebar, full inline mockup (deferred), AND mobile bottom sheet at 40px touch targets.
3. Round-trip through sanitizer preserves all formatting (token classes + safe inline `style`).
4. All test cases in §3.4 pass.
5. iPhone XR + Fold 6 + iPad Pro pass the test plan in §7.
6. Existing tenant pages render either identically or improved (verified on 3–5 sample pages).
7. `preset` prop architecture is in place; only `"basic"` is implemented; the TypeScript union type for `preset` accepts only `"basic"` today (extending to `"basic" | "full"` happens when C ships).
8. Toolbar component contains zero sidebar-specific or mouse-only assumptions (code review verifies).

## 15. References

- Brainstorm session: this conversation, 2026-05-27
- Visual mockups: `.superpowers/brainstorm/3470-1779836886/content/`
  - `typography-research.html` — research-backed type scale comparison
  - `toolbar-c-hybrid.html` — toolbar layout with popovers opened
  - `toolbar-c-hybrid-v2.html` — final inventory table
  - `inline-compare.html` — B vs C inline floating
  - `scope-compare.html` — B vs C sidebar
- Existing files touched: `components/admin/blocks/rich-text/{RichTextEditor,Toolbar}.tsx`, `components/admin/blocks/forms/TextForm.tsx`, `lib/sanitizeHtml.ts`, `components/blocks/public/{DefaultTextBlock,proseConfig}.tsx/ts`
- Related platform rules (CLAUDE.md / memory):
  - Font Pack is sole source of font choice (rule respected — no font-family picker)
  - Membership is loyalty only (not relevant)
  - Block typography spec (outdated; this spec supersedes its font-size assumptions)
- Sources for typography research:
  - Tailwind CSS font-size defaults
  - Material Design Type Scale (Major Second 1.125)
  - Matthew Butterick, "Practical Typography" — line-spacing 120–145%
  - WCAG 2.2 SC 1.4.12 — text spacing
  - Aleksandr Hovhannisyan, "Don't Use a Fixed Line Height"
  - Number Analytics typography readability guide
  - Greadme typography guide (heading vs body line-height)
  - Robert Bringhurst, "The Elements of Typographic Style" — line length 50–75ch
