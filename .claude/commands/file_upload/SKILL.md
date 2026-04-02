---
name: file_upload
description: >
  Work with file and image uploads in the Clicker Platform.
  Use this skill whenever adding a new feature that requires uploading files or images to
  Firebase Storage — even if the user doesn't say "upload" explicitly. Trigger on: "upload image",
  "upload file", "add image upload", "profile photo", "product image", "gallery upload",
  "store image", "save to storage", "Firebase Storage", "uploadBytes", "uploadToStorage",
  "MultiImageUpload", "ProductImageUpload", "BlockImageUploader", or any new admin form or
  block that needs to accept user-provided images or files.
---

# File Upload — Clicker Platform

All file/image uploads must go through the shared utility in `lib/upload.ts`. Never write inline Firebase Storage upload logic.

---

## The Upload Utility

**`lib/upload.ts` → `uploadToStorage(options)`** is the single entry point for all uploads.

```typescript
import { uploadToStorage } from '@/lib/upload';

const url = await uploadToStorage({
    file,           // File object from input or drop
    folder,         // Storage folder name, e.g. 'products', 'avatars', 'blocks'
    siteId,         // From useSite() — scopes the path to sites/{siteId}/{folder}/
    // Optional:
    convertToWebP,  // default: true — convert image to WebP/AVIF before upload
    webpQuality,    // default: 0.85
});
```

### What it does automatically
- **Converts images to WebP** via browser Canvas API before upload
- **Falls back to AVIF** if the browser doesn't produce a true WebP blob (Chrome often outputs AVIF as it's smaller)
- **Throws** if neither WebP nor AVIF is supported — no silent fallback to original PNG/JPEG (file size control is strict)
- **Skips conversion for GIFs** — converting GIFs would lose animation
- Sets the correct `contentType` on the Firebase Storage object to match the actual encoded format

### Storage paths
- With `siteId`: `sites/{siteId}/{folder}/{timestamp}_{random}.{ext}`
- Without `siteId` (platform-level): `{folder}/{timestamp}_{random}.{ext}`

---

## When to opt out of conversion

Pass `convertToWebP: false` only when:
- Uploading **SVGs** (vector format, canvas rasterizes them — defeats the purpose)
- Uploading **GIFs** (already skipped automatically, but explicit opt-out is fine for clarity)
- The feature explicitly requires preserving the original format for non-display reasons

Do **not** opt out for product images, gallery images, avatars, banners, or any image that will be displayed in `<img>` or `next/image`.

---

## Existing Upload Components

Reuse these before building something new:

### `components/admin/MultiImageUpload.tsx`
Multi-image uploader with drag-and-drop, 10-image limit, cover/reorder, shimmer previews. Used for product galleries. Calls `uploadToStorage` internally.

```tsx
<MultiImageUpload
    images={images}           // string[] of URLs
    onImagesChange={setImages}
    maxImages={10}
/>
```

### `components/admin/ProductImageUpload.tsx`
Single image uploader with drag-and-drop, remove button. Used for single product cover images. Calls `uploadToStorage` internally.

```tsx
<ProductImageUpload
    currentImageUrl={imageUrl}
    onUpload={(url) => setImageUrl(url)}
    onRemove={() => setImageUrl('')}
/>
```

### `components/admin/blocks/BlockImageUploader.tsx`
Single image uploader scoped to the canvas block editor. Use this inside block property forms.

---

## Adding a New Upload Feature

1. **Pick the right folder name** — use a descriptive, lowercase slug: `'products'`, `'avatars'`, `'banners'`, `'blocks'`, `'services'`, etc.
2. **Get `siteId`** from `useSite()` — always scope uploads to the site.
3. **Call `uploadToStorage`** — never call `uploadBytes` / `getDownloadURL` directly.
4. **Handle the error** — `uploadToStorage` throws if conversion fails. Show a user-facing error message.
5. **Reuse existing components** if the UI pattern matches — don't rebuild MultiImageUpload from scratch.

### Minimal example
```tsx
import { uploadToStorage } from '@/lib/upload';
import { useSite } from '@/lib/site-context';

const { siteId } = useSite();

const handleFile = async (file: File) => {
    setUploading(true);
    try {
        const url = await uploadToStorage({ file, folder: 'banners', siteId });
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
// ❌ Never do this — bypasses WebP/AVIF conversion and file size control
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
const storageRef = ref(storage, `products/${file.name}`);
await uploadBytes(storageRef, file);
const url = await getDownloadURL(storageRef);
```

```typescript
// ✅ Always do this instead
const url = await uploadToStorage({ file, folder: 'products', siteId });
```
