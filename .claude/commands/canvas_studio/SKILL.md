---
name: canvas_studio
description: >
  Work with the Clicker Platform Canvas Studio — the WYSIWYG page builder for custom pages.
  Use this skill whenever modifying the block editor, adding new block types, editing block
  property forms, fixing canvas rendering, or extending the block system.
  Trigger on: "canvas studio", "page builder", "block editor", "add a block type", "block form",
  "block renderer", "block property", "page studio", "navigator panel", "CanvasStudio",
  "BlockFormRenderer", "BlockRenderer", "PageStudioContext", "EditorContext",
  "components/admin/blocks/", or any issue with how blocks display in the editor or on the public site.
---

# /canvas_studio — Page Builder & Block System

You are working on the **Clicker Platform Canvas Studio** — a full WYSIWYG page builder that lets tenants create custom pages using a block-based system. Blocks are stored as structured JSON in Firestore and rendered both in the admin canvas preview and on the public site.

---

## Architecture Overview

```
app/admin/(dashboard)/pages/page.tsx
└── PageStudioProvider (global page/save state)
    └── PageStudioInner
        └── EditorProvider (canvas selection state)
            ├── StudioTopBar          ← top bar: device toggle, save, homepage
            └── CanvasStudio          ← main 3-panel layout
                ├── Left Sidebar
                │   ├── Icon strip (P/A/Z keyboard shortcuts)
                │   └── Switchable Panels
                │       ├── PagesPanel          ← list + switch pages
                │       ├── AddBlocksPanel      ← add new blocks
                │       └── BlockManager        ← navigator + DnD reorder
                ├── Center Canvas       ← live template preview (WYSIWYG)
                │   └── BlockRenderer   ← renders each block (shared with public)
                └── Right Sidebar
                    ├── Page settings (title, slug)
                    ├── SEO & Analytics panel
                    └── BlockFormRenderer ← type-specific property forms
```

---

## Data Model

### `PageBlock`
```typescript
interface PageBlock {
  id: string;       // UUID (created client-side via uuidv4())
  type: BlockType;  // 'hero' | 'text' | 'image' | 'button' | etc.
  data: any;        // type-specific payload (see blockDefinitions.ts)
}
```

### `Page` (Firestore: `sites/{siteId}/pages/{pageId}`)
```typescript
{
  title: string;
  slug: string;        // URL-safe, lowercase, hyphenated
  blocks: PageBlock[];
  seo?: { title, description, image, noIndex };
  pixels?: { facebookPixelId, googleAnalyticsId, tiktokPixelId };
  // legacy: content (HTML string) — ignore, migration handled automatically
}
```

### Global settings (Firestore: `sites/{siteId}/content/siteSettings`)
```typescript
{ homepageSlug: string }  // which page slug is the homepage
```

---

## Core Block Types

Defined in `components/admin/blocks/blockDefinitions.ts`:

| Type | Label | Default data |
|---|---|---|
| `hero` | Hero Section | `{ title, subtitle }` |
| `text` | Text Content | `{ content: '<p>...</p>' }` |
| `image` | Image | `{ alt, caption }` |
| `button` | Button | `{ label, url, style: 'primary' }` |
| `products` | Product List | `{ title }` |
| `faq` | FAQ List | `{ title, items: [{question, answer}] }` |
| `link` | Link Card | `{ title, url }` |
| `map` | Map | `{ address }` |
| `image_gallery` | Image Gallery | `{ title, images: [] }` |
| `quick_actions` | Quick Links | `{}` (system data) |
| `hours` | Operating Hours | `{}` (system data) |
| `featured_product` | Featured Product | `{}` (system data) |
| `branches` | Branches | `{}` (system data) |

**System blocks** (`quick_actions`, `hours`, `featured_product`, `branches`) auto-hydrate data from global site settings — they have no editable fields in the canvas, only in dedicated settings pages.

---

## Action: `add-block-type`

To add a new block type (e.g., `testimonials`):

### Step 1 — Register in `blockDefinitions.ts`

```typescript
// components/admin/blocks/blockDefinitions.ts
{ type: 'testimonials', label: 'Testimonials', icon: Star },
```

Add default data in `getDefaultData()`:
```typescript
case 'testimonials':
  return { ...baseData, title: 'What people say', items: [] };
```

### Step 2 — Add the type to `BlockType`

```typescript
// data/mockData.ts
export type BlockType = 'hero' | 'text' | ... | 'testimonials' | string;
```

### Step 3 — Create the property form

```
components/admin/blocks/forms/TestimonialsForm.tsx
```

Pattern — all forms receive `(data, onChange)`. Use canvas dark theme styles:
```tsx
'use client';

const inputClass = "w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-500 mb-1";
const sectionClass = "p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 space-y-3";

interface Props { data: any; onChange: (data: any) => void; }
export default function TestimonialsForm({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Title</label>
        <input
          value={data.title || ''}
          onChange={e => onChange({ ...data, title: e.target.value })}
          className={inputClass}
          placeholder="What people say"
        />
      </div>
      {/* ... */}
    </div>
  );
}
```

### Step 4 — Register form in `BlockFormRenderer.tsx`

```typescript
// components/admin/blocks/BlockFormRenderer.tsx
case 'testimonials': {
  const { default: Form } = await import('./forms/TestimonialsForm');
  return <Form data={block.data} onChange={onDataChange} />;
}
```

### Step 5 — Add the public render component

```
components/blocks/public/DefaultTestimonialsBlock.tsx
```

Props: `{ data: any, theme: ThemeConfig, profile?: any, previewMode?: boolean }`

Follow the 3-way card style pattern (required for template compatibility):
```tsx
const isClean = theme.cardStyle === 'clean';
const isGlass = theme.cardStyle === 'glass';
const isBold = !isClean && !isGlass;
```

### Step 6 — Register in `BlockRenderer.tsx`

```typescript
// components/blocks/BlockRenderer.tsx
case 'testimonials':
  const TestimonialsBlock = (await import('./public/DefaultTestimonialsBlock')).default;
  return <TestimonialsBlock data={block.data} theme={theme} profile={profile} />;
```

### Step 7 — Add label in `BlockOutlineItem.tsx`

```typescript
// components/admin/blocks/BlockOutlineItem.tsx → getBlockLabel()
case 'testimonials': return 'Testimonials';
```

---

## Action: `add-layout-variant`

Blocks can have multiple layouts (e.g., Hero: `centered` vs `split`). Layout variants are selected in the right sidebar via `LayoutVariantPicker` (`components/admin/blocks/forms/LayoutVariantPicker.tsx`).

`BlockFormRenderer` renders `LayoutVariantPicker` above the block's form when `LAYOUT_VARIANTS[block.type]` is defined. To add variants to a block type:

1. Add to `LAYOUT_VARIANTS` in `blockDefinitions.ts`:
   ```typescript
   testimonials: [
     { id: 'grid', label: 'Grid', icon: LayoutGrid },
     { id: 'carousel', label: 'Carousel', icon: Rows },
   ]
   ```
2. In the block's public component, check `data.layoutVariant`
3. To set a default variant per-template, add to `lib/templates/definitions.ts`:
   ```typescript
   defaultBlockLayouts: { hero: 'split', ... }
   ```
4. `getDefaultData()` reads `template.config.defaultBlockLayouts` and sets `layoutVariant` automatically

---

## Action: `add-module-block`

Module blocks are contributed by modules (e.g., `pos_menu`, `booking_widget`). They appear in the Add Blocks panel only when the module is enabled.

1. In the module's definition (`lib/modules/definitions.ts`), add a `blocks` entry:
   ```typescript
   blocks: [{ type: 'pos_menu', label: 'POS Menu', icon: 'shopping-bag' }]
   ```
2. The `AddBlocksPanel` reads `subscribeToEnabledModules()` and automatically includes these
3. Create the form + public component using the same patterns as core blocks
4. Register in `BlockRenderer.tsx` (or use `ModuleBlockLoader` which checks the module registry)

---

## Key Contexts

### `usePageStudio()` — global page state
```typescript
const {
  pages, activePageId,
  formData,              // { title, slug, blocks, seoTitle, ..., pixelFb, ... }
  isDirty, saving,
  setTitle, setSlug, setBlocks,
  switchPage, savePage, deletePage,
  setHomepage, unsetHomepage,
  // Unsaved changes dialog:
  pendingSwitch, confirmDiscard, confirmSaveAndSwitch, cancelSwitch,
} = usePageStudio();
```

### `useEditor()` — canvas selection state
```typescript
const {
  blocks, setBlocks,
  selectedBlockId, setSelectedBlockId,
  hoveredBlockId, setHoveredBlockId, // hover ring effects
  deviceView, setDeviceView,          // 'desktop' | 'tablet' | 'mobile'
  updateBlockData,                    // (id, partialData) => void
  addBlock, removeBlock, moveBlock,
} = useEditor();
```

**Important**: `EditorContext` syncs its `blocks` to `PageStudioContext.setBlocks` so they are persisted on save. Edits go through `useEditor().updateBlockData()`.

---

## Canvas Rendering

The center canvas renders a **full template preview** using the real `getTemplate(templateId)` components:
- Template header (`NavBar`)
- Page background (`themeColor`)
- All blocks via `BlockRenderer` (with `previewMode={true}`)
- Template footer
- Template bottom nav (if any)

Device view affects max-width:
- Desktop: unconstrained
- Tablet: `max-w-lg`
- Mobile: `max-w-md` + narrow scroll container

Block selection: clicking a block sets `selectedBlockId` in `EditorContext`. A blue ring (`ring-2 ring-blue-500`) wraps the selected block. `PointerEvents` are set to `none` on most block children to prevent interactive elements (links, buttons) from firing in preview mode.

---

## Chrome Blocks

"Chrome" = structural template shell (header, footer, bottom nav). They are represented as:
- `chrome:header` — top nav bar
- `chrome:footer` — site footer
- `chrome:bottomnav` — mobile bottom navigation

They appear as pinned items in the **Navigator** panel (BlockManager) — locked with a `Lock` icon, not deletable. When selected, `ChromeSlotPanel` renders in the right sidebar (with links to Nav/Footer settings pages).

---

## Save Flow

1. User edits trigger `useEditor().updateBlockData()` → local state
2. `EditorContext` writes back to `PageStudioContext.setBlocks()` on every change
3. `isDirty` is computed by JSON diff vs. saved snapshot
4. Orange dot in `StudioTopBar` indicates unsaved changes
5. `savePage()` validates slug, writes to Firestore, clears dirty state

Unsaved changes guard:
- `beforeunload` event warns on browser close
- Switching pages with unsaved changes shows a dialog: **Save & Switch** / **Discard** / **Cancel**

---

## Common Gotchas

**`previewMode={true}` disables interactions in the canvas.** Block components should check `previewMode` and skip event listeners, form submissions, etc.

**Block `data` is mutable but `id` and `type` are not.** Only call `updateBlockData(id, newData)` — never replace the whole block object (this would lose selection state).

**System blocks render live data, not form data.** `quick_actions`, `hours`, `featured_product`, `branches` pull from `hydratePageBlocks(siteId, blocks)` which fetches site-wide settings. Their `data` field in Firestore is typically empty `{}`.

**Slug must be unique per site.** `savePage()` checks for duplicate slugs. The homepage slug is stored separately in `siteSettings.homepageSlug` (default: `'home'`).

**Module blocks need the module enabled.** If a page has a module block but the module is disabled, `ModuleBlockLoader` silently renders nothing on the public site.

**Legacy pages have a `content` (HTML) field but no `blocks`.** `PageStudioContext` handles this with a migration prompt in `PageStudioInner`. Don't write new code that reads `page.content`.

---

## Critical File Paths

```
ADMIN UI (clicker-platform-v2/):

Page entry:
  app/admin/(dashboard)/pages/page.tsx          ← entry, PageStudioProvider wrapper

Contexts:
  components/admin/blocks/PageStudioContext.tsx  ← page list, save, dirty tracking
  components/admin/blocks/EditorContext.tsx      ← blocks, selection, device view

Main editor:
  components/admin/blocks/CanvasStudio.tsx       ← 3-panel layout
  components/admin/blocks/StudioTopBar.tsx       ← top bar
  components/admin/blocks/BlockManager.tsx       ← navigator + DnD
  components/admin/blocks/BlockOutlineItem.tsx   ← single navigator item
  components/admin/blocks/LeftSidebarPanels.tsx  ← PagesPanel, AddBlocksPanel
  components/admin/blocks/ChromeSlotPanel.tsx    ← header/footer/bottomnav props

Block form system:
  components/admin/blocks/BlockFormRenderer.tsx          ← dispatches to type-specific forms
  components/admin/blocks/blockDefinitions.ts            ← BLOCK_OPTIONS, getDefaultData(), LAYOUT_VARIANTS
  components/admin/blocks/forms/LayoutVariantPicker.tsx  ← layout switcher rendered above block forms
  components/admin/blocks/forms/HeroForm.tsx             ← example form
  components/admin/blocks/forms/TextForm.tsx
  components/admin/blocks/forms/ImageForm.tsx
  components/admin/blocks/forms/FaqForm.tsx
  components/admin/blocks/forms/ProductsForm.tsx
  ... (one file per core block type)

Block rendering (shared admin + public):
  components/blocks/BlockRenderer.tsx            ← routes to Default* or custom components
  components/blocks/public/Default*.tsx          ← public block components
  components/blocks/public/cardStyles.ts         ← getCardClasses(), getTextColor()

Image uploads in blocks:
  components/admin/blocks/BlockImageUploader.tsx ← image upload/preview widget

Types:
  data/mockData.ts                               ← PageBlock, Page, BlockType interfaces
```
