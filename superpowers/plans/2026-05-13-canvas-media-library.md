# Canvas Media Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Canva-style media library that indexes Canvas Studio and general-site image uploads into a browsable, taggable, reusable gallery so users stop re-uploading the same files.

**Architecture:** A Firestore metadata layer (`sites/{siteId}/mediaLibrary/{id}`) over the existing `uploadToStorage()` Storage paths. A reusable `<MediaPicker>` modal becomes the new entry point for every retrofitted uploader (Library / Upload / URL tabs). A standalone `/admin/media` page manages the collection. Canvas Studio gets a slide-over panel reusing the same grid for in-flow browsing. Deletion runs an on-demand `findUsages()` scan across pages/links/forms/business docs.

**Tech Stack:** Next.js 15 (app router), React 19, Firebase (client SDK for Storage + Firestore reads/writes), Vitest, Tailwind, existing `uploadToStorage()` helper in `lib/upload.ts`.

**Spec:** `superpowers/specs/2026-05-12-canvas-media-library-design.md`

---

## File Structure

**New files (clicker-platform-v2/):**
- `lib/media/library.ts` — typed API surface: `registerMedia`, `listMedia`, `updateMedia`, `findUsages`, `deleteMedia`, `importExistingMedia`, plus `MediaInUseError`.
- `lib/media/types.ts` — `MediaItem`, `MediaUsage` interfaces.
- `lib/media/__tests__/library.test.ts` — unit tests with Firestore mocked.
- `lib/media/__tests__/findUsages.test.ts` — usage-scan unit tests.
- `components/admin/media/MediaPicker.tsx` — three-tab modal (Library | Upload | URL).
- `components/admin/media/MediaLibraryGrid.tsx` — presentational grid + filter controls.
- `components/admin/media/MediaItemCard.tsx` — single thumbnail card.
- `components/admin/media/MediaUsageModal.tsx` — "where is this used" dialog for delete.
- `components/admin/media/MediaItemDrawer.tsx` — single-item rename/tag/folder editor.
- `components/admin/media/__tests__/MediaLibraryGrid.test.tsx` — component test.
- `components/admin/blocks/panels/MediaPanel.tsx` — Canvas Studio slide-over.
- `app/admin/(dashboard)/media/page.tsx` — management page.

**Modified files:**
- `firestore.rules` — add `mediaLibrary` collection rule.
- `app/admin/(dashboard)/AdminSidebar.tsx:155-161` — register "Media" Core item.
- `components/admin/blocks/CanvasStudio.tsx` — register MediaPanel + toolbar button.
- `components/admin/blocks/media-field/MediaField.tsx` — replace direct `uploadToStorage` with `<MediaPicker>`.
- `components/admin/blocks/BlockImageUploader.tsx` — replace direct upload with `<MediaPicker>`.
- `components/admin/blocks/BackgroundMediaEditor.tsx` — replace direct upload with `<MediaPicker>`.
- Tiptap image extension (path TBD per task) — invoke `<MediaPicker>` on insert.

---

## Conventions

- **Test runner:** `pnpm test` (Vitest). Single test: `pnpm test -- path/to/file.test.ts`.
- **Lint:** `pnpm lint`.
- **Multi-tenancy:** Every Firestore op scoped by `siteId` from `useSite()`. Server-side helpers take `siteId` as the first arg.
- **RBAC:** Wrap writes with `canEdit()` checks inside React components (consistent with existing pattern). The `lib/media/library.ts` module itself is unguarded — guards live at call sites.
- **Storage paths unchanged:** `registerMedia` continues to call `uploadToStorage({ folder: 'media' })`. The `folder` *concept* in `MediaItem` is purely a metadata field.
- **Commit cadence:** Commit after each task. Use Conventional Commits prefix `feat(media):`, `test(media):`, etc.

---

## Task 1: Types and module scaffolding

**Files:**
- Create: `lib/media/types.ts`
- Create: `lib/media/library.ts` (stubs only)
- Test: (none yet — pure types)

- [ ] **Step 1: Create the types file**

`lib/media/types.ts`:
```ts
import { Timestamp } from 'firebase/firestore';

export interface MediaItem {
    id: string;
    url: string;
    storagePath: string;
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

export type MediaUsageType = 'page' | 'link' | 'form' | 'business';

export interface MediaUsage {
    type: MediaUsageType;
    id: string;
    label: string;
    location: string;
}

export class MediaInUseError extends Error {
    usages: MediaUsage[];
    constructor(usages: MediaUsage[]) {
        super(`Media item is in use (${usages.length} reference${usages.length === 1 ? '' : 's'})`);
        this.name = 'MediaInUseError';
        this.usages = usages;
    }
}

export const DEFAULT_FOLDER = 'Uncategorized';
export const IMPORTED_FOLDER = 'Imported';
```

- [ ] **Step 2: Create the library stub file**

`lib/media/library.ts`:
```ts
import type { MediaItem, MediaUsage } from './types';

export async function registerMedia(_args: {
    siteId: string;
    file: File;
    folder?: string;
    tags?: string[];
    uploadedBy: string;
}): Promise<MediaItem> {
    throw new Error('not implemented');
}

export async function listMedia(_args: {
    siteId: string;
    folder?: string;
    tag?: string;
    search?: string;
}): Promise<MediaItem[]> {
    throw new Error('not implemented');
}

export async function updateMedia(_siteId: string, _id: string, _patch: Partial<MediaItem>): Promise<void> {
    throw new Error('not implemented');
}

export async function findUsages(_siteId: string, _url: string): Promise<MediaUsage[]> {
    throw new Error('not implemented');
}

export async function deleteMedia(_siteId: string, _id: string, _options?: { force?: boolean }): Promise<void> {
    throw new Error('not implemented');
}

export async function importExistingMedia(_siteId: string, _uploadedBy: string): Promise<{ imported: number; skipped: number }> {
    throw new Error('not implemented');
}

export { MediaInUseError } from './types';
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `pnpm lint`
Expected: PASS (no errors in `lib/media/`).

- [ ] **Step 4: Commit**

```bash
git add lib/media/types.ts lib/media/library.ts
git commit -m "feat(media): scaffold media library types and API stubs"
```

---

## Task 2: `registerMedia` — upload + index a new item

**Files:**
- Modify: `lib/media/library.ts`
- Test: `lib/media/__tests__/library.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/media/__tests__/library.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/upload', () => ({
    uploadToStorage: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({
    db: {},
    storage: {},
}));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, ..._segs) => ({ _segs })),
    doc: vi.fn(() => ({ id: 'mock-id-123' })),
    setDoc: vi.fn(async () => undefined),
    getDocs: vi.fn(),
    getDoc: vi.fn(),
    query: vi.fn((..._a) => _a),
    where: vi.fn((..._a) => _a),
    orderBy: vi.fn((..._a) => _a),
    deleteDoc: vi.fn(async () => undefined),
    updateDoc: vi.fn(async () => undefined),
    serverTimestamp: vi.fn(() => 'mock-ts'),
    Timestamp: { now: () => 'mock-ts' },
}));

import { registerMedia } from '../library';
import { uploadToStorage } from '@/lib/upload';
import { setDoc } from 'firebase/firestore';

describe('registerMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (uploadToStorage as any).mockResolvedValue('https://storage.example/sites/s1/media/abc.webp');
    });

    it('uploads to Storage and writes a Firestore record with defaults', async () => {
        const file = new File([new Uint8Array([1, 2, 3])], 'hero.png', { type: 'image/png' });
        Object.defineProperty(file, 'size', { value: 12345 });

        const item = await registerMedia({
            siteId: 's1',
            file,
            uploadedBy: 'user-1',
        });

        expect(uploadToStorage).toHaveBeenCalledWith(expect.objectContaining({
            file,
            folder: 'media',
            siteId: 's1',
        }));
        expect(setDoc).toHaveBeenCalledTimes(1);
        expect(item.url).toBe('https://storage.example/sites/s1/media/abc.webp');
        expect(item.folder).toBe('Uncategorized');
        expect(item.tags).toEqual([]);
        expect(item.fileName).toBe('hero.png');
        expect(item.uploadedBy).toBe('user-1');
    });

    it('applies provided folder and tags', async () => {
        const file = new File([new Uint8Array([1])], 'h.png', { type: 'image/png' });
        const item = await registerMedia({
            siteId: 's1',
            file,
            folder: 'heroes',
            tags: ['hero', 'banner'],
            uploadedBy: 'user-1',
        });

        expect(item.folder).toBe('heroes');
        expect(item.tags).toEqual(['hero', 'banner']);
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement `registerMedia`**

Replace the `registerMedia` stub in `lib/media/library.ts`:
```ts
import { db } from '@/lib/firebase';
import { uploadToStorage } from '@/lib/upload';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import type { MediaItem } from './types';
import { DEFAULT_FOLDER } from './types';

function extractStoragePath(url: string): string {
    // Firebase Storage download URLs look like:
    // https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<ENCODED_PATH>?alt=media&token=...
    const match = url.match(/\/o\/([^?]+)/);
    return match ? decodeURIComponent(match[1]) : url;
}

async function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    if (!file.type.startsWith('image/') || typeof window === 'undefined') return null;
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
            URL.revokeObjectURL(url);
        };
        img.onerror = () => {
            resolve(null);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    });
}

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
    const url = await uploadToStorage({ file, folder: 'media', siteId, convertToWebP: true });
    const dims = await readImageDimensions(file);
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    const docRef = doc(colRef);

    const item: MediaItem = {
        id: docRef.id,
        url,
        storagePath: extractStoragePath(url),
        fileName: file.name,
        mimeType: file.type || 'image/webp',
        sizeBytes: file.size,
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

Also remove the `MediaInUseError` re-export line at the bottom of `library.ts` (it's already exported from `types.ts` and we'll add direct usage when needed) — keep imports clean.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: PASS (both `registerMedia` tests).

- [ ] **Step 5: Commit**

```bash
git add lib/media/library.ts lib/media/__tests__/library.test.ts
git commit -m "feat(media): implement registerMedia with Storage upload and Firestore index"
```

---

## Task 3: `listMedia` and `updateMedia`

**Files:**
- Modify: `lib/media/library.ts`
- Test: `lib/media/__tests__/library.test.ts`

- [ ] **Step 1: Append the failing tests**

Append to `lib/media/__tests__/library.test.ts`:
```ts
import { listMedia, updateMedia } from '../library';
import { getDocs, updateDoc } from 'firebase/firestore';

describe('listMedia', () => {
    it('returns items ordered by uploadedAt desc', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'b', data: () => ({ id: 'b', fileName: 'b.png', folder: 'Uncategorized', tags: [] }) },
                { id: 'a', data: () => ({ id: 'a', fileName: 'a.png', folder: 'heroes', tags: ['hero'] }) },
            ],
        });
        const items = await listMedia({ siteId: 's1' });
        expect(items.map(i => i.id)).toEqual(['b', 'a']);
    });

    it('filters by folder client-side when folder provided', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'a', data: () => ({ id: 'a', folder: 'heroes', tags: [], fileName: 'a' }) },
                { id: 'b', data: () => ({ id: 'b', folder: 'Uncategorized', tags: [], fileName: 'b' }) },
            ],
        });
        const items = await listMedia({ siteId: 's1', folder: 'heroes' });
        expect(items.map(i => i.id)).toEqual(['a']);
    });

    it('filters by tag', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'a', data: () => ({ id: 'a', folder: 'f', tags: ['hero'], fileName: 'a' }) },
                { id: 'b', data: () => ({ id: 'b', folder: 'f', tags: ['team'], fileName: 'b' }) },
            ],
        });
        const items = await listMedia({ siteId: 's1', tag: 'hero' });
        expect(items.map(i => i.id)).toEqual(['a']);
    });

    it('filters by case-insensitive filename substring', async () => {
        (getDocs as any).mockResolvedValue({
            docs: [
                { id: 'a', data: () => ({ id: 'a', folder: 'f', tags: [], fileName: 'Hero-2024.png' }) },
                { id: 'b', data: () => ({ id: 'b', folder: 'f', tags: [], fileName: 'logo.png' }) },
            ],
        });
        const items = await listMedia({ siteId: 's1', search: 'hero' });
        expect(items.map(i => i.id)).toEqual(['a']);
    });
});

describe('updateMedia', () => {
    it('calls updateDoc with the given patch', async () => {
        await updateMedia('s1', 'item-1', { folder: 'new', tags: ['a'] });
        expect(updateDoc).toHaveBeenCalledTimes(1);
        const args = (updateDoc as any).mock.calls[0];
        expect(args[1]).toEqual({ folder: 'new', tags: ['a'] });
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement `listMedia` and `updateMedia`**

Replace the `listMedia` and `updateMedia` stubs in `lib/media/library.ts`:
```ts
import {
    collection, doc, setDoc, getDocs, updateDoc,
    query, orderBy, Timestamp,
} from 'firebase/firestore';

// (keep existing imports + registerMedia + helpers above)

export async function listMedia({
    siteId,
    folder,
    tag,
    search,
}: {
    siteId: string;
    folder?: string;
    tag?: string;
    search?: string;
}): Promise<MediaItem[]> {
    const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
    const snap = await getDocs(query(colRef, orderBy('uploadedAt', 'desc')));
    let items = snap.docs.map(d => d.data() as MediaItem);

    if (folder) items = items.filter(i => i.folder === folder);
    if (tag) items = items.filter(i => i.tags.includes(tag));
    if (search) {
        const needle = search.toLowerCase();
        items = items.filter(i => i.fileName.toLowerCase().includes(needle));
    }
    return items;
}

export async function updateMedia(siteId: string, id: string, patch: Partial<MediaItem>): Promise<void> {
    const ref = doc(db, 'sites', siteId, 'mediaLibrary', id);
    await updateDoc(ref, patch as any);
}
```

Note: the `orderBy` in the mock setup ignores ordering — tests rely on the snapshot mock returning items in the order they should appear. Confirm test expectations match what mocks return.

- [ ] **Step 4: Run tests**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/media/library.ts lib/media/__tests__/library.test.ts
git commit -m "feat(media): implement listMedia (with folder/tag/search filters) and updateMedia"
```

---

## Task 4: `findUsages` — scan pages/links/forms/business for URL references

**Files:**
- Modify: `lib/media/library.ts`
- Test: `lib/media/__tests__/findUsages.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/media/__tests__/findUsages.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
    collection: vi.fn((_db, ..._s) => ({ _s })),
    doc: vi.fn((_db, ..._s) => ({ _s })),
    getDoc: vi.fn(),
    getDocs: vi.fn(),
}));

import { findUsages } from '../library';
import { getDocs, getDoc } from 'firebase/firestore';

describe('findUsages', () => {
    beforeEach(() => vi.clearAllMocks());

    const url = 'https://storage.example/o/sites%2Fs1%2Fmedia%2Fhero.webp';

    function mockCollection(docs: { id: string; data: any }[]) {
        return { docs: docs.map(d => ({ id: d.id, data: () => d.data })) };
    }

    it('finds URL inside page blocks JSON', async () => {
        (getDocs as any)
            // pages
            .mockResolvedValueOnce(mockCollection([
                { id: 'home', data: { name: 'Home', blocks: [{ type: 'hero', props: { src: url } }] } },
                { id: 'about', data: { name: 'About', blocks: [] } },
            ]))
            // links
            .mockResolvedValueOnce(mockCollection([]))
            // forms
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'page', id: 'home', label: 'Page: Home' }),
        ]);
    });

    it('finds URL inside link items', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([
                { id: 'link-1', data: { title: 'Instagram', icon: url } },
            ]))
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'link', id: 'link-1', label: 'Link: Instagram' }),
        ]);
    });

    it('finds URL inside form schema JSON', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([
                { id: 'contact', data: { name: 'Contact Us', schema: { background: url } } },
            ]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'form', id: 'contact', label: 'Form: Contact Us' }),
        ]);
    });

    it('finds URL in business profile doc', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({
            exists: () => true,
            id: 'business',
            data: () => ({ logo: url, name: 'Acme' }),
        });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([
            expect.objectContaining({ type: 'business', label: 'Business profile' }),
        ]);
    });

    it('returns empty array when URL is not referenced anywhere', async () => {
        (getDocs as any)
            .mockResolvedValueOnce(mockCollection([{ id: 'p', data: { name: 'P', blocks: [{ type: 'text' }] } }]))
            .mockResolvedValueOnce(mockCollection([]))
            .mockResolvedValueOnce(mockCollection([]));
        (getDoc as any).mockResolvedValue({ exists: () => false });

        const usages = await findUsages('s1', url);
        expect(usages).toEqual([]);
    });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `pnpm test -- lib/media/__tests__/findUsages.test.ts`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement `findUsages`**

In `lib/media/library.ts` replace the `findUsages` stub:
```ts
import { getDoc } from 'firebase/firestore';
import type { MediaUsage } from './types';

function containsUrl(value: unknown, url: string): boolean {
    return JSON.stringify(value ?? '').includes(url);
}

export async function findUsages(siteId: string, url: string): Promise<MediaUsage[]> {
    const usages: MediaUsage[] = [];

    // Pages
    const pagesSnap = await getDocs(collection(db, 'sites', siteId, 'pages'));
    for (const d of pagesSnap.docs) {
        const data = d.data() as any;
        if (containsUrl(data.blocks, url)) {
            usages.push({
                type: 'page',
                id: d.id,
                label: `Page: ${data.name || data.title || d.id}`,
                location: 'Page blocks',
            });
        }
    }

    // Links
    const linksSnap = await getDocs(collection(db, 'sites', siteId, 'links'));
    for (const d of linksSnap.docs) {
        const data = d.data() as any;
        if (containsUrl(data, url)) {
            usages.push({
                type: 'link',
                id: d.id,
                label: `Link: ${data.title || data.label || d.id}`,
                location: 'Link properties',
            });
        }
    }

    // Forms
    const formsSnap = await getDocs(collection(db, 'sites', siteId, 'forms'));
    for (const d of formsSnap.docs) {
        const data = d.data() as any;
        if (containsUrl(data, url)) {
            usages.push({
                type: 'form',
                id: d.id,
                label: `Form: ${data.name || data.title || d.id}`,
                location: 'Form schema',
            });
        }
    }

    // Business profile (single doc at settings/business)
    const bizSnap = await getDoc(doc(db, 'sites', siteId, 'settings', 'business'));
    if (bizSnap.exists() && containsUrl(bizSnap.data(), url)) {
        usages.push({
            type: 'business',
            id: 'business',
            label: 'Business profile',
            location: 'Profile fields',
        });
    }

    return usages;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- lib/media/__tests__/findUsages.test.ts`
Expected: PASS (all 5 tests).

- [ ] **Step 5: Verify collection names match actual codebase**

Run: `grep -rln "collection(db, 'sites', siteId, 'pages')\|collection(db, 'sites', siteId, 'links')\|collection(db, 'sites', siteId, 'forms')" lib/ app/ components/ 2>/dev/null | head -5`
Expected: matches found confirming `pages`, `links`, `forms` are the actual collection names. If not, adjust paths in `findUsages` and update tests.

- [ ] **Step 6: Commit**

```bash
git add lib/media/library.ts lib/media/__tests__/findUsages.test.ts
git commit -m "feat(media): implement findUsages cross-collection scan"
```

---

## Task 5: `deleteMedia` — usage-aware deletion

**Files:**
- Modify: `lib/media/library.ts`
- Test: `lib/media/__tests__/library.test.ts`

- [ ] **Step 1: Append failing tests**

Append to `lib/media/__tests__/library.test.ts`:
```ts
import { deleteMedia, MediaInUseError } from '../library';
import { deleteDoc, getDoc as fsGetDoc } from 'firebase/firestore';

vi.mock('firebase/storage', () => ({
    ref: vi.fn(),
    deleteObject: vi.fn(async () => undefined),
}));

import { deleteObject } from 'firebase/storage';

describe('deleteMedia', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: getDoc returns the media item
        (fsGetDoc as any).mockResolvedValue({
            exists: () => true,
            data: () => ({
                id: 'item-1',
                url: 'https://example/url',
                storagePath: 'sites/s1/media/file.webp',
            }),
        });
        (getDocs as any).mockResolvedValue({ docs: [] });
    });

    it('deletes Firestore doc and Storage object when no usages', async () => {
        await deleteMedia('s1', 'item-1');
        expect(deleteDoc).toHaveBeenCalledTimes(1);
        expect(deleteObject).toHaveBeenCalledTimes(1);
    });

    it('throws MediaInUseError when usages found and force is not set', async () => {
        (getDocs as any).mockResolvedValueOnce({
            docs: [{ id: 'home', data: () => ({ name: 'Home', blocks: [{ src: 'https://example/url' }] }) }],
        }).mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
        (fsGetDoc as any)
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ id: 'item-1', url: 'https://example/url', storagePath: 'sites/s1/media/file.webp' }),
            })
            .mockResolvedValueOnce({ exists: () => false }); // business doc

        await expect(deleteMedia('s1', 'item-1')).rejects.toBeInstanceOf(MediaInUseError);
        expect(deleteDoc).not.toHaveBeenCalled();
    });

    it('force-deletes despite usages when force=true', async () => {
        (getDocs as any).mockResolvedValueOnce({
            docs: [{ id: 'home', data: () => ({ name: 'Home', blocks: [{ src: 'https://example/url' }] }) }],
        }).mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({ docs: [] });
        (fsGetDoc as any)
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({ id: 'item-1', url: 'https://example/url', storagePath: 'sites/s1/media/file.webp' }),
            })
            .mockResolvedValueOnce({ exists: () => false });

        await deleteMedia('s1', 'item-1', { force: true });
        expect(deleteDoc).toHaveBeenCalledTimes(1);
        expect(deleteObject).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement `deleteMedia`**

In `lib/media/library.ts`:
```ts
import { storage } from '@/lib/firebase';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { deleteDoc } from 'firebase/firestore';
import { MediaInUseError } from './types';

export async function deleteMedia(
    siteId: string,
    id: string,
    options?: { force?: boolean },
): Promise<void> {
    const ref = doc(db, 'sites', siteId, 'mediaLibrary', id);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const item = snap.data() as MediaItem;

    if (!options?.force) {
        const usages = await findUsages(siteId, item.url);
        if (usages.length > 0) throw new MediaInUseError(usages);
    }

    await deleteObject(storageRef(storage, item.storagePath)).catch(() => {
        // Storage object may already be gone — non-fatal
    });
    await deleteDoc(ref);
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/media/library.ts lib/media/__tests__/library.test.ts
git commit -m "feat(media): implement deleteMedia with usage check and force option"
```

---

## Task 6: `importExistingMedia` — backfill from Storage

**Files:**
- Modify: `lib/media/library.ts`
- Test: `lib/media/__tests__/library.test.ts`

- [ ] **Step 1: Append failing test**

```ts
import { importExistingMedia } from '../library';
import { ref as storageRefMock } from 'firebase/storage';

vi.mock('firebase/storage', async () => {
    const actual = await vi.importActual<any>('firebase/storage');
    return {
        ...actual,
        ref: vi.fn(() => ({})),
        deleteObject: vi.fn(async () => undefined),
        listAll: vi.fn(),
        getDownloadURL: vi.fn(),
        getMetadata: vi.fn(),
    };
});

import { listAll, getDownloadURL, getMetadata } from 'firebase/storage';

describe('importExistingMedia', () => {
    beforeEach(() => vi.clearAllMocks());

    it('imports only Storage files that are referenced in pages/links/forms/business', async () => {
        (listAll as any).mockResolvedValue({
            items: [
                { fullPath: 'sites/s1/media/used.webp', name: 'used.webp' },
                { fullPath: 'sites/s1/media/orphan.webp', name: 'orphan.webp' },
            ],
            prefixes: [],
        });
        (getDownloadURL as any)
            .mockResolvedValueOnce('https://example/used')
            .mockResolvedValueOnce('https://example/orphan');
        (getMetadata as any)
            .mockResolvedValueOnce({ contentType: 'image/webp', size: 1000, name: 'used.webp' })
            .mockResolvedValueOnce({ contentType: 'image/webp', size: 1000, name: 'orphan.webp' });
        // findUsages: used.webp has 1 page hit, orphan.webp has none
        (getDocs as any)
            // First findUsages call: pages
            .mockResolvedValueOnce({ docs: [{ id: 'home', data: () => ({ name: 'Home', blocks: [{ src: 'https://example/used' }] }) }] })
            // links, forms
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] })
            // Second findUsages call: pages
            .mockResolvedValueOnce({ docs: [{ id: 'home', data: () => ({ name: 'Home', blocks: [{ src: 'https://example/used' }] }) }] })
            .mockResolvedValueOnce({ docs: [] })
            .mockResolvedValueOnce({ docs: [] });
        (fsGetDoc as any).mockResolvedValue({ exists: () => false }); // business never matches

        const result = await importExistingMedia('s1', 'user-1');
        expect(result).toEqual({ imported: 1, skipped: 1 });
        expect(setDoc).toHaveBeenCalledTimes(1);
    });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: FAIL with `not implemented`.

- [ ] **Step 3: Implement `importExistingMedia`**

In `lib/media/library.ts`:
```ts
import { listAll, getDownloadURL, getMetadata } from 'firebase/storage';
import { IMPORTED_FOLDER } from './types';

const IMAGE_MIMES = new Set(['image/webp', 'image/avif', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']);

export async function importExistingMedia(
    siteId: string,
    uploadedBy: string,
): Promise<{ imported: number; skipped: number }> {
    const root = storageRef(storage, `sites/${siteId}/media`);
    let listing;
    try {
        listing = await listAll(root);
    } catch {
        return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;
    for (const obj of listing.items) {
        const [meta, url] = await Promise.all([getMetadata(obj), getDownloadURL(obj)]);
        if (!meta.contentType || !IMAGE_MIMES.has(meta.contentType)) {
            skipped++;
            continue;
        }
        const usages = await findUsages(siteId, url);
        if (usages.length === 0) {
            skipped++;
            continue;
        }
        const colRef = collection(db, 'sites', siteId, 'mediaLibrary');
        const docRef = doc(colRef);
        const item: MediaItem = {
            id: docRef.id,
            url,
            storagePath: obj.fullPath,
            fileName: obj.name,
            mimeType: meta.contentType,
            sizeBytes: meta.size ?? 0,
            folder: IMPORTED_FOLDER,
            tags: [],
            uploadedAt: Timestamp.now(),
            uploadedBy,
        };
        await setDoc(docRef, item);
        imported++;
    }
    return { imported, skipped };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test -- lib/media/__tests__/library.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/media/library.ts lib/media/__tests__/library.test.ts
git commit -m "feat(media): implement importExistingMedia backfill scan"
```

---

## Task 7: Firestore rules for `mediaLibrary`

**Files:**
- Modify: `firestore.rules`

- [ ] **Step 1: Add the rule block**

In `firestore.rules`, inside the `match /sites/{siteId} { ... }` block (locate by `grep -n "match /sites/{siteId}" firestore.rules`), add immediately after the existing `match /settings/{settingId}` block:

```
// MEDIA LIBRARY (Canvas/Site uploads)
match /mediaLibrary/{mediaId} {
    allow read: if isValidUser(siteId);
    allow create, update, delete: if isValidUser(siteId) && isOwner(siteId);
}
```

- [ ] **Step 2: Validate rules syntax**

Run: `npx firebase emulators:start --only firestore --project demo 2>&1 | head -30` (or simply `pnpm lint` if rules linting is integrated).
Expected: no rules parse errors. If the emulator boots and reports "Loaded firestore rules" without error, that's success — stop the emulator.

Note: if `isOwner` doesn't exist in the rules file, substitute the role check used by the existing `settings` rule. Grep `firestore.rules` for `isOwner\|hasRole` to confirm.

- [ ] **Step 3: Commit**

```bash
git add firestore.rules
git commit -m "feat(media): allow mediaLibrary collection in firestore rules"
```

---

## Task 8: `<MediaItemCard>` component

**Files:**
- Create: `components/admin/media/MediaItemCard.tsx`

- [ ] **Step 1: Implement the card**

`components/admin/media/MediaItemCard.tsx`:
```tsx
'use client';

import Image from 'next/image';
import type { MediaItem } from '@/lib/media/types';

interface Props {
    item: MediaItem;
    selected?: boolean;
    onClick?: () => void;
}

export function MediaItemCard({ item, selected, onClick }: Props) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`group relative aspect-square overflow-hidden rounded-lg border bg-white dark:bg-neutral-900 transition-colors ${
                selected ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-gray-200 dark:border-neutral-800 hover:border-blue-400'
            }`}
        >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={item.url}
                alt={item.fileName}
                className="h-full w-full object-cover"
                loading="lazy"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                <div className="truncate">{item.fileName}</div>
                {item.width && item.height && (
                    <div className="text-white/70">{item.width} × {item.height}</div>
                )}
            </div>
        </button>
    );
}
```

(Using raw `<img>` rather than `next/image` because library URLs are arbitrary external Firebase Storage URLs and `next/image` requires domain configuration; keeping the existing project pattern.)

- [ ] **Step 2: Commit**

```bash
git add components/admin/media/MediaItemCard.tsx
git commit -m "feat(media): add MediaItemCard thumbnail component"
```

---

## Task 9: `<MediaLibraryGrid>` with filters

**Files:**
- Create: `components/admin/media/MediaLibraryGrid.tsx`
- Test: `components/admin/media/__tests__/MediaLibraryGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

`components/admin/media/__tests__/MediaLibraryGrid.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaLibraryGrid } from '../MediaLibraryGrid';
import type { MediaItem } from '@/lib/media/types';
import { Timestamp } from 'firebase/firestore';

vi.mock('firebase/firestore', () => ({
    Timestamp: { now: () => ({ toMillis: () => 0 }) },
}));

function mkItem(over: Partial<MediaItem>): MediaItem {
    return {
        id: 'i', url: 'https://x/i', storagePath: 'p', fileName: 'i.png',
        mimeType: 'image/png', sizeBytes: 0, folder: 'Uncategorized', tags: [],
        uploadedAt: ({ toMillis: () => 0 } as any),
        uploadedBy: 'u',
        ...over,
    };
}

describe('MediaLibraryGrid', () => {
    it('renders items and calls onSelect when a card is clicked', () => {
        const onSelect = vi.fn();
        const items = [mkItem({ id: 'a', fileName: 'a.png' }), mkItem({ id: 'b', fileName: 'b.png' })];
        render(<MediaLibraryGrid items={items} onSelect={onSelect} />);
        const btn = screen.getAllByRole('button').find(b => b.querySelector('img')?.getAttribute('alt') === 'a.png');
        fireEvent.click(btn!);
        expect(onSelect).toHaveBeenCalledWith(items[0]);
    });

    it('filters by search input', () => {
        const items = [mkItem({ id: 'a', fileName: 'hero.png' }), mkItem({ id: 'b', fileName: 'logo.png' })];
        render(<MediaLibraryGrid items={items} onSelect={() => {}} />);
        fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'hero' } });
        expect(screen.queryByAltText('logo.png')).toBeNull();
        expect(screen.getByAltText('hero.png')).toBeTruthy();
    });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `pnpm test -- components/admin/media/__tests__/MediaLibraryGrid.test.tsx`
Expected: FAIL with "module not found".

- [ ] **Step 3: Implement the grid**

`components/admin/media/MediaLibraryGrid.tsx`:
```tsx
'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { MediaItem } from '@/lib/media/types';
import { MediaItemCard } from './MediaItemCard';

interface Props {
    items: MediaItem[];
    onSelect: (item: MediaItem) => void;
    selectedId?: string;
    emptyMessage?: string;
}

export function MediaLibraryGrid({ items, onSelect, selectedId, emptyMessage }: Props) {
    const [search, setSearch] = useState('');
    const [folder, setFolder] = useState<string>('');
    const [tag, setTag] = useState<string>('');

    const folders = useMemo(() => Array.from(new Set(items.map(i => i.folder))).sort(), [items]);
    const tags = useMemo(() => Array.from(new Set(items.flatMap(i => i.tags))).sort(), [items]);

    const filtered = useMemo(() => {
        return items.filter(i => {
            if (folder && i.folder !== folder) return false;
            if (tag && !i.tags.includes(tag)) return false;
            if (search && !i.fileName.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [items, folder, tag, search]);

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-neutral-800">
                <div className="relative flex-1">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                    <input
                        type="text"
                        placeholder="Search filename…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                    />
                </div>
                <select value={folder} onChange={(e) => setFolder(e.target.value)} className="text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-1.5">
                    <option value="">All folders</option>
                    {folders.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <select value={tag} onChange={(e) => setTag(e.target.value)} className="text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-2 py-1.5">
                    <option value="">All tags</option>
                    {tags.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
                {filtered.length === 0 ? (
                    <div className="text-center text-sm text-neutral-500 py-8">
                        {emptyMessage || 'No media yet. Upload to get started.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                        {filtered.map(item => (
                            <MediaItemCard
                                key={item.id}
                                item={item}
                                selected={selectedId === item.id}
                                onClick={() => onSelect(item)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test -- components/admin/media/__tests__/MediaLibraryGrid.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/media/MediaLibraryGrid.tsx components/admin/media/__tests__/MediaLibraryGrid.test.tsx
git commit -m "feat(media): add MediaLibraryGrid with search/folder/tag filters"
```

---

## Task 10: `<MediaPicker>` — three-tab modal

**Files:**
- Create: `components/admin/media/MediaPicker.tsx`

- [ ] **Step 1: Implement the modal**

`components/admin/media/MediaPicker.tsx`:
```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Upload as UploadIcon, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { registerMedia, listMedia } from '@/lib/media/library';
import type { MediaItem } from '@/lib/media/types';
import { MediaLibraryGrid } from './MediaLibraryGrid';

interface MediaPickerProps {
    open: boolean;
    onClose: () => void;
    onSelect: (result: { url: string; item?: MediaItem }) => void;
    accept?: 'image' | 'all';
    initialFolder?: string;
}

type Tab = 'library' | 'upload' | 'url';

export function MediaPicker({ open, onClose, onSelect, accept = 'image', initialFolder }: MediaPickerProps) {
    const { siteId } = useSite();
    const [tab, setTab] = useState<Tab>('library');
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [uploadBusy, setUploadBusy] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        listMedia({ siteId, folder: initialFolder })
            .then(setItems)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [open, siteId, initialFolder]);

    if (!open) return null;

    const acceptAttr = accept === 'image' ? 'image/*' : '*/*';

    const handleFile = async (file: File) => {
        if (!file) return;
        setUploadBusy(true);
        setError('');
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) throw new Error('Not authenticated');
            const item = await registerMedia({ siteId, file, uploadedBy: uid });
            setItems((prev) => [item, ...prev]);
            onSelect({ url: item.url, item });
            onClose();
        } catch (e: any) {
            setError(e.message || 'Upload failed');
        } finally {
            setUploadBusy(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[800px] max-w-[95vw] max-h-[85vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-neutral-800">
                    <div className="flex items-center gap-2">
                        <ImageIcon size={16} className="text-neutral-500" />
                        <span className="font-semibold text-sm">Media</span>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded">
                        <X size={14} />
                    </button>
                </div>
                <div className="flex border-b border-gray-200 dark:border-neutral-800">
                    {(['library', 'upload', 'url'] as Tab[]).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm capitalize ${tab === t ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-neutral-500'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-hidden">
                    {tab === 'library' && (
                        loading ? (
                            <div className="flex items-center justify-center h-64 text-neutral-500"><Loader2 className="animate-spin" /></div>
                        ) : (
                            <MediaLibraryGrid
                                items={items}
                                onSelect={(item) => { onSelect({ url: item.url, item }); onClose(); }}
                            />
                        )
                    )}
                    {tab === 'upload' && (
                        <div className="p-6">
                            <input
                                ref={fileRef}
                                type="file"
                                accept={acceptAttr}
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                            />
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploadBusy}
                                className="w-full py-12 border-2 border-dashed border-gray-300 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-blue-400"
                            >
                                {uploadBusy ? <Loader2 className="animate-spin" /> : <UploadIcon size={24} className="text-neutral-400" />}
                                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                                    {uploadBusy ? 'Uploading…' : 'Click to upload an image'}
                                </span>
                            </button>
                            {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
                        </div>
                    )}
                    {tab === 'url' && (
                        <div className="p-6 space-y-3">
                            <label className="block text-sm font-medium">External URL</label>
                            <div className="flex gap-2">
                                <LinkIcon size={16} className="mt-2.5 text-neutral-400" />
                                <input
                                    type="url"
                                    value={urlInput}
                                    onChange={(e) => setUrlInput(e.target.value)}
                                    placeholder="https://…"
                                    className="flex-1 px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900"
                                />
                                <button
                                    disabled={!urlInput}
                                    onClick={() => { onSelect({ url: urlInput }); onClose(); }}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md disabled:opacity-50"
                                >
                                    Use URL
                                </button>
                            </div>
                            <p className="text-xs text-neutral-500">External URLs are not added to the library.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Smoke-test compile**

Run: `pnpm lint`
Expected: No errors in `components/admin/media/`.

- [ ] **Step 3: Commit**

```bash
git add components/admin/media/MediaPicker.tsx
git commit -m "feat(media): add MediaPicker modal with Library/Upload/URL tabs"
```

---

## Task 11: `<MediaUsageModal>` and `<MediaItemDrawer>`

**Files:**
- Create: `components/admin/media/MediaUsageModal.tsx`
- Create: `components/admin/media/MediaItemDrawer.tsx`

- [ ] **Step 1: Implement the usage modal**

`components/admin/media/MediaUsageModal.tsx`:
```tsx
'use client';

import { X } from 'lucide-react';
import type { MediaUsage } from '@/lib/media/types';

interface Props {
    open: boolean;
    usages: MediaUsage[];
    onCancel: () => void;
    onForceDelete: () => void;
}

export function MediaUsageModal({ open, usages, onCancel, onForceDelete }: Props) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-[480px] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl">
                <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-neutral-800">
                    <span className="font-semibold text-sm">This file is in use</span>
                    <button onClick={onCancel} className="p-1.5"><X size={14} /></button>
                </div>
                <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Deleting will break the following references:
                    </p>
                    <ul className="text-sm space-y-1">
                        {usages.map((u, i) => (
                            <li key={i} className="flex justify-between border-b border-gray-100 dark:border-neutral-800 py-1.5">
                                <span>{u.label}</span>
                                <span className="text-neutral-400">{u.location}</span>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
                    <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800">
                        Cancel
                    </button>
                    <button onClick={onForceDelete} className="px-3 py-1.5 text-sm rounded-md bg-red-600 text-white">
                        Force delete
                    </button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Implement the item drawer**

`components/admin/media/MediaItemDrawer.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updateMedia } from '@/lib/media/library';
import type { MediaItem } from '@/lib/media/types';

interface Props {
    item: MediaItem | null;
    siteId: string;
    onClose: () => void;
    onChange: (next: MediaItem) => void;
}

export function MediaItemDrawer({ item, siteId, onClose, onChange }: Props) {
    const [fileName, setFileName] = useState('');
    const [folder, setFolder] = useState('');
    const [tagsInput, setTagsInput] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!item) return;
        setFileName(item.fileName);
        setFolder(item.folder);
        setTagsInput(item.tags.join(', '));
    }, [item]);

    if (!item) return null;

    const save = async () => {
        setSaving(true);
        const patch = {
            fileName,
            folder: folder || 'Uncategorized',
            tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        };
        await updateMedia(siteId, item.id, patch);
        onChange({ ...item, ...patch });
        setSaving(false);
        onClose();
    };

    return (
        <div className="fixed inset-y-0 right-0 z-40 w-[400px] bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-neutral-800">
                <span className="font-semibold text-sm truncate">{item.fileName}</span>
                <button onClick={onClose} className="p-1.5"><X size={14} /></button>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.fileName} className="w-full rounded-lg" />
                <label className="block text-xs font-medium text-neutral-500">Filename</label>
                <input value={fileName} onChange={e => setFileName(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
                <label className="block text-xs font-medium text-neutral-500">Folder</label>
                <input value={folder} onChange={e => setFolder(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
                <label className="block text-xs font-medium text-neutral-500">Tags (comma separated)</label>
                <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} className="w-full px-3 py-2 text-sm rounded-md border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900" />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
                <button onClick={onClose} className="px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800">Cancel</button>
                <button onClick={save} disabled={saving} className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white flex items-center gap-1">
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    Save
                </button>
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/admin/media/MediaUsageModal.tsx components/admin/media/MediaItemDrawer.tsx
git commit -m "feat(media): add MediaUsageModal and MediaItemDrawer"
```

---

## Task 12: `/admin/media` management page

**Files:**
- Create: `app/admin/(dashboard)/media/page.tsx`

- [ ] **Step 1: Implement the page**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Upload as UploadIcon, Trash2, RefreshCw, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import {
    listMedia, deleteMedia, importExistingMedia, registerMedia,
    MediaInUseError,
} from '@/lib/media/library';
import type { MediaItem, MediaUsage } from '@/lib/media/types';
import { MediaLibraryGrid } from '@/components/admin/media/MediaLibraryGrid';
import { MediaItemDrawer } from '@/components/admin/media/MediaItemDrawer';
import { MediaUsageModal } from '@/components/admin/media/MediaUsageModal';

export default function MediaPage() {
    const { siteId } = useSite();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [active, setActive] = useState<MediaItem | null>(null);
    const [usageBlock, setUsageBlock] = useState<{ id: string; usages: MediaUsage[] } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const refresh = async () => {
        setLoading(true);
        const next = await listMedia({ siteId });
        setItems(next);
        setLoading(false);
    };
    useEffect(() => { refresh(); }, [siteId]);

    const onUpload = async (file: File) => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setBusy('upload');
        const item = await registerMedia({ siteId, file, uploadedBy: uid });
        setItems(prev => [item, ...prev]);
        setBusy(null);
    };

    const onDelete = async (id: string, force = false) => {
        setBusy(`del-${id}`);
        try {
            await deleteMedia(siteId, id, { force });
            setItems(prev => prev.filter(i => i.id !== id));
            setUsageBlock(null);
            setActive(null);
        } catch (e) {
            if (e instanceof MediaInUseError) {
                setUsageBlock({ id, usages: e.usages });
            } else {
                setToast((e as Error).message);
            }
        } finally {
            setBusy(null);
        }
    };

    const onImport = async () => {
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        setBusy('import');
        const res = await importExistingMedia(siteId, uid);
        setToast(`Imported ${res.imported} files, skipped ${res.skipped} orphans.`);
        await refresh();
        setBusy(null);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
                <h1 className="text-lg font-semibold">Media</h1>
                <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800 cursor-pointer">
                        <UploadIcon size={14} /> Upload
                        <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])}
                        />
                    </label>
                    <button
                        onClick={onImport}
                        disabled={busy === 'import'}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-neutral-800"
                    >
                        {busy === 'import' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        Import existing files
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center flex-1 text-neutral-500"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="flex-1 overflow-hidden">
                    <MediaLibraryGrid items={items} onSelect={setActive} selectedId={active?.id} />
                </div>
            )}

            <MediaItemDrawer
                item={active}
                siteId={siteId}
                onClose={() => setActive(null)}
                onChange={(next) => setItems(prev => prev.map(i => i.id === next.id ? next : i))}
            />

            {active && (
                <div className="fixed bottom-4 right-[420px] z-40">
                    <button
                        onClick={() => onDelete(active.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-red-600 text-white"
                    >
                        <Trash2 size={14} /> Delete
                    </button>
                </div>
            )}

            <MediaUsageModal
                open={!!usageBlock}
                usages={usageBlock?.usages ?? []}
                onCancel={() => setUsageBlock(null)}
                onForceDelete={() => usageBlock && onDelete(usageBlock.id, true)}
            />

            {toast && (
                <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-neutral-900 text-white text-sm rounded-md shadow-lg"
                     onAnimationEnd={() => setToast(null)}>
                    {toast}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Run dev server and visually verify**

Run: `pnpm dev` then navigate to `/admin/media`.
Expected: page renders with empty state (no items), Upload and Import buttons visible. Upload a test image and verify it appears in the grid.

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(dashboard\)/media/page.tsx
git commit -m "feat(media): add /admin/media management page"
```

---

## Task 13: Register "Media" in admin sidebar

**Files:**
- Modify: `app/admin/(dashboard)/AdminSidebar.tsx:155-161`

- [ ] **Step 1: Add the import and nav item**

In `app/admin/(dashboard)/AdminSidebar.tsx`, add `Image as ImageIcon` to the lucide import at line 7:

```tsx
import { LayoutDashboard, LogOut, Menu, X, Palette, Inbox, Box, Users, Sun, Moon, PanelLeftClose, PanelLeftOpen, User, Building2, ChevronUp, ChevronDown, Layers, MessageCircle, Activity, Image as ImageIcon } from 'lucide-react';
```

In the `allCoreItems` array (around line 155), insert "Media" between Canvas Studio and Template:

```tsx
const allCoreItems = [
    { icon: LayoutDashboard, label: 'Overview', href: `${baseUrl}/admin`, permission: null },
    { icon: Box, label: 'Canvas Studio', href: `${baseUrl}/admin/canvas`, permission: 'biolink' },
    { icon: ImageIcon, label: 'Media', href: `${baseUrl}/admin/media`, permission: 'biolink' },
    { icon: Palette, label: 'Template', href: `${baseUrl}/admin/template`, permission: 'biolink' },
    { icon: Layers, label: 'Services', href: `${baseUrl}/admin/services`, permission: null },
    ...(process.env.NEXT_PUBLIC_ENABLE_WHATSAPP === 'true' ? [{ icon: MessageCircle, label: 'WhatsApp', href: `${baseUrl}/admin/whatsapp`, permission: null }] : []),
];
```

- [ ] **Step 2: Verify in browser**

Run: `pnpm dev`, visit any admin page.
Expected: "Media" item appears in the Core sidebar group between Canvas Studio and Template. Clicking it navigates to `/admin/media`.

- [ ] **Step 3: Commit**

```bash
git add app/admin/\(dashboard\)/AdminSidebar.tsx
git commit -m "feat(media): add Media item to admin sidebar"
```

---

## Task 14: Retrofit `MediaField` to use `<MediaPicker>`

**Files:**
- Modify: `components/admin/blocks/media-field/MediaField.tsx`

- [ ] **Step 1: Replace the file picker flow with `<MediaPicker>` for image uploads**

In `components/admin/blocks/media-field/MediaField.tsx`, locate the `handleImageUpload` flow that calls `uploadToStorage` directly. Replace the "Upload" button's `onClick` so that instead of opening a hidden `<input type="file">`, it opens `<MediaPicker>`. Keep the existing video/Lottie flows unchanged.

At the top of the file add:
```tsx
import { MediaPicker } from '@/components/admin/media/MediaPicker';
```

Add to component state:
```tsx
const [pickerOpen, setPickerOpen] = useState(false);
```

Replace the existing image upload button trigger with:
```tsx
<button type="button" onClick={() => setPickerOpen(true)} className="...existing classes...">
    {/* existing icon + label */}
</button>
```

Render the picker (near the end of the JSX):
```tsx
<MediaPicker
    open={pickerOpen}
    onClose={() => setPickerOpen(false)}
    onSelect={({ url }) => {
        commit(url);
        setPickerOpen(false);
    }}
/>
```

Remove the now-unused `imageInputRef`, `posterInputRef` for the image flow, `handleImageUpload` for `target === 'image'`, and the related hidden `<input>` — keep only the `poster` and `lottie` flows since they're out of v1 scope and still need direct upload. **Keep `uploadToStorage` import** since poster/lottie still need it.

- [ ] **Step 2: Manually verify**

Run `pnpm dev`, open Canvas Studio, add a block with a media field. Click the image upload area.
Expected: `<MediaPicker>` modal opens on Library tab. Uploading via the Upload tab works and the new image becomes the block's media. Selecting an existing library item also works.

- [ ] **Step 3: Commit**

```bash
git add components/admin/blocks/media-field/MediaField.tsx
git commit -m "feat(media): retrofit MediaField to use MediaPicker for images"
```

---

## Task 15: Retrofit `BlockImageUploader` and `BackgroundMediaEditor`

**Files:**
- Modify: `components/admin/blocks/BlockImageUploader.tsx`
- Modify: `components/admin/blocks/BackgroundMediaEditor.tsx`

- [ ] **Step 1: Inspect each file's current upload flow**

Run: `grep -n "uploadToStorage" components/admin/blocks/BlockImageUploader.tsx components/admin/blocks/BackgroundMediaEditor.tsx`
For each match, replace the upload trigger button with a `<MediaPicker>` modal toggled by local state (same pattern as Task 14).

- [ ] **Step 2: Modify `BlockImageUploader.tsx`**

Add import:
```tsx
import { MediaPicker } from '@/components/admin/media/MediaPicker';
```
Add state `const [pickerOpen, setPickerOpen] = useState(false);`. Replace the existing onClick handler that opens the hidden `<input type="file">` with `setPickerOpen(true)`. Render `<MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={({ url }) => onChange(url)} />`. Remove the now-unused `<input type="file">` and `handleFile` code that called `uploadToStorage` directly.

- [ ] **Step 3: Modify `BackgroundMediaEditor.tsx`**

Same pattern as Step 2. Locate the upload affordance, swap to `<MediaPicker>`. Wire `onSelect` to whatever prop sets the background URL.

- [ ] **Step 4: Manually verify**

Run `pnpm dev`. Trigger each retrofitted uploader from its host UI (block inspector for `BlockImageUploader`, background editor in Canvas Studio for `BackgroundMediaEditor`).
Expected: `<MediaPicker>` opens, both tabs work, value is set on confirm.

- [ ] **Step 5: Commit**

```bash
git add components/admin/blocks/BlockImageUploader.tsx components/admin/blocks/BackgroundMediaEditor.tsx
git commit -m "feat(media): retrofit BlockImageUploader and BackgroundMediaEditor to MediaPicker"
```

---

## Task 16: Canvas Studio MediaPanel slide-over

**Files:**
- Create: `components/admin/blocks/panels/MediaPanel.tsx`
- Modify: `components/admin/blocks/CanvasStudio.tsx`

- [ ] **Step 1: Create the panel**

`components/admin/blocks/panels/MediaPanel.tsx`:
```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Image as ImageIcon, ExternalLink, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { listMedia } from '@/lib/media/library';
import type { MediaItem } from '@/lib/media/types';
import { MediaLibraryGrid } from '@/components/admin/media/MediaLibraryGrid';

export function MediaPanel() {
    const { siteId } = useSite();
    const [items, setItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        listMedia({ siteId }).then((res) => { setItems(res); setLoading(false); });
    }, [siteId]);

    const copyUrl = async (item: MediaItem) => {
        await navigator.clipboard.writeText(item.url);
        setToast('URL copied');
        setTimeout(() => setToast(null), 1500);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-neutral-800">
                <span className="text-xs text-neutral-500">Click an item to copy its URL.</span>
                <Link href="/admin/media" target="_blank" className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                    Manage <ExternalLink size={11} />
                </Link>
            </div>
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-neutral-400" /></div>
                ) : (
                    <MediaLibraryGrid items={items} onSelect={copyUrl} />
                )}
            </div>
            {toast && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-neutral-900 text-white text-xs rounded-md">
                    {toast}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 2: Register the panel in `CanvasStudio.tsx`**

Add the dynamic import near the other panel imports (around line 33-37):
```tsx
const MediaPanel = dynamic(() => import('./panels/MediaPanel').then(m => m.MediaPanel));
```

Extend the `toggleSlideOverPanel` type and call sites (line 124) to include `'media'`:
```tsx
const toggleSlideOverPanel = (panel: 'links' | 'forms' | 'products' | 'siteinfo' | 'branding' | 'media') => {
    setSlideOverPanel(prev => prev === panel ? null : panel);
};
```

Find the slide-over rendering block (around line 848) and add a case for `'media'` rendering `<SlideOverPanel title="Media" icon={ImageIcon} onClose={() => setSlideOverPanel(null)}><MediaPanel /></SlideOverPanel>`. Import `Image as ImageIcon` from `lucide-react` at the top of CanvasStudio.tsx.

Find the toolbar where the other slide-over toggles live (search for `toggleSlideOverPanel('links')` to locate). Add a button right after it:
```tsx
<button
    onClick={() => toggleSlideOverPanel('media')}
    className={/* same classes as siblings */}
    title="Media library"
>
    <ImageIcon size={16} />
</button>
```

- [ ] **Step 3: Verify**

Run `pnpm dev`, open Canvas Studio. Click the new Media button in the toolbar.
Expected: slide-over panel opens, grid shows existing library items, clicking an item copies its URL with a toast. "Manage" link opens `/admin/media` in a new tab.

- [ ] **Step 4: Commit**

```bash
git add components/admin/blocks/panels/MediaPanel.tsx components/admin/blocks/CanvasStudio.tsx
git commit -m "feat(media): add MediaPanel slide-over to Canvas Studio"
```

---

## Task 17: Retrofit Tiptap image extension

**Files:**
- Modify: Tiptap image insert path (locate via grep — likely `components/admin/blocks/rich-text/`)

- [ ] **Step 1: Locate the Tiptap image upload path**

Run: `grep -rln "uploadToStorage\|setImage\|insertContent.*image" components/admin/blocks/rich-text/`
Expected: finds the file responsible for handling the image button in the rich text toolbar. Open it.

- [ ] **Step 2: Swap to `<MediaPicker>`**

Same pattern as Task 14: add `MediaPicker` import, add `pickerOpen` state, change the image-button click handler from "open file input" to `setPickerOpen(true)`. On `onSelect({ url })`, call the existing Tiptap command that inserts the image with that URL (e.g., `editor.chain().focus().setImage({ src: url }).run()`).

If the file is large or the image flow is deeply coupled, do the minimum surgical edit — just swap the upload trigger.

- [ ] **Step 3: Verify**

Run `pnpm dev`, edit a rich-text field in a block, click the image button in the toolbar.
Expected: `<MediaPicker>` opens, both Library and Upload tabs insert an image at the cursor.

- [ ] **Step 4: Commit**

```bash
git add <files-touched>
git commit -m "feat(media): retrofit rich-text image insert to MediaPicker"
```

---

## Task 18: Final verification pass

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all tests pass. Fix any regressions in retrofitted callers (most likely: snapshot or mocked-import drift).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke flow**

In `pnpm dev`:
1. Visit `/admin/media` → upload an image → confirm it appears.
2. Click the item → drawer opens → edit folder to "heroes" → save → confirm the folder appears in the filter dropdown.
3. Open Canvas Studio → click Media toolbar button → confirm the image is visible in the slide-over → click it → confirm URL is copied.
4. Add a block with a media field → click upload area → `<MediaPicker>` opens → select the library item → confirm the block now references that URL.
5. Back at `/admin/media`, select that image → click Delete → confirm the `MediaUsageModal` lists the page that uses it → click Cancel → image remains. Repeat and click "Force delete" → image is removed.
6. Use the "Import existing files" button → expect a toast with imported/skipped counts.

- [ ] **Step 5: Commit any final fixes and done**

```bash
git status
# If any minor cleanup needed:
git add <files>
git commit -m "chore(media): final verification fixes"
```

---

## Self-Review Notes

- **Spec coverage:**
  - Data model (`MediaItem`, `MediaUsage`, `MediaInUseError`) → Task 1.
  - `<MediaPicker>` three tabs → Task 10.
  - `<MediaLibraryGrid>` reusable → Task 9.
  - `/admin/media` management page → Task 12.
  - Navigation: top-level "Media" sidebar entry → Task 13.
  - Canvas Studio toolbar slide-over → Task 16.
  - API: `registerMedia`/`listMedia`/`updateMedia`/`findUsages`/`deleteMedia`/`importExistingMedia` → Tasks 2-6.
  - Firestore rules → Task 7.
  - Retrofit checklist (MediaField, BlockImageUploader, BackgroundMediaEditor, Tiptap) → Tasks 14, 15, 17.
  - Multi-tenancy + storage paths unchanged → conventions section + Task 2 (`folder: 'media'` passed to existing `uploadToStorage`).
- **Pages/Links/Forms editor file uploads** in the spec retrofit list: these are not Canvas Studio blocks but standalone editors. They aren't covered by Tasks 14-17. Decision: out of scope for v1 *plan*; can be retrofitted in a follow-up iteration once the picker exists. Calling this out explicitly so the engineer doesn't get blocked looking for a task that's missing.
- **Business profile / logo upload retrofit**: same as above — deferred to a follow-up pass once `<MediaPicker>` proves out on the block uploaders.

If you want those covered in v1, they're each a 5-minute repeat of Task 14's pattern — just say the word and they get added as Task 14b / 14c / 14d.
