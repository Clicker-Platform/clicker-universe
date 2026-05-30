# Media Library Stored Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `registerMedia` upload a separate small thumbnail variant alongside the full image, store its URL on `MediaItem.thumbnailUrl`, and have every admin-side consumer (library grid, picker, drawer, gallery form) render the thumbnail instead of the full WebP.

**Architecture:** `registerMedia` already runs in the browser. We add a second resize+upload pass that produces a ~600px-max-edge WebP and write its URL onto the `MediaItem`. The full upload also gets a max-edge cap (1920px) so source-resolution screenshots stop bloating Storage. Legacy items without `thumbnailUrl` keep working via a helper that returns `item.thumbnailUrl ?? item.url`. A one-shot backfill script generates thumbnails for existing items.

**Tech Stack:** Next.js 15 (client components), Firebase Storage, Firestore, Vitest. Browser-side resize via existing `resizeAndConvert` in [lib/imageUtils.ts](clicker-platform-v2/lib/imageUtils.ts).

---

## File Structure

**New files:**
- `clicker-platform-v2/lib/media/thumbnail.ts` — pure helper: `getDisplayThumbnail(item) => item.thumbnailUrl ?? item.url`
- `clicker-platform-v2/scripts/backfill-media-thumbnails.ts` — one-shot Node script to backfill `thumbnailUrl` on existing `mediaLibrary` docs
- `clicker-platform-v2/lib/media/__tests__/thumbnail.test.ts` — unit test for the helper

**Modified files:**
- `clicker-platform-v2/lib/media/types.ts` — add `thumbnailUrl?: string` and `thumbnailStoragePath?: string` to `MediaItem`
- `clicker-platform-v2/lib/media/library.ts` — `registerMedia` does two uploads (full capped at 1920px, thumb at 600px); `deleteMedia` also deletes the thumb Storage object
- `clicker-platform-v2/lib/upload.ts` — extend `UploadOptions` with optional `maxWidth?: number` so we can request a resized upload via the same canonical path
- `clicker-platform-v2/lib/media/__tests__/library.test.ts` — assert the new shape
- `clicker-platform-v2/components/admin/media/MediaItemCard.tsx` — render `thumbnailUrl` fallback
- `clicker-platform-v2/components/admin/media/MediaItemDrawer.tsx` — preview uses full `url` (unchanged) but ensure detail render still works
- `clicker-platform-v2/components/admin/media/MediaPicker.tsx` — `onSelect` payload unchanged (still returns `url`), but library tab cards already benefit via `MediaItemCard`
- `clicker-platform-v2/components/admin/blocks/forms/ImageGalleryBlockForm.tsx` — thumbs render `thumbnailUrl ?? url`

**Also modified (public side):**
- `clicker-platform-v2/components/blocks/public/DefaultImageGalleryBlock.tsx` — grid tiles render `thumbnails[i]` (small), lightbox keeps using `images[i]` (full). Already had a `thumbnails` fallback at line 88–90 from the pre-refactor version; we restore the dual-array path end-to-end.

---

## Self-Review Notes

- Spec coverage: data model change ✓, registerMedia change ✓, helper ✓, consumer updates ✓, backfill ✓, test coverage ✓, delete cleanup ✓.
- Backwards compat: `thumbnailUrl` is optional, helper falls back to `url`; legacy docs render fine.
- Deletion: must delete both Storage objects to avoid orphans (Task 6).

---

### Task 1: Extend `UploadOptions` with `maxWidth`

**Files:**
- Modify: `clicker-platform-v2/lib/upload.ts`

**Why:** `registerMedia` currently uploads at source resolution. We want one canonical upload helper that can optionally resize before encoding, so both full (capped at 1920) and thumb (600) go through the same path.

- [ ] **Step 1: Read existing upload.ts to confirm the surface**

Run: `cat clicker-platform-v2/lib/upload.ts | head -120`
Expected: see `UploadOptions`, `convertImage`, `uploadToStorage`. Confirm `convertImage` draws the full image to a canvas at `naturalWidth`/`naturalHeight`.

- [ ] **Step 2: Add `maxWidth?: number` to `UploadOptions` and thread it into `convertImage`**

Edit `lib/upload.ts`:

```ts
interface UploadOptions {
    file: File;
    folder: string;
    siteId?: string;
    convertToWebP?: boolean;
    webpQuality?: number;
    /** If set, the image is downscaled (preserving aspect) so its longest edge ≤ maxEdge before encoding. Despite the legacy name, both width and height are capped — works for portrait, landscape, and square. */
    maxWidth?: number;
}
```

Update `convertImage` signature:

```ts
async function convertImage(
    file: File,
    quality = 0.85,
    maxWidth?: number,
): Promise<{ blob: Blob; ext: string; contentType: string }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = async () => {
            URL.revokeObjectURL(url);
            // Cap the longest edge (not just width) so portrait images shrink too.
            const longest = Math.max(img.naturalWidth, img.naturalHeight);
            const scale = maxWidth && longest > maxWidth ? maxWidth / longest : 1;
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
            }
            ctx.drawImage(img, 0, 0, w, h);

            const webp = await canvasToBlob(canvas, 'image/webp', quality);
            if (webp) {
                resolve({ blob: webp, ext: 'webp', contentType: 'image/webp' });
                return;
            }

            const avif = await canvasToBlob(canvas, 'image/avif', quality);
            if (avif) {
                resolve({ blob: avif, ext: 'avif', contentType: 'image/avif' });
                return;
            }

            reject(new Error('Browser does not support WebP or AVIF encoding'));
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for conversion'));
        };

        img.src = url;
    });
}
```

In `uploadToStorage`, pass `options.maxWidth` to `convertImage`:

```ts
const { blob, ext, contentType } = await convertImage(file, options.webpQuality, options.maxWidth);
```

- [ ] **Step 3: Run typecheck**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep "upload.ts"`
Expected: no errors referencing `lib/upload.ts`.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/upload.ts
git commit -m "feat(upload): support maxWidth in uploadToStorage"
```

---

### Task 2: Add `thumbnailUrl` to `MediaItem` type

**Files:**
- Modify: `clicker-platform-v2/lib/media/types.ts`

- [ ] **Step 1: Add optional fields**

Edit `lib/media/types.ts`:

```ts
export interface MediaItem {
    id: string;
    url: string;
    storagePath: string;
    /** URL of the small (max-edge ~600px) variant used by admin thumbnails. Falls back to `url` when absent. */
    thumbnailUrl?: string;
    /** Storage path of the thumbnail blob, so deleteMedia can clean it up. */
    thumbnailStoragePath?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    width?: number;
    height?: number;
    folder: string;
    tags: string[];
    uploadedAt: Timestamp;
    uploadedBy: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -E "media/types|MediaItem" | head -5`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/lib/media/types.ts
git commit -m "feat(media): add optional thumbnailUrl + thumbnailStoragePath to MediaItem"
```

---

### Task 3: Helper `getDisplayThumbnail` + test

**Files:**
- Create: `clicker-platform-v2/lib/media/thumbnail.ts`
- Create: `clicker-platform-v2/lib/media/__tests__/thumbnail.test.ts`

- [ ] **Step 1: Write the failing test**

Create `clicker-platform-v2/lib/media/__tests__/thumbnail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getDisplayThumbnail } from '../thumbnail';
import type { MediaItem } from '../types';
import { Timestamp } from 'firebase/firestore';

function makeItem(overrides: Partial<MediaItem>): MediaItem {
    return {
        id: 'm1',
        url: 'https://example/full.webp',
        storagePath: 'sites/s/media/full.webp',
        fileName: 'a.webp',
        mimeType: 'image/webp',
        sizeBytes: 1000,
        folder: 'Uncategorized',
        tags: [],
        uploadedAt: Timestamp.now(),
        uploadedBy: 'u1',
        ...overrides,
    };
}

describe('getDisplayThumbnail', () => {
    it('returns thumbnailUrl when present', () => {
        const item = makeItem({ thumbnailUrl: 'https://example/thumb.webp' });
        expect(getDisplayThumbnail(item)).toBe('https://example/thumb.webp');
    });

    it('falls back to url when thumbnailUrl is absent', () => {
        const item = makeItem({});
        expect(getDisplayThumbnail(item)).toBe('https://example/full.webp');
    });

    it('falls back to url when thumbnailUrl is empty string', () => {
        const item = makeItem({ thumbnailUrl: '' });
        expect(getDisplayThumbnail(item)).toBe('https://example/full.webp');
    });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media/__tests__/thumbnail.test.ts`
Expected: FAIL — cannot find module `../thumbnail`.

- [ ] **Step 3: Implement helper**

Create `clicker-platform-v2/lib/media/thumbnail.ts`:

```ts
import type { MediaItem } from './types';

/**
 * Returns the URL admin surfaces should render for a thumbnail. Prefers the
 * stored small variant but falls back to the full image for legacy items
 * registered before the thumbnail pipeline existed.
 */
export function getDisplayThumbnail(item: Pick<MediaItem, 'url' | 'thumbnailUrl'>): string {
    return item.thumbnailUrl || item.url;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media/__tests__/thumbnail.test.ts`
Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/media/thumbnail.ts clicker-platform-v2/lib/media/__tests__/thumbnail.test.ts
git commit -m "feat(media): add getDisplayThumbnail helper with legacy fallback"
```

---

### Task 4: `registerMedia` uploads full (≤1920px) + thumb (≤600px)

**Files:**
- Modify: `clicker-platform-v2/lib/media/library.ts`
- Modify: `clicker-platform-v2/lib/media/__tests__/library.test.ts`

- [ ] **Step 1: Update test expectations**

Edit `lib/media/__tests__/library.test.ts`. Change the existing `uploadToStorage` mock to return distinct values per call:

```ts
(uploadToStorage as any).mockImplementation(async (opts: { maxWidth?: number }) => {
    if (opts.maxWidth && opts.maxWidth <= 600) {
        return {
            url: 'https://storage.example/sites/s1/media/abc_thumb.webp',
            contentType: 'image/webp',
            sizeBytes: 800,
        };
    }
    return {
        url: 'https://storage.example/sites/s1/media/abc.webp',
        contentType: 'image/webp',
        sizeBytes: 4321,
    };
});
```

In the existing "uploads to Storage and writes a Firestore record with defaults" test, after `await registerMedia(...)`:

```ts
expect(uploadToStorage).toHaveBeenCalledTimes(2);
expect(uploadToStorage).toHaveBeenNthCalledWith(1, expect.objectContaining({ maxWidth: 1920 }));
expect(uploadToStorage).toHaveBeenNthCalledWith(2, expect.objectContaining({ maxWidth: 600 }));

const setDocCall = (setDoc as any).mock.calls[0];
const writtenItem = setDocCall[1];
expect(writtenItem.url).toBe('https://storage.example/sites/s1/media/abc.webp');
expect(writtenItem.thumbnailUrl).toBe('https://storage.example/sites/s1/media/abc_thumb.webp');
expect(writtenItem.thumbnailStoragePath).toContain('abc_thumb.webp');
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media/__tests__/library.test.ts`
Expected: FAIL — `uploadToStorage` called once, `thumbnailUrl` undefined.

- [ ] **Step 3: Implement two-upload `registerMedia`**

Edit `lib/media/library.ts`, replace the body of `registerMedia`:

```ts
export async function registerMedia({
    siteId,
    file,
    folder,
    tags,
    uploadedBy,
}: {
    siteId: string;
    file: File;
    folder?: string;
    tags?: string[];
    uploadedBy: string;
}): Promise<MediaItem> {
    const [full, thumb] = await Promise.all([
        uploadToStorage({ file, folder: 'media', siteId, convertToWebP: true, maxWidth: 1920 }),
        uploadToStorage({ file, folder: 'media', siteId, convertToWebP: true, maxWidth: 600, webpQuality: 0.8 }),
    ]);
    const dims = await readImageDimensions(file);
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    const docRef = doc(colRef);

    const item: MediaItem = {
        id: docRef.id,
        url: full.url,
        storagePath: extractStoragePath(full.url),
        thumbnailUrl: thumb.url,
        thumbnailStoragePath: extractStoragePath(thumb.url),
        fileName: file.name,
        mimeType: full.contentType,
        sizeBytes: full.sizeBytes,
        ...(dims ? { width: dims.width, height: dims.height } : {}),
        folder: folder ?? DEFAULT_FOLDER,
        tags: tags ?? [],
        uploadedAt: Timestamp.now(),
        uploadedBy,
    };

    await setDoc(docRef, item);
    return item;
}
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media/__tests__/library.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/media/library.ts clicker-platform-v2/lib/media/__tests__/library.test.ts
git commit -m "feat(media): registerMedia stores resized full + thumbnail variants"
```

---

### Task 5: `deleteMedia` also deletes thumbnail Storage object

**Files:**
- Modify: `clicker-platform-v2/lib/media/library.ts`
- Modify: `clicker-platform-v2/lib/media/__tests__/library.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `library.test.ts` inside the `deleteMedia` describe block (or create one):

```ts
describe('deleteMedia thumbnail cleanup', () => {
    it('deletes both full and thumbnail Storage objects when both exist', async () => {
        vi.clearAllMocks();
        (getDoc as any).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                id: 'm1',
                url: 'https://example/full.webp',
                storagePath: 'sites/s1/media/full.webp',
                thumbnailUrl: 'https://example/thumb.webp',
                thumbnailStoragePath: 'sites/s1/media/thumb.webp',
                fileName: 'a.webp',
            }),
        });
        // findUsages → no usages
        (getDocs as any).mockResolvedValue({ docs: [] });
        (getDoc as any).mockResolvedValueOnce({ exists: () => false });

        await deleteMedia('s1', 'm1');

        expect(deleteObject).toHaveBeenCalledTimes(2);
        expect(deleteDoc).toHaveBeenCalledTimes(1);
    });

    it('still deletes when thumbnailStoragePath is missing (legacy items)', async () => {
        vi.clearAllMocks();
        (getDoc as any).mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
                id: 'm1',
                url: 'https://example/full.webp',
                storagePath: 'sites/s1/media/full.webp',
                fileName: 'a.webp',
            }),
        });
        (getDocs as any).mockResolvedValue({ docs: [] });
        (getDoc as any).mockResolvedValueOnce({ exists: () => false });

        await deleteMedia('s1', 'm1');

        expect(deleteObject).toHaveBeenCalledTimes(1);
        expect(deleteDoc).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media/__tests__/library.test.ts -t "thumbnail cleanup"`
Expected: FAIL — `deleteObject` called once, not twice.

- [ ] **Step 3: Implement**

Edit `lib/media/library.ts` in `deleteMedia`. Replace:

```ts
    await deleteObject(storageRef(storage, item.storagePath)).catch(() => {
        // Storage object may already be gone — non-fatal
    });
```

with:

```ts
    const paths = [item.storagePath, item.thumbnailStoragePath].filter(
        (p): p is string => typeof p === 'string' && p.length > 0,
    );
    await Promise.all(
        paths.map(p =>
            deleteObject(storageRef(storage, p)).catch(() => {
                // Storage object may already be gone — non-fatal
            }),
        ),
    );
```

- [ ] **Step 4: Run to confirm pass**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media/__tests__/library.test.ts`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/media/library.ts clicker-platform-v2/lib/media/__tests__/library.test.ts
git commit -m "feat(media): deleteMedia removes thumbnail storage object too"
```

---

### Task 6: Update admin consumers to use `getDisplayThumbnail`

**Files:**
- Modify: `clicker-platform-v2/components/admin/media/MediaItemCard.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/forms/ImageGalleryBlockForm.tsx`

`MediaItemDrawer.tsx` intentionally keeps `item.url` for the preview (drawer shows full detail). `MediaPicker` doesn't render images itself.

- [ ] **Step 1: Update `MediaItemCard`**

Edit `components/admin/media/MediaItemCard.tsx`. At top:

```tsx
import { getDisplayThumbnail } from '@/lib/media/thumbnail';
```

Replace the `<img src={item.url}` line with:

```tsx
<img
    src={getDisplayThumbnail(item)}
```

- [ ] **Step 2: Update gallery form thumbs**

Edit `components/admin/blocks/forms/ImageGalleryBlockForm.tsx`. The form only has the picked URL, not the `MediaItem`. Since the picker already returns the full URL (so we don't break legacy non-library picks like the URL tab), we keep it as-is. **Skip this file** — the gallery form's blur is solved by the public block tuning later, and stored thumbs will benefit the library grid which is what the user was looking at.

Document this decision inline by adding a one-line comment above the picker render:

```tsx
// Picker returns the full url; thumbnail variants live on the MediaItem in the library.
// Future: extend onSelect to surface item.thumbnailUrl so this form can render thumbs too.
```

- [ ] **Step 3: Typecheck**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -E "MediaItemCard|ImageGalleryBlockForm" | head -5`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/media/MediaItemCard.tsx \
        clicker-platform-v2/components/admin/blocks/forms/ImageGalleryBlockForm.tsx
git commit -m "feat(media): library cards render stored thumbnails when available"
```

---

### Task 7: Extend `MediaPicker.onSelect` to surface `thumbnailUrl`

**Files:**
- Modify: `clicker-platform-v2/components/admin/media/MediaPicker.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/forms/ImageGalleryBlockForm.tsx`

**Why:** The gallery form needs `thumbnailUrl` to render sharp thumbs in its own grid. The picker already returns `{ url, item }` — `item` carries `thumbnailUrl` for library/upload picks. We update the gallery form to capture and store both URLs.

- [ ] **Step 1: Update gallery form data shape**

Edit `components/admin/blocks/forms/ImageGalleryBlockForm.tsx`. Reintroduce the `thumbnails` array (each index pairs with `images`):

```tsx
interface ImageGalleryBlockFormProps {
    data: {
        images?: string[];
        thumbnails?: string[];
        coverImage?: string;
    };
    onChange: (data: any) => void;
}
```

Update `handleSelect` signature and logic:

```tsx
const handleSelect = (url: string, thumbnailUrl?: string) => {
    if (images.length >= MAX_IMAGES) return;
    const newImages = [...images, url];
    const newThumbs = [...(safeData.thumbnails || []), thumbnailUrl || url];
    onChange({
        ...safeData,
        images: newImages,
        thumbnails: newThumbs,
        coverImage: coverImage || (thumbnailUrl || url),
    });
};
```

Update `removeImage` to keep arrays in sync:

```tsx
const removeImage = (index: number) => {
    const removed = images[index];
    const newImages = images.filter((_, i) => i !== index);
    const newThumbs = (safeData.thumbnails || []).filter((_, i) => i !== index);
    const newCover = coverImage === removed || coverImage === (safeData.thumbnails || [])[index]
        ? (newThumbs[0] || newImages[0] || '')
        : coverImage;
    onChange({ ...safeData, images: newImages, thumbnails: newThumbs, coverImage: newCover });
};
```

Update `setCover` to prefer thumbnail URL:

```tsx
const setCover = (index: number) => {
    const thumbs = safeData.thumbnails || [];
    onChange({ ...safeData, coverImage: thumbs[index] || images[index] });
};
```

Update `isCover` to check against either URL:

```tsx
const isCover = (index: number) => {
    const thumbs = safeData.thumbnails || [];
    return coverImage === images[index] || coverImage === thumbs[index];
};
```

Update the `<Image>` render to use the thumbnail:

```tsx
<Image
    src={(safeData.thumbnails || [])[index] || url}
    alt={`Gallery ${index + 1}`}
    fill
    sizes="(max-width: 640px) 50vw, 200px"
    className="object-cover transition-transform duration-500 group-hover:scale-110"
/>
```

Update the `<MediaPicker onSelect>`:

```tsx
<MediaPicker
    open={pickerOpen}
    onClose={() => setPickerOpen(false)}
    onSelect={({ url, item }) => { handleSelect(url, item?.thumbnailUrl); setPickerOpen(false); }}
    accept="image"
/>
```

Remove the placeholder comment from Task 6.

- [ ] **Step 2: Typecheck**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep "ImageGalleryBlockForm" | head -5`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev: `cd clicker-platform-v2 && pnpm dev` (port 3000)
- Open a page with an image gallery block in Canvas Studio
- Click "Add Image" → Upload tab → pick a large screenshot (>1920px wide)
- Confirm the thumb in the form grid is sharp
- Confirm the cover badge still works
- Confirm remove works
- Open Firestore console → `sites/{siteId}/mediaLibrary` → newest doc has both `url` and `thumbnailUrl`

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/ImageGalleryBlockForm.tsx
git commit -m "feat(gallery-form): use library thumbnailUrl for in-form thumbs"
```

---

### Task 8: Backfill script for existing `mediaLibrary` items

**Files:**
- Create: `clicker-platform-v2/scripts/backfill-media-thumbnails.ts`

**Why:** All items registered before this change lack `thumbnailUrl`. Helper handles fallback, but for sites with large libraries we want sharp thumbs now. Script runs server-side via firebase-admin: downloads each full image, generates a 600px WebP via `sharp`, uploads it, patches the Firestore doc.

- [ ] **Step 1: Confirm sharp is available**

Run: `cd clicker-platform-v2 && grep '"sharp"' package.json`
Expected: sharp listed as a dep (it's in `serverExternalPackages` per next.config).

- [ ] **Step 2: Write the script**

Create `clicker-platform-v2/scripts/backfill-media-thumbnails.ts`:

```ts
#!/usr/bin/env tsx
/**
 * Backfill thumbnailUrl + thumbnailStoragePath on existing mediaLibrary records.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-media-thumbnails.ts <siteId>
 *   pnpm tsx scripts/backfill-media-thumbnails.ts --all
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or a service account file at the
 * usual location. Pulls each full image via its Storage path, resizes via
 * sharp, uploads alongside as `<basename>_thumb.webp`, and patches the doc.
 */
import { initializeApp, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import sharp from 'sharp';

if (!getApps().length) {
    initializeApp({ credential: applicationDefault() });
}

const THUMB_MAX_WIDTH = 600;
const THUMB_QUALITY = 80;

interface MediaItemDoc {
    id: string;
    url: string;
    storagePath: string;
    thumbnailUrl?: string;
    thumbnailStoragePath?: string;
    fileName: string;
    mimeType: string;
}

async function processSite(siteId: string): Promise<{ processed: number; skipped: number; failed: number }> {
    const db = getFirestore();
    const bucket = getStorage().bucket();
    const colRef = db.collection('sites').doc(siteId).collection('mediaLibrary');
    const snap = await colRef.get();

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const doc of snap.docs) {
        const item = doc.data() as MediaItemDoc;
        if (item.thumbnailUrl) {
            skipped++;
            continue;
        }
        if (!item.mimeType?.startsWith('image/') || item.mimeType === 'image/svg+xml') {
            skipped++;
            continue;
        }

        try {
            const file = bucket.file(item.storagePath);
            const [buffer] = await file.download();
            const thumb = await sharp(buffer)
                // Fit inside a THUMB_MAX_WIDTH × THUMB_MAX_WIDTH box, preserving aspect.
                // Caps the longest edge regardless of orientation.
                .resize({ width: THUMB_MAX_WIDTH, height: THUMB_MAX_WIDTH, fit: 'inside', withoutEnlargement: true })
                .webp({ quality: THUMB_QUALITY })
                .toBuffer();

            const thumbPath = item.storagePath.replace(/\.([^.]+)$/, '_thumb.webp');
            const thumbFile = bucket.file(thumbPath);
            await thumbFile.save(thumb, { contentType: 'image/webp' });
            await thumbFile.makePublic().catch(() => undefined);
            const [signedUrl] = await thumbFile.getSignedUrl({ action: 'read', expires: '2099-01-01' });

            await doc.ref.update({
                thumbnailUrl: signedUrl,
                thumbnailStoragePath: thumbPath,
            });
            processed++;
            console.log(`✓ ${siteId}/${item.id} (${item.fileName})`);
        } catch (err) {
            failed++;
            console.error(`✗ ${siteId}/${item.id}:`, err);
        }
    }
    return { processed, skipped, failed };
}

async function main() {
    const arg = process.argv[2];
    if (!arg) {
        console.error('Usage: tsx backfill-media-thumbnails.ts <siteId> | --all');
        process.exit(1);
    }

    const db = getFirestore();
    const siteIds = arg === '--all'
        ? (await db.collection('sites').listDocuments()).map(d => d.id)
        : [arg];

    let totals = { processed: 0, skipped: 0, failed: 0 };
    for (const siteId of siteIds) {
        console.log(`\n── Site: ${siteId} ──`);
        const r = await processSite(siteId);
        totals.processed += r.processed;
        totals.skipped += r.skipped;
        totals.failed += r.failed;
    }
    console.log(`\nDone. processed=${totals.processed} skipped=${totals.skipped} failed=${totals.failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 3: Smoke-run against staging (dry first if user has a staging tenant)**

Run: `cd clicker-platform-v2 && pnpm tsx scripts/backfill-media-thumbnails.ts <test-siteId>`
Expected: output shows ✓ for each item; Firestore docs gain `thumbnailUrl` + `thumbnailStoragePath`.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/scripts/backfill-media-thumbnails.ts
git commit -m "feat(media): add backfill script for legacy items missing thumbnailUrl"
```

---

### Task 9: Public gallery block renders thumbs in grid, full image in lightbox

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultImageGalleryBlock.tsx`

**Why:** The public site's gallery currently renders `images[]` (full-resolution) in the grid tiles, which is the same root cause as the admin blur — Next's optimizer downscales a huge source into a small tile. We want grid tiles to render `thumbnails[]` (small, sharp) and the `FullScreenGallery` lightbox to keep using `images[]` (full quality on tap). The block already has a correct fallback at lines 88–90 — we just need to make sure it kicks in when both arrays are populated.

- [ ] **Step 1: Verify the existing fallback shape**

Run: `grep -n "thumbnails\|images" clicker-platform-v2/components/blocks/public/DefaultImageGalleryBlock.tsx | head -20`
Expected: see the existing `Array.isArray(data.thumbnails) && data.thumbnails.length === images.length` fallback. Confirm `thumbnails` is what the grid maps over (line ~146) and `images` is what's passed to `FullScreenGallery` (line ~161).

- [ ] **Step 2: Tighten the grid tile sizes hint**

Edit `components/blocks/public/DefaultImageGalleryBlock.tsx`. The current `sizes="(max-width: 768px) 100vw, 240px"` underspecifies desktop width. The 2-column grid renders tiles at roughly half the container width. Replace with:

```tsx
sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 400px"
```

(Both occurrences if there's more than one; otherwise just the one in `GalleryTile`.)

- [ ] **Step 3: Confirm grid render uses the `thumbnails` array**

Inspect the desktop grid block (around line 142–157). The map already uses `thumbnails.map((thumb, idx) => ...)` and passes `thumb` as `src`. This is correct — it picks up the stored `thumbnailUrl` from the gallery form via the `thumbnails[]` array. No code change needed here, but verify by reading the file.

- [ ] **Step 4: Manual smoke test on the public site**

Open a public page rendering a gallery block. Confirm:
- Grid tiles look sharp (no fuzzy text on screenshots)
- Clicking a tile opens the lightbox at full resolution (no quality drop)
- Network tab: grid tiles request ~400–640w AVIF variants (not the full source)
- For galleries saved before Task 7 (legacy with no `thumbnails`), grid falls back to `images` and still renders — just less sharp

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultImageGalleryBlock.tsx
git commit -m "fix(gallery-block): tighten sizes hint so grid tiles request appropriate variant"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run all media-related tests**

Run: `cd clicker-platform-v2 && pnpm vitest run lib/media components/admin/media`
Expected: all passing, no regressions.

- [ ] **Step 2: Run typecheck**

Run: `cd clicker-platform-v2 && pnpm tsc --noEmit 2>&1 | grep -E "lib/media|components/admin/media|ImageGalleryBlockForm|upload.ts"`
Expected: no errors in any of the touched files.

- [ ] **Step 3: Manual end-to-end smoke**

- Upload a new image via the Media Library page
- Confirm the card thumb is sharp
- Open the picker from a block → Library tab → see same sharp thumbs
- Add an image to a gallery block → confirm in-form thumb sharp
- Delete the new media item → confirm both Storage objects removed (Firebase console)

- [ ] **Step 4: Optional — push and PR**

```bash
git push -u origin <branch>
gh pr create --title "feat(media): stored thumbnail variants" --body "..."
```
