# Canvas Media Library — Design Spec

**Date:** 2026-05-12 (design) · **Shipped:** 2026-05-20
**Status:** Shipped on `dev` (see "Shipped notes" at bottom for as-built deltas)
**Owner:** Canvas Studio / Platform Core
**Skills:** `/file_upload` (canonical entry point), `/canvas_studio` (block-side surfaces)

## Purpose

A Canva-style media library that indexes Canvas Studio and general-site uploads into a browsable, taggable, reusable gallery. The goal is **visibility into uploaded media so users can reuse instead of re-uploading**.

Today every uploader (`MediaField`, `BlockImageUploader`, `BackgroundMediaEditor`, Tiptap image, etc.) calls `uploadToStorage()` directly and stores only the resulting URL on the block. There is no index, no way to browse past uploads, and no way to delete safely.

## Scope

**In scope (v1):**

- Canvas Studio block uploaders: `MediaField`, `BlockImageUploader`, `BackgroundMediaEditor`, Tiptap image embeds inside blocks.
- General site content: Pages/Links editors, Forms (admin-side uploads), Inbox attachments, business profile/logo.
- Images only.

**Out of scope (v1):**

- POS product images and other module-owned assets (inventory, service-records, etc.).
- ai-marketing's existing `assets` collection — keeps its own gallery for now.
- Usage-count badges live in the grid.
- Multi-level / nested folders.
- Background orphan-cleanup jobs.
- Storage path consolidation across uploaders.
- Video / Lottie in the library (`MediaField` still accepts video URLs directly via the URL tab).
- Auto alt-text, dominant color, AI-suggested tags.

## Data Model

Firestore: `sites/{siteId}/mediaLibrary/{mediaId}`

```ts
interface MediaItem {
  id: string;
  url: string;            // Firebase Storage download URL
  storagePath: string;    // for deletion: ref(storage, storagePath)
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  width?: number;         // images only
  height?: number;
  folder: string;         // single-level; defaults to "uncategorized"
  tags: string[];
  uploadedAt: Timestamp;
  uploadedBy: string;     // uid
}
```

Notes:

- Folder is a flat string field, not a path. Single-level hierarchy.
- No `usedIn` field — usage is computed on demand via `findUsages`.
- No soft-delete. Deletes are hard (with usage check).
- Storage paths are **unchanged** from current uploader behavior. The library is purely a Firestore metadata layer over whatever paths existing uploaders already produce.

## Components

### `<MediaPicker>` — primary picker surface

Location: `components/admin/media/MediaPicker.tsx`

Modal with three tabs:

- **Library** (default) — `<MediaLibraryGrid>` with folder dropdown, tag filter, filename search.
- **Upload** — drop zone; on file drop runs `registerMedia()` and auto-selects the new item.
- **URL** — paste an external URL (no Storage write, no Firestore record).

Props:

```ts
interface MediaPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (result: { url: string; item?: MediaItem }) => void;
  accept?: 'image' | 'all';   // default 'image'
  initialFolder?: string;
}
```

Returns a URL on confirm (plus the `MediaItem` if it came from the library/upload tabs).

### `<MediaLibraryGrid>` — reusable grid

Location: `components/admin/media/MediaLibraryGrid.tsx`

Presentational grid of thumbnails with filter controls. Used by both `<MediaPicker>`'s Library tab and the standalone `/admin/media` page.

### `/admin/media` — management page

Location: `app/admin/(dashboard)/media/page.tsx`

Full-screen management view:

- `<MediaLibraryGrid>` with multi-select.
- Bulk actions: delete, move to folder, edit tags.
- Single-item drawer: rename, edit tags, change folder.
- **Upload** button (opens the same upload flow as the picker's Upload tab).
- **Import existing files** button (runs `importExistingMedia`).

### Navigation placement

- Top-level **"Media"** entry in the admin sidebar, in the content cluster (near Pages, Links, Forms, Inbox). Registered as core nav (not a module), alongside Pages and Links.
- Route: `/admin/media`.

### Canvas Studio quick access

Canvas Studio gets a **"Media"** button in its toolbar that opens a slide-over panel reusing `<MediaLibraryGrid>` in browse mode:

- Read-only browse (folder dropdown, tag filter, search).
- Click an item → copy URL to clipboard (toast confirmation).
- If a block with a media field is currently selected → "Insert into selected block" action becomes available.
- A "Manage library" link inside the slide-over deep-links to `/admin/media` (new tab) for rename/delete/import.

The slide-over follows the existing `LeftSidebarPanels` / `SlideOverPanel` pattern in Canvas Studio. It does NOT replace `<MediaPicker>` — pickers still open from individual block fields. The slide-over is for "I want to see what I have while I'm editing."

## API Surface

Location: `lib/media/library.ts`

```ts
registerMedia({ siteId, file, folder?, tags? }): Promise<MediaItem>
// Wraps uploadToStorage + Firestore write. Replaces direct uploadToStorage
// in retrofitted call sites.

listMedia({ siteId, folder?, tag?, search? }): Promise<MediaItem[]>

updateMedia(siteId: string, id: string, patch: Partial<MediaItem>): Promise<void>

findUsages(siteId: string, url: string): Promise<MediaUsage[]>
// Scans pages, links, forms, business profile for the URL substring.
// Returns [{ type, id, label, location }].

deleteMedia(siteId: string, id: string, options?: { force?: boolean }): Promise<void>
// Runs findUsages; throws MediaInUseError with the usage list unless
// force=true. On success deletes Storage object + Firestore doc.

importExistingMedia(siteId: string): Promise<{ imported: number; skipped: number }>
// Scans Storage sites/{siteId}/** for images, cross-references findUsages,
// writes Firestore records for referenced files with folder: "Imported".
// Skips orphan Storage files (no references found).
```

```ts
interface MediaUsage {
  type: 'page' | 'link' | 'form' | 'business';
  id: string;
  label: string;       // human-readable, e.g. "Page: Home"
  location: string;    // e.g. "Hero block", "Background"
}

class MediaInUseError extends Error {
  usages: MediaUsage[];
}
```

## Flows

### Upload via a block (e.g., `MediaField`)

1. User clicks image slot → `<MediaPicker>` opens on Library tab.
2. User picks an existing item → `onSelect({ url, item })` fires → block updated.
3. *Or* user switches to Upload tab, drops a file → `registerMedia()` runs (`uploadToStorage` + Firestore write) → newly created item is auto-selected → `onSelect` fires.
4. *Or* user switches to URL tab, pastes a URL → `onSelect({ url })` (no library record created).

### Delete from `/admin/media`

1. User selects items, clicks Delete.
2. `findUsages` runs for each.
3. If no usages → confirm → `deleteMedia(force: false)` → Storage + Firestore deletion.
4. If usages found → modal lists them grouped by item ("hero.jpg is used on: Page 'Home' (hero block), Form 'Contact' (background)") with two actions: **Cancel** or **Force delete (will break these references)**.

### Import existing files

1. User clicks "Import existing files" on `/admin/media`.
2. Scan: list Storage at `sites/{siteId}/`, filter image MIME types, cross-check `findUsages` for each.
3. For referenced files: create Firestore record with `folder: "Imported"`, `fileName` from path stem, `tags: []`.
4. Skip unreferenced (orphan) Storage files — they are not imported.
5. Toast: "Imported N files, skipped M orphans."

## Retrofit Checklist

Replace direct `uploadToStorage` calls with `<MediaPicker>` (UI) or `registerMedia` (headless):

- `components/admin/blocks/media-field/MediaField.tsx`
- `components/admin/blocks/BlockImageUploader.tsx`
- `components/admin/blocks/BackgroundMediaEditor.tsx`
- Tiptap image extension in `components/admin/blocks/rich-text/`
- Pages editor file uploads (`app/admin/(dashboard)/pages/`)
- Links editor file uploads (`app/admin/(dashboard)/links/`)
- Forms admin uploads (`app/admin/(dashboard)/forms/`) — only admin-side; end-user submitted attachments are out of scope
- Business profile / logo upload (`app/admin/(dashboard)/business/`)

Non-retrofitted (explicitly skipped, keep current behavior):

- ai-marketing `AssetUploadModal`
- POS product image uploads
- Module-owned uploaders (inventory, service-records, etc.)

## Security & Multi-tenancy

- All Firestore reads/writes scoped under `sites/{siteId}/mediaLibrary/...` — `siteId` from `useSite()`.
- `canEdit()` RBAC check before every write (create, update, delete, import).
- `findUsages` queries are scoped to the active `siteId` collections only.

## Non-functional notes

- `findUsages` performs a full read of `pages`, `links`, `forms`, and `business` docs for the tenant. For SME tenants (~dozens of pages) this is acceptable latency for delete actions. Not acceptable for live badges — hence usage is on-demand only.
- `importExistingMedia` is one-shot per click; expect 5–30s on a long-tenured tenant. Show a progress indicator.

## Open questions

None blocking. Future iterations may revisit:

- Live usage badges (requires a derived index or scheduled rollup).
- Multi-level folder hierarchy.
- Storage path consolidation under `sites/{siteId}/media/`.
- Folding ai-marketing's gallery into the unified library.
- Background orphan-cleanup job.
- Video / Lottie support.

---

## Shipped notes (as-built deltas, 2026-05-20)

The v1 implementation matches the spec above except for these refinements that surfaced during build and review. Future maintainers should trust this section over the design body when they conflict.

**API shape changes:**

- `uploadToStorage` (in `lib/upload.ts`) now returns `{ url, contentType, sizeBytes }`, not a bare string. All callers updated. Required so `registerMedia` could record the actual stored content type (WebP after conversion) and the actual stored blob size (not the source PNG/JPEG size).
- `updateMedia(siteId, id, patch)` accepts a whitelist `MediaPatch = Partial<Pick<MediaItem, 'fileName' | 'folder' | 'tags'>>` instead of `Partial<MediaItem>`, so callers can't accidentally overwrite immutable identity fields.
- `MediaInUseError` re-exported from both `@/lib/media/types` and `@/lib/media/library` (kept the re-export; the original plan said to drop it).
- New: `reconcileMediaSizes(siteId, items)` — background fix-up function for historical items with stale `sizeBytes` (see post-launch fixes below).

**Behavior changes:**

- `findUsages` scans the **full page document**, not just `data.blocks`. Some templates store media at root (`coverImage`, etc.) and the original blocks-only scan silently missed them.
- Business profile path is `sites/{siteId}/content/business`, NOT `settings/business` as the original plan said.
- `DEFAULT_FOLDER = 'Uncategorized'` (title-case) to match `IMPORTED_FOLDER = 'Imported'`.
- `importExistingMedia` dedupes by `storagePath` so re-running the import doesn't double-write Firestore records.
- All media reads guard against sentinel siteIds (`'platform'`, `'default'`, `'pending'`) before calling `listMedia`, to avoid Firestore rule rejections during the brief TokenBootstrap handoff window.

**UI changes vs wireframe:**

- Delete button lives **inside** `MediaItemDrawer`'s footer (left-aligned, opposite Cancel/Save), not floating beside the drawer. Original `right-[420px]` floating position overflowed on narrow viewports.
- `MediaItemDrawer` includes a read-only **Metadata** section (Dimensions, Size, Type, Uploaded, By) below the editable fields — wireframe showed this; original implementation omitted it.
- `MediaPicker` modal shows "Could not load media." as its grid empty-state when a load failed, distinguishing failure from genuinely empty library.

**Post-launch fixes worth knowing:**

- `reconcileMediaSizes` runs once-per-session in the background on `/admin/media` page load, fetching real Storage object sizes via `getMetadata` and patching any Firestore records that overstate them. Added because items uploaded before the `sizeBytes` fix were carrying inflated source-file sizes; this self-heals them without a user-facing button.
- Firestore rules for `mediaLibrary` (read by valid site user, write by site owner) were deployed to `clicker-universe-stagging` — must be deployed separately to production before the feature works there.

**Storage paths — important caveat:**

Per the spec, paths were intentionally NOT consolidated. `registerMedia` uploads to `sites/{siteId}/media/`, but historical uploads from before this work live at `uploads/content/`, `blocks/`, `assets/`, `content-showcase/`, `products/`, etc. `importExistingMedia` only scans `sites/{siteId}/media/`, so historical images do NOT appear in the library — they keep rendering on existing pages but aren't browseable. Tenants populate the library organically as they edit pages going forward. Broadening the import scan to walk all `sites/{siteId}/` subfolders is the natural follow-up if a tenant complains.

**Out of v1 (deferred to follow-ups):**

- Drag-to-block from the slide-over (see project memory `project_media_library_future.md`).
- "Use this image in…" placement flow from `/admin/media`.
- Bulk apply (one image → many blocks).
- Pages/Links/Forms standalone editor retrofits + business profile logo retrofit (only block uploaders + Tiptap were retrofitted in v1).
- Focus trap + ESC handler on `MediaPicker` / `MediaUsageModal`.
- Storage rules audit at `sites/{siteId}/media/**`.
