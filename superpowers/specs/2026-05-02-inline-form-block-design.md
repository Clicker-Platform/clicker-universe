# Inline Form Block — Design Spec

**Date:** 2026-05-02
**Status:** Approved

---

## Overview

A new Canvas Studio block type (`inline_form`) that embeds an existing published form directly into a page as inline content. Visitors fill and submit the form without any modal or overlay. The block is a container — it references a form by ID and renders its fields inline, reusing the existing form submission infrastructure.

---

## Problem

Forms today are only accessible via Quick Actions links, which open a `FormModal` overlay. There is no way to embed a form as a first-class content section on a custom page. This limits use cases like contact pages, registration pages, and lead-capture landing pages.

---

## Approach

**Option A (chosen):** Extract shared primitives from `FormModal.tsx` (`useFormSubmit` hook + `FormFieldsRenderer` component), then build the inline block on top of those primitives. `FormModal` is refactored to use the same primitives — no logic duplication.

Rejected alternatives:
- Option B (copy-paste): Creates maintenance divergence — new field types added to FormModal won't automatically appear in the block.
- Option C (RSC): Doesn't fit Canvas Studio's all-client block pattern; adds complexity without payoff.

---

## Data Model

**Block type string:** `'inline_form'`

**Block data shape:**
```ts
{
  formId: string;          // ID of the published form to embed
  heading?: string;        // Optional heading above the form
  subheading?: string;     // Optional subtitle / description line
  successMessage?: string; // Shown after submit. Default: "Thank you! We'll be in touch."
  redirectUrl?: string;    // Optional. If set, redirect here after success instead of message
}
```

**Default data:**
```ts
{
  formId: '',
  heading: '',
  subheading: '',
  successMessage: "Thank you! We'll be in touch.",
  redirectUrl: '',
}
```

The block stores only a `formId` reference. The form definition (fields, buttonText) is fetched at render time from the existing `/api/forms` endpoint. Editing the form in the Forms admin automatically updates every page that embeds it.

No new Firestore collections, no new API routes, no schema migrations.

---

## Shared Primitives (Refactor)

### `lib/forms/useFormSubmit.ts`

A hook that owns all submission logic, extracted from `FormModal.tsx`.

```ts
useFormSubmit({ siteId, form, onSuccess }) => {
  formData: Record<string, any>,
  setField: (fieldId: string, value: any) => void,
  submitting: boolean,
  error: string | null,
  handleSubmit: (e: FormEvent) => Promise<void>,
}
```

Calls `POST /api/forms/submit`. Invokes `onSuccess()` on success. `FormModal` is refactored to use this hook — its own `useState` submission logic is replaced. No callers of `FormModal` change.

### `components/forms/FormFieldsRenderer.tsx`

A pure render component for all field types.

```tsx
<FormFieldsRenderer
  fields={form.fields}
  formData={formData}
  onChange={setField}
  inputClassName="..."   // caller supplies theme-specific styling
/>
```

Renders: text, email, tel, textarea, select, file. `FormModal` refactors to use this instead of its inline field JSX. The inline block also uses it.

---

## Admin Sidebar Form (`InlineFormBlockForm.tsx`)

Shown in Canvas Studio when the block is selected. Four fields:

1. **Form selector** — `<select>` dropdown populated by fetching all published forms for the site (via existing `/api/forms` pattern). Shows form title. Empty state: "No published forms yet — create one in Forms."
2. **Heading** — optional text input. Placeholder: "e.g. Contact Us".
3. **Subheading** — optional text input. Placeholder: "e.g. Fill in the form below and we'll get back to you."
4. **Success behavior** — two sub-fields:
   - "Success Message" — text input, pre-filled with default.
   - "Redirect URL" — optional text input. If filled, redirect takes priority over the success message.

Registered in `BlockFormRenderer` with `renderWithLayoutPicker` so the block gets the standard layout variant picker (background color/image/video).

---

## Public Renderer (`DefaultInlineFormBlock.tsx`)

### States

**Loading** — while fetching the form by `formId`: show a skeleton (grey rounded bars).

**Empty/error** — if `formId` is blank, form is unpublished, or form is deleted: `return null`. No broken UI visible to visitors.

**Filled** — main render:

```
┌─────────────────────────────────────┐
│  [Heading]          ← if set        │
│  [Subheading]       ← if set        │
│                                     │
│  [field label]                      │
│  [input]                            │
│  ...                                │
│  [Submit Button]  ← form.buttonText │
└─────────────────────────────────────┘
```

### Post-submit behavior

- If `redirectUrl` is set → `router.push(redirectUrl)`
- Otherwise → replace the form with the inline success message (no modal, no page navigation)

### Styling

- CSS variables: `var(--theme-primary)`, `var(--theme-foreground)`, etc. — respects all templates
- Input fields: same class pattern as `FormModal` (bg-white, dark variant, border, rounded-lg)
- Layout: `max-w-2xl mx-auto`, `px-4 py-10`
- No `isFirst` prop — this block renders no images

---

## Registration (7 Touch Points)

| Touch Point | File | Change |
|-------------|------|--------|
| BlockType union | `data/mockData.ts` | Add `'inline_form'` |
| BLOCK_OPTIONS | `components/admin/blocks/blockDefinitions.ts` | Add entry with `ClipboardList` icon |
| getDefaultData | `components/admin/blocks/blockDefinitions.ts` | Add case |
| Admin form | `components/admin/blocks/forms/InlineFormBlockForm.tsx` | Create |
| BlockFormRenderer | `components/admin/blocks/BlockFormRenderer.tsx` | Dynamic import + coreLabels + switch case |
| Public renderer | `components/blocks/public/DefaultInlineFormBlock.tsx` | Create |
| BlockRenderer | `components/blocks/BlockRenderer.tsx` | Dynamic import + switch case |

---

## Full File List

| Action | File |
|--------|------|
| New | `lib/forms/useFormSubmit.ts` |
| New | `components/forms/FormFieldsRenderer.tsx` |
| Refactor | `components/FormModal.tsx` |
| New | `components/admin/blocks/forms/InlineFormBlockForm.tsx` |
| New | `components/blocks/public/DefaultInlineFormBlock.tsx` |
| Modify | `data/mockData.ts` |
| Modify | `components/admin/blocks/blockDefinitions.ts` |
| Modify | `components/admin/blocks/BlockFormRenderer.tsx` |
| Modify | `components/blocks/BlockRenderer.tsx` |

---

## Out of Scope

- New field types (handled separately in the Forms system)
- Multi-step / wizard forms
- CAPTCHA / spam protection
- Form analytics / conversion tracking
- Inline form creation (admin must create the form in Forms first, then select it in the block)
