---
name: core_content
description: >
  Work with the Clicker Platform Core Content features: Pages, Links, and System Blocks.
  Use this skill whenever modifying the Link-in-bio (Links) feature, Custom Pages,
  or the Homepage block layout builder.
  Trigger on: "add a link", "custom page", "system block", "homepage layout",
  "link in bio", "app/admin/(dashboard)/pages", "app/admin/(dashboard)/links",
  "lib/systemBlocks.ts".
---

# /core_content — Pages, Links & System Blocks

You are working on the **Clicker Platform Core Content System**. This system handles the structural content of a tenant's site, including their custom pages, their Link-in-Bio links, and the ordering of content blocks on their homepage.

This skill is invoked as `/core_content [action]`.

---

## 1. System Blocks (`lib/systemBlocks.ts`)

The tenant's homepage is constructed using a series of dynamic **System Blocks** (e.g., Quick Actions, Featured Product, Gallery, Business Hours).

### Action: `add-system-block`

If asked to create a new content block for the homepage (e.g., an "Announcements" block):

1. **Define the ID**: Open `lib/systemBlocks.ts` and add `ANNOUNCEMENTS: 'announcements'` to the `SYSTEM_BLOCK_IDS` const.
2. **Update the Generator**: In `generateSystemBlocks()`, add a new `switch` case for your ID. Return a `PageBlock` object with the correct type.
3. **Update the UI Builder**: The tenant manages the order and visibility of these blocks in `Appearance > Block Layout`. Ensure the new block is available in the sortable drag-and-drop list (likely in `AppearanceClient.tsx` or a dedicated block editor component).
4. **Update the Public Renderer**: Open the public site's block renderer (e.g., `BlockRenderer.tsx` on the storefront side) and implement the component that actually draws the "Announcements" HTML when it encounters that block type.

---

## 2. Links (Link-in-Bio)

The `app/admin/(dashboard)/links` feature allows tenants to build a "Linktree-style" list of external or internal URLs.

- **LinksClient.tsx**: This is the main admin interface. It handles creating, editing, deleting, and reordering links.
- **Reordering**: Link sorting usually relies on an `order` or `position` integer field on the link document. When a user drags-and-drops a link, you must iterate over the updated array and bulk-update the `order` field in Firestore for all affected links.

---

## 3. Custom Pages

The `app/admin/(dashboard)/pages` feature allows tenants to create standalone pages (e.g., "About Us", "Return Policy").

### Architecture Note

- Pages are unique because their URLs must be routed dynamically on the public site (e.g., `/{tenantSlug}/p/{pageSlug}`).
- When creating or saving a page, the `slug` must be URL-safe (lowercase, hyphenated, no special characters).
- If modifying the Page Builder, ensure the content editor supports the required formatting (usually rich text/HTML or a structured JSON format like TipTap/ProseMirror).

---

## Common Gotchas

- **System Blocks vs. Modules:** System blocks are *core* layout components. If a block belongs to a specific *module* (like the POS Menu Grid), it should only render if that module is enabled. The `lib/modules/client-registry.tsx` handles injecting module-specific blocks into the core layout.
- **Link Visibility:** Ensure Link objects have an `isActive` or `isVisible` toggle so tenants can hide links without deleting them. The public component must filter by this flag.
