# Font Packs — TemplateProvider Fix Addendum

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Checkbox (`- [ ]`) tracking.

**Goal:** Make Font Pack selections actually take visible effect by removing the conflicting `--font-heading`/`--font-body` injection from `TemplateProvider`, and moving the template's default-font fallback into `ThemeRegistry` (the single owner of those CSS vars at `:root`).

**Problem this fixes:** `TemplateProvider` writes `--font-heading`/`--font-body` as inline-style CSS variables on its wrapper div. Inline styles beat `:root { … }` rules by CSS specificity. So `ThemeRegistry`'s pack vars are overridden by the template default, making Font Pack selection visually inert end-to-end.

**Direction:** Per the architectural decision (template = tokens only, Block Builder/SiteStyles owns layout & fonts), this addendum permanently relocates font-variable ownership from `TemplateProvider` to `ThemeRegistry` + `applyFontVarsToDocument`. Templates keep their `fonts: { heading, body }` field — direct consumers (`catalog/page.tsx`, `[tenant]/...`, `ProductDetailModal`, `TemplateClient`) still read those strings — but the CSS-variable injection happens in exactly one place.

**Out of scope (acknowledged limitations):**
- Direct `theme.fonts.heading/body` consumers in `catalog/page.tsx`, `[tenant]/page.tsx`, `[tenant]/[...slug]/page.tsx`, `ProductDetailModal.tsx`, `TemplateClient.tsx` will continue reading the template's hardcoded font strings — they don't pick up Font Pack changes. Fixing these to consume `--font-heading`/`--font-body` is a separate v1.1 cleanup.
- Optional follow-up: deleting the `fonts` field from `lib/templates/definitions.ts` once every direct consumer is migrated.

---

## Tasks

### Task A1: Pass `templateId` into `ThemeRegistry`

**Files:**
- Modify: `clicker-platform-v2/components/ThemeRegistry.tsx`
- Modify: `clicker-platform-v2/app/layout.tsx`

- [ ] **Step 1:** In `ThemeRegistry.tsx`, extend `Props` to accept an optional `templateId`:

```tsx
type Props = {
  initialSettings: SiteSettings | null;
  appearanceStyles?: { fontPackId: string | null } | null;
  templateId?: string | null;
};
```

Destructure `templateId` in the function signature.

- [ ] **Step 2:** Add import at top of `ThemeRegistry.tsx`:

```tsx
import { getTemplate } from '@/lib/templates/registry';
```

- [ ] **Step 3:** In the `useServerInsertedHTML` callback, replace the existing pack/fallback computation:

```tsx
const pack = getPackById(appearanceStyles?.fontPackId) ?? null;
const headingVar = pack ? 'var(' + pack.heading.cssVar + ')' : 'var(--font-jakarta)';
const bodyVar = pack ? 'var(' + pack.body.cssVar + ')' : 'var(--font-jakarta)';
```

with:

```tsx
const pack = getPackById(appearanceStyles?.fontPackId) ?? null;
let headingVar: string;
let bodyVar: string;
if (pack) {
  headingVar = 'var(' + pack.heading.cssVar + ')';
  bodyVar = 'var(' + pack.body.cssVar + ')';
} else if (templateId) {
  const template = getTemplate(templateId);
  headingVar = template.config.fonts.heading;
  bodyVar = template.config.fonts.body;
} else {
  headingVar = 'var(--font-jakarta)';
  bodyVar = 'var(--font-jakarta)';
}
```

- [ ] **Step 4:** In `app/layout.tsx`, find the `<ThemeRegistry initialSettings={settings} appearanceStyles={appearanceStyles} />` line and pass `templateId`. The template id should come from settings — check `settings?.templateId`. Update to:

```tsx
<ThemeRegistry
  initialSettings={settings}
  appearanceStyles={appearanceStyles}
  templateId={settings?.templateId ?? null}
/>
```

- [ ] **Step 5:** Type-check:
```
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -iE "ThemeRegistry|layout\.tsx" | head -20
```
Expected: no new errors.

- [ ] **Step 6:** Commit:
```bash
git add clicker-platform-v2/components/ThemeRegistry.tsx clicker-platform-v2/app/layout.tsx
git commit -m "feat(theme): use template default fonts as ThemeRegistry fallback"
```

---

### Task A2: Remove font CSS-var injection from `TemplateProvider`

**Files:**
- Modify: `clicker-platform-v2/components/TemplateProvider.tsx`

- [ ] **Step 1:** Delete lines 146–148 in `TemplateProvider.tsx`:

```tsx
        // Inject Fonts
        if (theme.fonts?.heading) vars['--font-heading'] = theme.fonts.heading;
        if (theme.fonts?.body) vars['--font-body'] = theme.fonts.body;
```

Replace with a brief explanatory comment:

```tsx
        // Font CSS variables are owned by ThemeRegistry (no-pack fallback) and
        // SiteStylesPanel's applyFontVarsToDocument (optimistic preview).
        // TemplateProvider intentionally does NOT inject --font-heading/--font-body
        // so Font Pack selections aren't overridden by inline-style specificity.
```

- [ ] **Step 2:** Type-check:
```
cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -iE "TemplateProvider" | head -10
```
Expected: no errors.

- [ ] **Step 3:** Commit:
```bash
git add clicker-platform-v2/components/TemplateProvider.tsx
git commit -m "fix(theme): stop injecting font CSS vars from TemplateProvider"
```

---

### Task A3: Verify optimistic preview path

**Files:** (verification, no code changes unless a bug is found)

- [ ] **Step 1:** Re-read `FontsSection.applyFontVarsToDocument` at `components/admin/blocks/panels/site-styles/FontsSection.tsx:11-19`. It targets `document.documentElement` — this is now correct since `TemplateProvider` no longer competes for these vars.

- [ ] **Step 2:** Run the existing integration test:
```
cd clicker-platform-v2 && pnpm test SiteStylesPanel
```
Expected: 4/4 still passing (no change required).

- [ ] **Step 3:** No commit needed for this verification task unless a bug surfaces.

---

### Task A4: Build smoke test

**Files:** (build + grep verification)

- [ ] **Step 1:** Rebuild to confirm no regression:
```
cd clicker-platform-v2 && pnpm build 2>&1 | tail -5
```
Expected: build succeeds.

- [ ] **Step 2:** Spot-check that `TemplateProvider` no longer emits font vars:
```
grep -n "font-heading\|font-body" clicker-platform-v2/components/TemplateProvider.tsx
```
Expected: only the comment lines, no `vars['--font-...']` assignments.

- [ ] **Step 3:** Confirm `ThemeRegistry` is now the sole SSR writer:
```
grep -n "font-heading\|font-body" clicker-platform-v2/components/ThemeRegistry.tsx
```
Expected: both vars present in the emitted `:root` block.

---

## Out-of-scope notes (for follow-up plans)

- **Direct consumers**: 5 files still read `template.config.fonts.heading/body` or `theme.fonts.heading/body` directly. These don't pick up Font Pack changes. A v1.1 cleanup would migrate each to consume `var(--font-heading)`/`var(--font-body)` instead.
- **Template `fonts` field**: kept for backwards compatibility with direct consumers. Eventual cleanup: drop the field, replace with `defaultFontPackId`.
