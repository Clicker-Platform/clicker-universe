---
name: file_upload
description: >
  Work with file and image uploads in the Clicker Platform.
  Use this skill whenever adding a new feature that requires uploading files or images to
  Firebase Storage — even if the user doesn't say "upload" explicitly. Trigger on: "upload image",
  "upload file", "add image upload", "profile photo", "product image", "gallery upload",
  "store image", "save to storage", "Firebase Storage", "uploadBytes", "uploadToStorage",
  "MultiImageUpload", "ProductImageUpload", "BlockImageUploader", "MediaPicker", "media library",
  or any new admin form or block that needs to accept user-provided images or files.
---

# File Upload — Clicker Platform

There are TWO canonical upload paths. **Pick the right one based on context:**

- **Canvas Studio blocks, Tiptap, general site content** (Pages, Links, Forms, business profile) → use **`<MediaPicker>`**. Uploads land in the `mediaLibrary` Firestore index and become reusable across blocks (Canva-style gallery).
- **Module-owned assets** (POS products, AI marketing, inventory, service records, avatars) → use **`uploadToStorage`** directly. Module assets stay scoped to the module and are NOT part of the shared library.
- **Other one-off uploads** (form attachments, avatars, etc.) → use **`uploadToStorage`** directly. The library is image-only and v1 doesn't cover these surfaces.

Never write inline Firebase Storage upload logic (`uploadBytes` / `getDownloadURL` directly).

---

## Path A — `<MediaPicker>` (Canvas-side uploads)

Three-tab modal: **Library | Upload | URL**. Upload tab writes both Storage AND a `mediaLibrary` Firestore record so the file becomes browseable from every other block. URL tab passes a raw URL through without indexing.

```tsx
import { MediaPicker } from '@/components/admin/media/MediaPicker';

const [pickerOpen, setPickerOpen] = useState(false);

<button onClick={() => setPickerOpen(true)}>Pick image</button>

<MediaPicker
    open={pickerOpen}
    onClose={() => setPickerOpen(false)}
    onSelect={({ url, item }) => {
        // url is the only required thing.
        // item is a full MediaItem when the user picked from Library or just uploaded;
        // undefined when they pasted a URL.
        onChange(url);
        setPickerOpen(false);
    }}
    accept="image"              // currently only 'image' supported
    initialFolder="heroes"      // optional, defaults to all folders
/>
```

Render `<MediaPicker>` at the component root, NOT inside a conditional branch — so the modal stays mounted across mode changes. See `BackgroundMediaEditor.tsx` for the pattern.

### Library plumbing (advanced)

If you need to interact with the library without the modal UI, use the API directly:

```ts
import {
    registerMedia,         // upload + write Firestore record
    listMedia,             // read with optional folder/tag/search filters
    updateMedia,           // rename / change folder / edit tags (whitelist-typed via MediaPatch)
    deleteMedia,           // hard delete with usage-aware safety check
    findUsages,            // on-demand scan of pages/links/forms/business for a URL
    importExistingMedia,   // backfill Storage → Firestore for already-uploaded files
    reconcileMediaSizes,   // background fix-up for items with stale sizeBytes
    MediaInUseError,
} from '@/lib/media/library';
```

Spec: `superpowers/specs/2026-05-12-canvas-media-library-design.md`
Data model: `sites/{siteId}/mediaLibrary/{id}` — see `lib/media/types.ts`

---

## Path B — `uploadToStorage` (module / one-off uploads)

**`lib/upload.ts` → `uploadToStorage(options)`** for everything outside the library.

```typescript
import { uploadToStorage } from '@/lib/upload';

const { url, contentType, sizeBytes } = await uploadToStorage({
    file,           // File object from input or drop
    folder,         // Storage folder name, e.g. 'products', 'avatars', 'blocks'
    siteId,         // From useSite() — scopes the path to sites/{siteId}/{folder}/
    // Optional:
    convertToWebP,  // default: true — convert image to WebP/AVIF before upload
    webpQuality,    // default: 0.85
});
```

**Important:** `uploadToStorage` returns `{ url, contentType, sizeBytes }`, NOT a bare string. The `contentType` and `sizeBytes` reflect the *post-conversion* blob (the WebP/AVIF that actually went into Storage), not the source file. If you only need the URL, destructure it: `const { url } = await uploadToStorage(...)`.

### What it does automatically

- **Converts images to WebP** via browser Canvas API before upload
- **Falls back to AVIF** if the browser doesn't produce a true WebP blob
- **Throws** if neither WebP nor AVIF is supported
- **Skips conversion for GIFs**
- Sets the correct `contentType` on the Storage object

### Storage paths

- With `siteId`: `sites/{siteId}/{folder}/{timestamp}_{random}.{ext}`
- Without `siteId` (platform-level): `{folder}/{timestamp}_{random}.{ext}`

### When to opt out of conversion

Pass `convertToWebP: false` only when:

- Uploading **SVGs** (canvas rasterization defeats the format)
- Uploading **GIFs** (already skipped automatically, but explicit opt-out is fine)
- Lottie JSON or other non-image data

Do NOT opt out for product images, gallery images, avatars, banners, or anything that renders in `<img>` or `next/image`.

---

## Existing Upload Components

### Library-aware (Path A)

- **`MediaPicker`** (`components/admin/media/`) — direct integration anywhere you need to pick or upload an image.
- **`MediaField`** (`components/admin/blocks/media-field/`) — block forms; full media slot with aspect/fit/alt controls; opens MediaPicker on the Image tab.
- **`BlockImageUploader`** (`components/admin/blocks/`) — block forms; single-image slot; opens MediaPicker internally.
- **`BackgroundMediaEditor`** (`components/admin/blocks/`) — page background editor; opens MediaPicker for image mode.
- **Rich-text `Toolbar`** (`components/admin/blocks/rich-text/`) — Tiptap inline image insert.

### Storage-direct (Path B)

- **`MultiImageUpload`** — product galleries (POS); drag-drop, 10-image limit, cover/reorder.
- **`ProductImageUpload`** — single product cover image.
- **`CompactImageUpload`** — module-scoped single-image slot, smaller chrome.
- **`AvatarUpload`** — profile photos.
- **`FormFileField`** — form submissions accepting file uploads.
- **ai-marketing `AssetUploadModal`** — the ai-marketing module's own asset collection (separate from `mediaLibrary`).

---

## Adding a New Upload Feature — Decision Tree

```text
Is this uploading an image that an editor will pick/reuse from a gallery?
├── YES → Use <MediaPicker> (Path A)
└── NO  → Use uploadToStorage (Path B)
         ├── Is it a product/inventory/POS image?  → folder: 'products' (or module-specific)
         ├── Is it an avatar?                       → folder: 'profile'
         ├── Is it a form attachment?               → folder: 'form-uploads'
         └── Otherwise                              → pick a descriptive lowercase slug
```

### Minimal example — Path A (library-aware)

```tsx
import { MediaPicker } from '@/components/admin/media/MediaPicker';
import { useState } from 'react';

function MyBlockForm({ value, onChange }) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button onClick={() => setOpen(true)}>{value ? 'Change' : 'Upload'} image</button>
            <MediaPicker
                open={open}
                onClose={() => setOpen(false)}
                onSelect={({ url }) => { onChange(url); setOpen(false); }}
                accept="image"
            />
        </>
    );
}
```

### Minimal example — Path B (one-off)

```tsx
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';

const { siteId } = useSite();

const handleFile = async (file: File) => {
    setUploading(true);
    try {
        const { url } = await uploadToStorage({ file, folder: 'avatars', siteId });
        onUpload(url);
    } catch (err: any) {
        setError(err.message || 'Upload failed');
    } finally {
        setUploading(false);
    }
};
```

---

## What NOT to do

```typescript
// ❌ Never do this — bypasses WebP conversion AND library indexing
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
const storageRef = ref(storage, `products/${file.name}`);
await uploadBytes(storageRef, file);
const url = await getDownloadURL(storageRef);

// ❌ Never do this — old return shape, will silently set url=undefined
const url = await uploadToStorage({ /* ... */ });

// ❌ Never do this for a Canvas-Studio-side upload — bypasses the library so the file
// can't be reused from other blocks
const { url } = await uploadToStorage({ file, folder: 'blocks', siteId });
// Use <MediaPicker> instead

// ✅ Correct one-off
const { url } = await uploadToStorage({ file, folder: 'products', siteId });
```

```tsx
// ✅ Correct Canvas-side (library-aware)
<MediaPicker open={open} onClose={...} onSelect={({ url }) => { /* ... */ }} accept="image" />
```

---

## Multi-tenancy & permissions

- **Always pass `siteId`** from `useSite()`. Never hardcode tenant IDs.
- Guard the picker against sentinel siteIds (`'platform'`, `'default'`, `'pending'`) — these appear briefly during the TokenBootstrap handoff, and Firestore rules correctly reject reads against them. See `MediaPanel.tsx` and `MediaPicker.tsx` for the existing pattern.
- `mediaLibrary` Firestore rule: read by any valid site user, write by site owner. Surface a `canEdit()` check in the UI for non-owner staff if needed.
- Storage rules at `sites/{siteId}/media/**` should be reviewed when adding new tenant-scoped upload paths.
