# Font Pack Migration Recon (M0)

Date: 2026-05-19

---

## Q1 — Is `[data-template]` strictly outside admin chrome?

**Verdict: YES — clean boundary.**

`data-template` is set in exactly one place: `components/TemplateProvider.tsx:198`, on a `div.contents` that wraps only the children passed to it.

`TemplateProvider` is mounted in two admin contexts:

1. **`components/admin/blocks/CanvasStudio.tsx:268`** — wraps the canvas preview subtree (lines 268–491), which ends at the closing `</TemplateProvider>` on line 491. The outer studio chrome (left icon strip, left panel, right sidebar, slide-over panels, toolbar, `inlineToolbar`) is all rendered at line 898+ as siblings or ancestors of the canvas container, none of which are inside `TemplateProvider`.

2. **`components/admin/blocks/forms/QuickActionsBlockForm.tsx`** and `LinkBlockForm.tsx` — use `useTemplate()` (read-only context access), not `TemplateProvider` itself. Not a wrapping concern.

The admin dashboard root `app/admin/(dashboard)/layout.tsx` mounts no `TemplateProvider` at all — it uses `AdminThemeProvider`, `UserProvider`, `AdminGuard`, `InboxPanelProvider`, and `AdminContentWrapper` only.

All other `TemplateProvider` consumers are public-site components (`SharedPageLayout`, `PublicPageRenderer`, block components, header/footer layout, catalog) and tests.

**Recommendation: No changes needed. Assumption holds.**

---

## Q2 — What does `template.config.fonts.heading.includes('Inter')` gate?

Found in two identical locations:
- `app/[tenant]/page.tsx:203`
- `app/[tenant]/[...slug]/page.tsx:253`

Both apply to an `<h1>` element that renders a page title (the `homePage.title` / `page.title` field). The full class string on that `h1` is `text-3xl font-extrabold text-theme-foreground mb-6 border-b-2 border-theme-border/30 pb-4` plus the conditional `tracking-normal`.

There is no sibling `tracking-tight` or other tracking class in the string. The conditional adds `tracking-normal` only for Inter; for all other fonts nothing is added (Tailwind's default tracking, which is `tracking-normal` anyway — i.e., `letter-spacing: 0`). This is effectively a no-op: Tailwind's base tracking for all elements is `tracking-normal` unless a utility overrides it, and no other tracking utility is present in this class string.

The intent was probably to document that Inter should not get tight tracking, but because no `tracking-tight` is ever set unconditionally, the guard changes nothing visually.

**Recommendation: (c) Drop the class entirely — it's a no-op. No unconditional replacement needed.**

---

## Q3 — `ThemeMockup.tsx:36` — leave or migrate?

`ThemeMockup` is exported from `components/admin/ThemeMockup.tsx` but is **not imported anywhere** in the codebase (grep over all `.tsx/.ts/.js` files returns zero hits outside the file itself). It is dead code as of this recon.

The component renders a scaled-down `PublicPageRenderer` preview (a full public site mockup at `scale(0.85)` or `scale(0.35)`) driven by mock data. It accepts a `template` prop and the `fontFamily` fallback at line 36 (`template.id === 'shuvo' ? 'Playfair Display' : 'Plus Jakarta Sans'`) feeds into `displaySettings` but that value is only used inside the mock data payload, not as a CSS font-family injection. The preview fidelity for font rendering is therefore already approximate.

Since it is dead code and not part of any active render path, migrating it to `defaultFontPackId` would have zero user-visible effect.

**Recommendation: Leave alone (dead code — not part of the font pipeline). Can be deleted separately if desired, but no migration action needed for M1–M7.**
