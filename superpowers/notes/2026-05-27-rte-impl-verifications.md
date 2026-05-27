# RTE Implementation Pre-Verification Report
**Date:** 2026-05-27  
**Task:** Task 0 – Pre-implementation verification pass (read-only)

---

## Step 1: Theme CSS Variables Exist

**What was run:**
```bash
grep -rE -- "--theme-(foreground|muted|primary|secondary|accent|success|warning|danger)" \
  clicker-platform-v2/lib/templates clicker-platform-v2/components/TemplateProvider.tsx 2>/dev/null | head -30
```

**Findings:**

### Variables Found in `TemplateProvider.tsx` (lines 113–133):
- ✅ `--theme-primary` (always injected)
- ✅ `--theme-background` (always injected)
- ✅ `--theme-foreground` (always injected)
- ✅ `--theme-accent` (conditional: if `theme.colors.accent` exists)
- ✅ `--theme-surface` (conditional: if `theme.colors.surface` exists)
- ✅ `--theme-border` (conditional: if `theme.colors.border` exists)
- ✅ `--theme-text-muted` (conditional: if `theme.colors.textMuted` exists)
- ✅ `--theme-text-subtle` (conditional: if `theme.colors.textSubtle` exists)
- ✅ `--theme-success` (conditional: if `theme.colors.success` exists)
- ✅ `--theme-warning` (conditional: if `theme.colors.warning` exists)
- ✅ `--theme-error` (conditional: if `theme.colors.error` exists)
- ✅ `--theme-overlay` (conditional: if `theme.colors.overlay` exists)

### Variables **NOT found** in templates directory:
- No template-specific CSS variables; all come from `TemplateProvider.tsx`

### ThemeColors interface (`lib/templates/types.ts` lines 8–30):
**Optional color tokens defined:**
- `secondary?: string` – **NOT** defined in any template
- `muted?: string` – **NOT** defined in any template
- `danger?: string` – **NOT** found in types or templates

**Semantic tokens (auto-populated in `definitions.ts` lines 5–16):**
```typescript
SEMANTIC_STATUS_COLORS: {
  error: '#dc2626',                    // red-600
  errorBg: 'rgba(239,68,68,0.10)',   // red-500 @ 10%
  success: '#16a34a',                 // green-600
  successBg: 'rgba(34,197,94,0.10)', // green-500 @ 10%
  warning: '#d97706',                 // amber-600
  warningBg: 'rgba(245,158,11,0.10)',// amber-500 @ 10%
  overlay: 'rgba(0,0,0,0.70)',
}
```
These are merged into every template via `mergeSemanticColors` before render.

### Conclusion:
**8 tokens required by spec (foreground, muted, primary, secondary, accent, success, warning, danger):**

| Token | Status | CSS Variable | Notes |
|-------|--------|--------------|-------|
| foreground | ✅ Available | `--theme-foreground` | Always present |
| primary | ✅ Available | `--theme-primary` | Always present |
| accent | ✅ Available | `--theme-accent` | Conditional; ~100% of templates define it |
| success | ✅ Available | `--theme-success` | Injected via `SEMANTIC_STATUS_COLORS` |
| warning | ✅ Available | `--theme-warning` | Injected via `SEMANTIC_STATUS_COLORS` |
| secondary | ❌ **NOT AVAILABLE** | (none) | Not defined in `ThemeColors`; no CSS variable generated |
| muted | ❌ **NOT AVAILABLE** | (none) | Not defined in `ThemeColors`; no CSS variable generated |
| danger | ❌ **NOT AVAILABLE** | (none) | Not defined in `ThemeColors`; use `error` instead |

**Downstream Action for Task 1:**
- **Remove `secondary` and `muted` swatches from the color picker** — they will never render because no CSS variable exists and no template defines them.
- **Remove `danger` swatch** — the spec lists it, but the codebase uses `error` (token is `--theme-error`, stored as `theme.colors.error`).
- **Use `error` instead of `danger`** in the RTE implementation.

---

## Step 2: Tiptap v3 Default Keyboard Shortcuts

**What was examined:**
- Source code: `/node_modules/@tiptap/extension-heading/src/heading.ts` (lines 127–137)
- StarterKit composition: checked which extensions are bundled

### Heading Extension (`Heading.ts` lines 127–137):
```typescript
addKeyboardShortcuts() {
  return this.options.levels.reduce(
    (items, level) => ({
      ...items,
      ...{
        [`Mod-Alt-${level}`]: () => this.editor.commands.toggleHeading({ level }),
      },
    }),
    {},
  )
}
```

**Bindings by Tiptap StarterKit:**
- `Mod-Alt-1` → `toggleHeading({ level: 1 })` (H1)
- `Mod-Alt-2` → `toggleHeading({ level: 2 })` (H2)
- `Mod-Alt-3` → `toggleHeading({ level: 3 })` (H3)
- `Mod-Alt-4` → `toggleHeading({ level: 4 })` (H4)
- `Mod-Alt-5` → `toggleHeading({ level: 5 })` (H5)
- `Mod-Alt-6` → `toggleHeading({ level: 6 })` (H6)
- `Mod-Alt-0` → **NOT** bound by Heading extension; available for paragraph (we will add this)

### Spec Prescriptions vs. StarterKit Reality:

| Shortcut | Spec Requirement | StarterKit Binds | Conflict? | Action |
|----------|------------------|------------------|-----------|--------|
| Cmd-Alt-1 | H1 | Yes (Heading) | ✅ No – matches | Reuse binding |
| Cmd-Alt-2 | H2 | Yes (Heading) | ✅ No – matches | Reuse binding |
| Cmd-Alt-3 | H3 | Yes (Heading) | ✅ No – matches | Reuse binding |
| Cmd-Alt-4 | H4 | Yes (Heading) | ✅ No – matches | Reuse binding |
| Cmd-Alt-0 | Paragraph | No | ✅ Free – add it | Add in Task 1 |
| Cmd-Shift-H | Highlight | No | ✅ Free – add it | Add in Task 1 |
| Cmd-Shift-L | Align Left | No | ✅ Free – add it | Add in Task 1 |
| Cmd-Shift-E | Align Center | No | ✅ Free – add it | Add in Task 1 |
| Cmd-Shift-R | Align Right | No | ✅ Free – add it | Add in Task 1 |

### Conclusion:
- **Heading shortcuts are pre-bound correctly** (Mod-Alt-1..4 match spec).
- **No need to re-bind heading shortcuts** — the Heading extension already provides them.
- **Highlight and align shortcuts are free** — they can be safely added in Task 1 without conflict.

---

## Step 3: Class-Name Prefix Collision Check

**What was run:**
```bash
cd clicker-platform-v2 && grep -rE 'className=.*"[^"]*\brt-[a-z]' --include="*.tsx" 2>/dev/null | grep -v node_modules
```

**Result:** Empty output (no matches).

**Conclusion:**
- ✅ **`rt-` prefix is free** — no existing component uses it.
- Safe to use `rt-` for all RTE-related Tailwind classes (e.g., `rt-toolbar`, `rt-button-group`, `rt-color-swatch`).

---

## Step 4: List Line-Height Issue's Actual Source

**What was examined:**
1. `/components/blocks/public/proseConfig.ts` (lines 1–74)
2. `/components/admin/blocks/rich-text/RichTextEditor.tsx` (admin context)
3. `/components/blocks/public/DefaultTextBlock.tsx` (public context)
4. All templates in `/lib/templates/definitions.ts` (no CSS overrides found)

### The Setup:

**In `proseConfig.ts` (line 37):**
```typescript
'prose-li:my-1.5 prose-li:leading-snug',
```
- `leading-snug` = line-height 1.375

**Parent container (line 30):**
```typescript
'text-[15px] sm:text-[16px] md:text-[18px] leading-relaxed',
```
- `leading-relaxed` = line-height 1.625

**Inner paragraph override (line 42):**
```typescript
'[&_li>p]:my-0',
```
This suppresses the inner <p>'s margin (which is my-3), but **does NOT override line-height**.

### CSS Cascade Analysis:

In Tailwind/CSS, specificity is determined by selector specificity, not source order. Here's what applies:

1. **Selector specificity order** (from most to least specific):
   - `.prose-li:leading-snug` (applied to `<li>` directly)
   - `.leading-relaxed` (applied to parent container or `<li>` via prose base)
   
2. **What actually wins:**
   - The `prose` plugin in Tailwind injects `.prose li { line-height: ... }` as a low-specificity rule.
   - User classes like `prose-li:leading-snug` override this via Tailwind's class system.
   - **`prose-li:leading-snug` (1.375) wins** at the `<li>` level, making list items tighter.

3. **Parent `leading-relaxed` (1.625) does NOT override the child `<li>` line-height** because:
   - CSS line-height is not always inherited (depends on whether it's unitless or has units).
   - Tailwind's `prose-li:leading-snug` applies specificity directly to `li` elements.
   - The parent `leading-relaxed` applies to the container, not the list item.

### User Symptom ("Lists Too Tall"):

This is **likely a misperception** caused by:
1. **Visual spacing**: `prose-li:my-1.5` (0.375rem = 6px top/bottom per item) makes each `<li>` feel tall.
2. **Combined with `prose-ul:my-4`** (1rem top/bottom on the whole list), the total gap is large.
3. **The snug line-height (1.375) tightens text within each item**, but the outer item spacing dominates.

### Inference:

The "lists too tall" symptom likely comes from:
- **Item vertical margin** (`prose-li:my-1.5`) more than line-height.
- **List-level margin** (`prose-ul:my-4`) adding breathing room.
- NOT from `leading-relaxed` on the parent conflicting with `prose-li:leading-snug`.

**If line-height is the real culprit**, the fix would be to reduce `prose-li:my-1.5` (e.g., to `prose-li:my-1` or `prose-li:my-0.5`), not to fight the cascade.

**Downstream Action for Task 16 (live testing):**
- Reproduce the user's "lists too tall" complaint in the live editor.
- Measure whether the issue is line-height, item margin, or combined spacing.
- Adjust `prose-li:my-*` or `prose-ul:my-*` if needed; line-height conflicts are not the root cause.

---

## Step 5: Next.js Global CSS Import Location

**What was found:**
- Root layout: `/app/layout.tsx` (line 19)
- Globals file: `/app/globals.css`

**Import in layout.tsx (line 19):**
```typescript
import "./globals.css";
```

**Conclusion:**
- ✅ Global CSS is imported in `/app/layout.tsx` (root layout).
- This is the canonical location for global Tailwind, reset styles, and CSS variables.
- **Safe to add RTE-specific global styles** (e.g., `.prose-*` overrides, `rt-*` utility definitions) to `/app/globals.css` if needed.

---

## Step 6: Vitest Configuration for React + DOM Tests

**File:** `/clicker-platform-v2/vitest.config.ts` (lines 1–15)

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',  // ✅ JSDOM for DOM testing
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Verification:**
- ✅ `environment: 'jsdom'` is configured (line 8)
- ✅ React plugin is active (line 2)
- ✅ Setup files are defined
- ✅ Module alias `@` is configured for imports

**Conclusion:**
- ✅ **Vitest is correctly configured for React Testing Library tests** (Task 14).
- No config changes needed for DOM-based component testing.

---

## Summary of Findings

| Verification | Status | Impact |
|---|---|---|
| Theme CSS variables | ⚠️ Partial | Remove `secondary`, `muted`, `danger` swatches; use `error` instead |
| Tiptap heading shortcuts | ✅ Clean | No re-binding needed; Cmd-Alt-1..4 already mapped |
| Class prefix collision | ✅ Clear | `rt-` prefix is free to use |
| List line-height issue | ⚠️ Unclear | Likely due to item margin, not CSS cascade; verify in Task 16 |
| Global CSS location | ✅ Clear | `/app/layout.tsx` → `/app/globals.css` |
| Vitest config | ✅ Ready | JSDOM and React plugin already configured |

---

## Downstream Task Actions

### Task 1 (Spec Review & Swatch Picker):
- **Remove** color tokens: `secondary`, `muted`, `danger`
- **Keep** color tokens: `foreground`, `primary`, `accent`, `success`, `warning`
- **Map `danger` → `error`** in RTE logic (use `theme.colors.error` and `--theme-error`)
- Keyboard shortcuts are already bound by StarterKit; focus on `Cmd-Alt-0`, `Cmd-Shift-H`, `Cmd-Shift-L/E/R`

### Task 16 (Live Testing):
- When testing list rendering, measure whether the user's "lists too tall" symptom is:
  - **Line-height issue** (unlikely based on this analysis)
  - **Margin/padding issue** (more likely)
  - Adjust `prose-li:my-*` or `prose-ul:my-*` accordingly

---

## Confidence Level

- **Theme variables:** 100% confident (code is explicit and verifiable)
- **Tiptap shortcuts:** 100% confident (source code is clear)
- **Class prefix collision:** 100% confident (grep output is empty)
- **List line-height issue:** 70% confident (theoretical analysis; needs live reproduction to confirm)
- **Global CSS location:** 100% confident (explicit import statement)
- **Vitest config:** 100% confident (config file is explicit)

