# Font Pack Full Migration — Eliminate Figtree + Template Font Ownership

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) tracking.

**Goal:** Make Font Pack the sole source of `--font-heading`/`--font-body` values. Delete Figtree and `--font-jakarta`. Admin chrome switches to the system font stack. Templates lose the `fonts: { heading, body }` field; each ships with a `defaultFontPackId`.

**Why:** Multiple competing font sources (template `fonts`, Font Pack vars, `--font-jakarta` fallbacks, Tailwind body utilities, direct `template.config.fonts.heading` reads in 4 files) make the Font Pack selection unreliable. Eliminating non-Font-Pack writers collapses the cascade to one source of truth.

**Architecture target:**

| Surface | Font source |
|---|---|
| Admin chrome (sidebar, panels, dashboards) | System stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`) |
| Public site content | `var(--font-heading)` / `var(--font-body)` from active Font Pack (with `system-ui` ultimate fallback) |
| Canvas preview content | Same as public (rendered inside `[data-template]`) |

After migration: no `Figtree` import, no `--font-jakarta` variable, no `template.config.fonts` field, no `template.config.fonts.*` reads anywhere.

---

## Pre-migration recon (Task M0 — verification only, no code changes)

Before any edits, verify three architectural assumptions:

1. **`[data-template]` scope is genuinely outside admin chrome.** The admin sidebar/panels must NOT live inside a `[data-template]` ancestor. If they do, the system-stack admin rule won't isolate properly.
2. **The `.includes('Inter')` tracking trick** at `app/[tenant]/page.tsx:203` and `app/[tenant]/[...slug]/page.tsx:253` — what does it actually do? Is it gating a Tailwind class? Read both files and the surrounding context.
3. **`ThemeMockup.tsx:36`** — uses `template.id === 'shuvo' ? 'Playfair Display' : 'Plus Jakarta Sans'` for an admin preview tile. Decide: leave as-is (admin-only), or migrate to use the chosen `defaultFontPackId`.

Output of M0: a short reconnaissance note saved to `superpowers/notes/2026-05-19-fontpack-migration-recon.md` with answers to all three. No code changed in this task.

---

## Task M1: Add `defaultFontPackId` to `TemplateDefinition` type and definitions

**Files:**
- Modify: `clicker-platform-v2/lib/templates/types.ts`
- Modify: `clicker-platform-v2/lib/templates/definitions.ts`

- [ ] **Step 1:** In `lib/templates/types.ts`, find the `ThemeFonts` type / `TemplateConfig`. Add a new required field to the template's `config`:

```ts
defaultFontPackId: string;
```

Keep the existing `fonts: ThemeFonts` field for now (we'll remove it in Task M5 after all consumers migrate). Mark it `@deprecated` in a JSDoc comment.

- [ ] **Step 2:** In `lib/templates/definitions.ts`, add `defaultFontPackId` to every template's `config` block per the mappings:

| Template | defaultFontPackId |
|---|---|
| `classic` | `'clean-minimal'` |
| `modern` | `'brutalist'` |
| `sojourner` | `'clean-minimal'` |
| `shuvo` | `'editorial-serif'` |
| `mrb` | `'bold-display'` |
| `mrb-light` | `'clean-minimal'` |

Place the field next to the existing `fonts:` block for readability.

- [ ] **Step 3:** Type-check:
```
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -iE "templates|definitions" | head -10
```
Expected: no new errors.

- [ ] **Step 4:** Commit:
```bash
git add clicker-platform-v2/lib/templates/types.ts clicker-platform-v2/lib/templates/definitions.ts
git commit -m "feat(templates): add defaultFontPackId field to each template"
```

---

## Task M2: ThemeRegistry resolves Font Pack via template default

**Files:**
- Modify: `clicker-platform-v2/components/ThemeRegistry.tsx`

- [ ] **Step 1:** Find the existing pack-resolution block in ThemeRegistry (currently uses `getPackById(appearanceStyles?.fontPackId)` and falls back to `template.config.fonts.heading/body`). Replace it so the fallback path looks up the *template's* default pack instead:

```tsx
import { getPackById, getDefaultPack } from '@/lib/fonts/packs';

// inside the useServerInsertedHTML callback, replace the existing pack resolution:
const sitePack = getPackById(appearanceStyles?.fontPackId);
let pack;
if (sitePack) {
  pack = sitePack;
} else if (templateId) {
  const template = getTemplate(templateId);
  pack = getPackById(template.config.defaultFontPackId) ?? getDefaultPack();
} else {
  pack = getDefaultPack();
}
const headingVar = 'var(' + pack.heading.cssVar + ')';
const bodyVar = 'var(' + pack.body.cssVar + ')';
```

Remove the existing `else if (templateId) { ... template.config.fonts.heading ... }` and `else { headingVar = 'var(--font-jakarta)' }` branches. After this task, ThemeRegistry NEVER falls back to `--font-jakarta` and never reads `template.config.fonts.*`.

- [ ] **Step 2:** Add a `getDefaultPack()` helper to `lib/fonts/packs.ts`:

```ts
export function getDefaultPack(): FontPack {
  const pack = FONT_PACKS.find(p => p.id === DEFAULT_PACK_ID);
  if (!pack) throw new Error('DEFAULT_PACK_ID references missing pack: ' + DEFAULT_PACK_ID);
  return pack;
}
```

- [ ] **Step 3:** Type-check + run the catalog test:
```
cd clicker-platform-v2 && pnpm tsc --noEmit && pnpm test lib/fonts
```

- [ ] **Step 4:** Commit:
```bash
git add clicker-platform-v2/components/ThemeRegistry.tsx clicker-platform-v2/lib/fonts/packs.ts
git commit -m "feat(theme): resolve template default fonts via Font Pack only"
```

---

## Task M3: Migrate direct consumers of `template.config.fonts.*`

**Files:**
- Modify: `clicker-platform-v2/app/catalog/page.tsx`
- Modify: `clicker-platform-v2/app/[tenant]/page.tsx`
- Modify: `clicker-platform-v2/app/[tenant]/[...slug]/page.tsx`
- Modify: `clicker-platform-v2/components/catalog/ProductDetailModal.tsx`

These four files read `template.config.fonts.heading/body` directly and apply via inline `style={{ fontFamily: ... }}` or class-string interpolation. We migrate each to consume `var(--font-heading)`/`var(--font-body)` so they pick up Font Pack changes automatically.

- [ ] **Step 1: `catalog/page.tsx:136`**

Replace:
```tsx
style={{ fontFamily: template.config.fonts.heading }}
```
With:
```tsx
style={{ fontFamily: 'var(--font-heading)' }}
```

- [ ] **Step 2: `ProductDetailModal.tsx:79,92`**

Replace lines 79 and 92:
```tsx
fontFamily: theme.fonts.body,   // → fontFamily: 'var(--font-body)'
fontFamily: theme.fonts.heading // → fontFamily: 'var(--font-heading)'
```

- [ ] **Step 3: The `.includes('Inter')` trick** at `[tenant]/page.tsx:203` and `[tenant]/[...slug]/page.tsx:253`.

This is the trickier migration. The original code:
```tsx
${template.config.fonts.heading.includes('Inter') ? 'tracking-normal' : ''}
```

Per the M0 recon note, this gates a Tailwind tracking utility class based on whether the heading font is Inter (which has slightly tighter native tracking than typical serifs). With Font Pack-driven fonts, the heading font is no longer knowable at render-time without reading the active pack.

**Resolution:** Replace with an unconditional `tracking-tight` (closest visual match across both serif and sans heading packs), OR look up the active pack server-side and apply the class based on its category. The simpler resolution is `tracking-tight` unconditionally — if visual regression appears for serif templates, follow up with a pack-aware variant.

Apply:
```tsx
// Remove the .includes('Inter') gate; use static class.
// Before:  ${template.config.fonts.heading.includes('Inter') ? 'tracking-normal' : ''}
// After:   tracking-tight
```

Verify both files don't have additional `template.config.fonts.*` reads beyond this one.

- [ ] **Step 4:** Type-check:
```
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -iE "catalog|tenant|ProductDetailModal" | head
```

- [ ] **Step 5:** Commit:
```bash
git add clicker-platform-v2/app/catalog/page.tsx \
        clicker-platform-v2/app/\[tenant\]/page.tsx \
        clicker-platform-v2/app/\[tenant\]/\[...slug\]/page.tsx \
        clicker-platform-v2/components/catalog/ProductDetailModal.tsx
git commit -m "feat(catalog,tenant): migrate font-family reads to Font Pack CSS vars"
```

---

## Task M4: Replace Figtree with system stack in `app/layout.tsx`

**Files:**
- Modify: `clicker-platform-v2/app/layout.tsx`

- [ ] **Step 1:** Remove the `Figtree` import from the `next/font/google` import block.

- [ ] **Step 2:** Delete the `figtree` const declaration:
```ts
const figtree = Figtree({ subsets: ["latin"], variable: "--font-jakarta", weight: ['400','500','600','700','800'], display: 'swap' });
```

- [ ] **Step 3:** Remove `figtree.variable` from the `FONT_CLASS_NAMES` array. The array should now start with `spaceMono.variable`.

- [ ] **Step 4:** Type-check:
```
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -iE "layout\.tsx|Figtree" | head
```
Expected: no `Figtree` references in compiled output.

- [ ] **Step 5:** Commit:
```bash
git add clicker-platform-v2/app/layout.tsx
git commit -m "feat(fonts): remove Figtree from layout — system stack for admin, Font Pack for content"
```

---

## Task M5: Clean up `globals.css` — system stack for admin, drop `--font-jakarta`

**Files:**
- Modify: `clicker-platform-v2/app/globals.css`

- [ ] **Step 1:** In the `:root { ... }` block, remove any line that defines `--font-heading` or `--font-body` directly (the isolation-test lines added during debugging). Leave brand colors, theme tokens, etc. intact.

- [ ] **Step 2:** Remove the `@theme { ... --font-jakarta: var(--font-jakarta); ... }` line.

- [ ] **Step 3:** Update the `body { ... }` rule. Change:
```css
body {
  background-color: var(--theme-background);
  font-family: var(--font-jakarta), sans-serif;
  color: var(--theme-foreground);
  transition: ...;
}
```
to:
```css
body {
  background-color: var(--theme-background);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  color: var(--theme-foreground);
  transition: ...;
}
```

- [ ] **Step 4:** Update the four `[data-template] :is(...)` rules. Change each fallback chain from:
```css
var(--font-heading, var(--font-jakarta), system-ui, sans-serif)
```
to:
```css
var(--font-heading, system-ui, sans-serif)
```

And similarly for body:
```css
var(--font-body, system-ui, sans-serif)
```

Keep the `!important` markers (still needed against Tailwind's body cascade).

- [ ] **Step 5:** Verify no remaining `--font-jakarta` references:
```
grep -n "\-\-font-jakarta" clicker-platform-v2/app/globals.css
```
Expected: 0 matches.

- [ ] **Step 6:** Commit:
```bash
git add clicker-platform-v2/app/globals.css
git commit -m "fix(typography): system-ui for admin chrome, drop --font-jakarta entirely"
```

---

## Task M6: Remove `fonts` field from `TemplateDefinition` (final cleanup)

**Files:**
- Modify: `clicker-platform-v2/lib/templates/types.ts`
- Modify: `clicker-platform-v2/lib/templates/definitions.ts`

After Tasks M2 and M3, no code reads `template.config.fonts.*` anymore. Now we can delete the field entirely.

- [ ] **Step 1:** Verify no remaining consumers:
```
grep -rn "fonts\.heading\|fonts\.body\|theme.fonts\|config\.fonts" clicker-platform-v2 --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | grep -v __tests__
```
Expected: 0 matches in production code. If any remain, fix them before continuing.

- [ ] **Step 2:** In `lib/templates/types.ts`, remove the `fonts: ThemeFonts` field from the template config type. Also remove the `ThemeFonts` type itself if no other consumer uses it (grep first).

- [ ] **Step 3:** In `lib/templates/definitions.ts`, remove every `fonts: { heading: '...', body: '...' }` block (6 templates × one block each).

- [ ] **Step 4:** Type-check:
```
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -iE "templates|fonts" | head
```
Expected: no new errors.

- [ ] **Step 5:** Commit:
```bash
git add clicker-platform-v2/lib/templates/types.ts clicker-platform-v2/lib/templates/definitions.ts
git commit -m "refactor(templates): remove fonts field — Font Pack is sole source"
```

---

## Task M7: Smoke test and verification

**Files:** (no code changes — verification only)

- [ ] **Step 1:** Build:
```
cd clicker-platform-v2 && pnpm build 2>&1 | tail -5
```
Expected: succeeds.

- [ ] **Step 2:** Audit compiled CSS for residual Figtree/`--font-jakarta`:
```
grep -c "Figtree\|--font-jakarta" clicker-platform-v2/.next/static/css/*.css 2>/dev/null
```
Expected: 0 for both terms.

- [ ] **Step 3:** Run the integration test:
```
cd clicker-platform-v2 && pnpm test SiteStylesPanel
```
Expected: 4/4 pass.

- [ ] **Step 4:** Run the fonts catalog test:
```
cd clicker-platform-v2 && pnpm test lib/fonts
```
Expected: passes.

- [ ] **Step 5: Manual browser test (defer to user).** With `pnpm dev` running:

1. Visit admin Canvas Studio → confirm sidebar, panels, toolbars render in system font (Mac: San Francisco; not Figtree).
2. Open Site Styles → Fonts → pick "Editorial Serif".
3. Confirm canvas preview headings render in Playfair Display.
4. Confirm admin chrome (sidebar, top bar) does NOT change font.
5. Visit public site at `localhost:3000/<tenant>/<page>` → confirm headings render in Playfair Display.
6. Reset to template default → confirm fallback to template's `defaultFontPackId` works.
7. Test each template's default by switching templates with no Font Pack set.

- [ ] **Step 6:** Document the smoke-test pass/fail in the recon note from M0.

---

## Out of scope

- **`ThemeMockup.tsx:36`** (`template.id === 'shuvo' ? 'Playfair Display' : 'Plus Jakarta Sans'`): admin preview tile — decide during M0 recon whether to leave alone or migrate.
- **`SiteInfoPanel.tsx:112`** (`fontFamily: 'Plus Jakarta Sans'`): admin component, hardcoded; not part of this migration.
- **`TemplateClient.tsx:30`** (`fontFamily: 'Plus Jakarta Sans'`): admin template-picker tile; not part of this migration.
- **`settings.fontFamily` legacy field** in ThemeRegistry: still loaded via the `<link data-font-swap>` path for sites with custom Google Fonts. Not migrated by this slice. Sites using `settings.fontFamily` continue to use it for the body element, but admin no longer falls back to it.

---

## Risks / mitigations

- **Risk:** A template's `defaultFontPackId` references a missing pack id. **Mitigation:** Task M2's `getDefaultPack()` falls back to `clean-minimal` if pack lookup fails; Task M1 type field is `string` (no compile-time pack-id validation). Add a runtime unit test to `lib/fonts/__tests__/packs.test.ts` that asserts every template's `defaultFontPackId` resolves to a real pack — could be a Task M2 sub-step.
- **Risk:** The `.includes('Inter')` `tracking-normal` gate was protecting serif templates from too-tight tracking. **Mitigation:** Use `tracking-tight` unconditionally per M3 Step 3. If visual regression appears on the `shuvo` template (serif heading), follow up with a pack-aware variant.
- **Risk:** Removing the `fonts` field breaks an external/admin consumer I haven't found. **Mitigation:** M6 Step 1's grep gate. If matches surface, address them before deleting the type field.
