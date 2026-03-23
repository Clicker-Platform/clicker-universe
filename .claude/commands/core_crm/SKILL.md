---
name: core_crm
description: >
  Work with the Clicker Platform Core CRM features: Forms and the Inbox.
  Use this skill whenever modifying form builders, submission handling,
  inbox filtering, or CRM lead management.
  Trigger on: "add a form field", "inbox filters", "submission status",
  "contact form", "form builder", "app/admin/(dashboard)/forms",
  "app/admin/(dashboard)/inbox".
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /core_crm — Forms & Inbox (Core CRM)

You are working on the **Clicker Platform Core CRM System**. This system provides every tenant with a Form Builder to collect leads, and an Inbox to manage those submissions.

This skill is invoked as `/core_crm [action]`.

---

## 1. Architecture Overview

Unlike the module system which heavily relies on client-side Firestore listeners, the Forms and Inbox system frequently routes through **Next.js API Routes** (`app/api/forms/` and `app/api/submissions/`).

### Why API Routes?

- **Forms Deletion (`/api/forms/delete`)**: When deleting a form, the server must verify that the form is not currently linked to any active System Blocks (e.g., a "Contact Us" card). It returns a `FORM_IN_USE` error if it is.
- **Submission Updates (`/api/submissions/update`)**: Updating a submission's status (e.g., from `new` to `read` or `archived`) is done server-side to ensure proper audit trails and to potentially trigger future email notifications.

---

## 2. Action: `create-form-field`

When adding a new type of field to the Form Builder (e.g., a "Date Picker" or "File Upload"), you must:

1. **Update Data Types**: Locate the form types (likely in `types.ts` or `mockData.ts` if still stubbed) and add the new field type enum.
2. **Update the Builder UI (`app/admin/(dashboard)/forms/builder/`)**: Add the drag-and-drop component so the tenant can configure the field (label, required toggle, placeholder).
3. **Update the Public Renderer**: The form must actually render on the tenant's public site. Locate the `FormBlock` or equivalent component that maps field JSON into HTML `<input>` elements. Ensure your new field type is handled in the `switch` statement.

---

## 3. Action: `modify-inbox`

The Inbox (`app/admin/(dashboard)/inbox/InboxClient.tsx`) manages form submissions.

### Status Flow

Submissions have specific string statuses:

- `new`: Unread submissions.
- `read`: Seen by the tenant.
- `archived`: Hidden from the main view.

### State Management

- `InboxClient.tsx` receives `initialSubmissions` from a Server Component.
- It maintains local state (`submissions`) for immediate optimistic UI updates.
- When an action is taken (e.g., clicking "Archive"), it `POST`s to `/api/submissions/update`.
- If successful, it updates the local state AND calls `router.refresh()` to ensure the server-side data stays perfectly in sync with the client.

**Rule:** Always maintain this optimistic-update + `router.refresh()` pattern when modifying inbox items to prevent stale data bugs.

---

## 4. Common Gotchas

- **Form Linking:** Forms are useless until they are embedded in a Page via a "System Block" (like a Form Card). Because of this tight coupling, you must **never** forcefully delete a form from Firestore directly. Always use the API route to verify it's not in use.
- **Client vs Server State:** The Inbox mixes Server-Side Rendering (initial load) with Client-Side state (filtering). If you add a new filter (e.g., "Sort by Date"), ensure the filter logic is applied to the local `submissions` array in `InboxClient.tsx`, not just via query parameters.
