# Inline Edit Pattern — Platform Rollout

**Status:** Pattern decided 2026-05-26. Implemented in `DefaultFeatureCardsBlock` first. Rollout to other blocks is opportunistic — happens on next-touch, not as a dedicated refactor.

## The pattern (Option B)

For optional text fields on blocks (label, tagline, body, subtitle, badge, etc.):

- **Empty in admin canvas = not rendered.** Same as public. No ghost placeholders, no phantom height.
- **Affordance to add the field lives in the block/card selection toolbar.** Buttons like `+ Label`, `+ Body` appear only when the field is empty. Clicking seeds the field with an empty string + focuses the editable element.
- **Once content exists, the `+ Field` button disappears from the toolbar** and the field renders as a normal `EditableText`.

Reference implementation: `components/blocks/public/DefaultFeatureCardsBlock.tsx` + `components/admin/blocks/inline/CardToolbar.tsx` (toolbar now accepts a `missingFields` list and emits `onAddField`).

## What this replaces (Option A, the old Hero pattern)

```tsx
{(data?.tagline != null && data.tagline !== '' && (data.tagline || onInlineChange)) && (
    <EditableText ... placeholder="Add tagline…" />
)}
```

Old pattern: always render `EditableText` with `onInlineChange` set, even when empty → shows a faint ghost placeholder that takes up ~1 line of height. Editor and publish drift by `(line count of empty optional fields)`.

Found in: `DefaultHeroBlock`, `DefaultHeadingBlock`, anywhere else using ghost placeholders.

## Why migrate

1. **Layout truth.** WYSIWYG should be honest. User flagged this for feature_cards; same drift exists in Hero.
2. **Cleaner cards/sections.** No persistent "Add subtitle…" noise on every page.
3. **Matches Squarespace/Notion/Linear conventions.** Affordance in a contextual toolbar, not as a permanent placeholder in the layout.

## Migration plan — DO NOT DO AS A SPRINT

Touch blocks one at a time as you naturally edit them for unrelated work.

Order roughly by impact:
1. ✅ feature_cards (done — 2026-05-26)
2. Hero — most-used block, biggest visible win
3. Heading
4. Testimonials
5. ContentShowcase
6. Anything else still using `(value || onInlineChange)` gating

## Scaling concerns to revisit

- **Toolbar width.** Hero has many optional fields (tagline, subtitle, badges, CTA, secondary CTA, etc.). Inline `+ Field` buttons won't all fit. When the count goes above ~2 missing fields, the toolbar likely needs a `+` dropdown menu instead of per-field buttons. Decide at Hero migration time, not before.
- **Block-level toolbar.** Currently CardToolbar is per-card (sub-selection). For Hero we'd need an equivalent toolbar that floats over the *whole block* when the block is selected. May want to extract a shared `SelectionToolbar` primitive at that point — but only after we have 2 concrete implementations, not before.
- **Field metadata.** When migrating more blocks, consider whether each block should declare its optional fields in a structured way (e.g., a config object) rather than the toolbar component hardcoding which `+ Field` buttons to render per block type. Probably the right move once 3+ blocks use it.

## Non-goals

- Do not migrate `title`/`headline` fields — those are required, always render, always editable. Pattern applies only to **optional** text fields.
- Do not remove `EditableText`. The primitive stays; only the gating convention changes.
- Do not unify FeatureCard inline-edit with Hero inline-edit prematurely. Two concrete implementations first, abstraction later.
