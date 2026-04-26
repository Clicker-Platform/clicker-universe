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

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /canvas_studio — Page Builder & Block System

You are working on the **Clicker Platform Canvas Studio** — a full WYSIWYG page builder that lets tenants create custom pages using a block-based system. Blocks are stored as structured JSON in Firestore and rendered both in the admin canvas preview and on the public site.

---

## Architecture Overview

```
app/admin/(dashboard)/canvas/page.tsx
└── PageStudioProvider (global page/save state)
    └── PageStudioInner
        └── EditorProvider (canvas selection state)
            ├── StudioTopBar          ← top bar: device toggle, save, homepage
            └── CanvasStudio          ← main 3-panel layout
                ├── Left Sidebar
                │   ├── Icon strip (w-12)
                │   │   ├── P/A/Z shortcuts → Switchable Panels
                │   │   └── L/F/B/I shortcuts → Slide-over (Links/Forms/Products/Site Info) + Branding (no hotkey)
                │   └── Switchable Panels (w-56)
                │       ├── PagesPanel          ← list + switch pages
                │       ├── AddBlocksPanel      ← add new blocks
                │       └── BlockManager        ← navigator + DnD reorder
                ├── Center Canvas       ← live template preview (WYSIWYG)
                │   └── BlockRenderer   ← renders each block (shared with public)
                └── Right Sidebar (320px)
                    ├── Page settings (title, slug)
                    ├── SEO & Analytics panel
                    └── BlockFormRenderer ← type-specific property forms
```

> **Mobile:** On small screens, `MobileStudioTabBar` and `MobileBottomSheet` replace the desktop sidebar layout.

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

Defined in `components/admin/blocks/blockDefinitions.ts` (`BLOCK_OPTIONS`):

| Type | Label | Default data |
|---|---|---|
| `hero` | Hero Section | `{ title, subtitle, layoutVariant }` |
| `text` | Text Content | `{ content: '<p>...</p>', layoutVariant }` |
| `content_showcase` | Content Showcase | `{ ...DEFAULT_SHOWCASE_DATA, rows, layoutVariant }` |
| `image` | Image | `{ media, caption, layoutVariant }` |
| `button` | Button | `{ label, url, style: 'primary', layoutVariant }` |
| `products` | Product List | `{ title, layoutVariant }` |
| `faq` | FAQ List | `{ title, items: [{question, answer}], layoutVariant }` |
| `link` | Link Card | `{ title, url, layoutVariant }` |
| `map` | Map | `{ address, layoutVariant }` |
| `image_gallery` | Image Gallery | `{ title, images: [], layoutVariant }` |
| `social_embed` | Social Embeds | `{ title, limit: 6, items: [] }` |

**System blocks** — in `BLOCK_OPTIONS` and `getDefaultData()`, but auto-hydrate from site settings:

| Type | Label | Notes |
|---|---|---|
| `quick_actions` | Quick Actions | auto-hydrates from site settings |
| `hours` | Operating Hours | auto-hydrates from site settings |
| `featured_product` | Featured Product | auto-hydrates from site settings |
| `branches` | Branches | auto-hydrates from site settings |

System blocks pull live data via `hydratePageBlocks(siteId, blocks)`. Their `data` field in Firestore is typically empty `{}`.

**Module-contributed blocks** — registered via `lib/modules/definitions.ts` and surfaced by `AddBlocksPanel` only when the module is enabled (e.g., `reservation` from the Reservation module). See [Action: `add-module-block`](#action-add-module-block).

---

## Action: `add-block-type`

To add a new block type (e.g., `testimonials`):

### Step 1 — Register in `blockDefinitions.ts`

```typescript
// components/admin/blocks/blockDefinitions.ts — BLOCK_OPTIONS array
{ type: 'testimonials', label: 'Testimonials', icon: Star },
```

Add default data in `getDefaultData()`:
```typescript
case 'testimonials':
  return { ...baseData, title: 'What people say', items: [] };
```

`baseData` already includes `layoutVariant` resolved from `template.config.defaultBlockLayouts[type]`.

### Step 2 — Add the type to `BlockType`

```typescript
// data/mockData.ts
export type BlockType = 'hero' | 'text' | ... | 'testimonials' | string;
```

### Step 3 — Create the property form

```
components/admin/blocks/forms/TestimonialsForm.tsx
```

Pattern — all forms use a **named export** and receive `(data, onChange)`. Use canvas dark theme styles:
```tsx
'use client';

const inputClass = "w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium";
const labelClass = "block text-xs font-medium text-neutral-500 mb-1";
const sectionClass = "p-3 bg-neutral-900/50 rounded-xl border border-neutral-800 space-y-3";

interface Props { data: any; onChange: (data: any) => void; }
export function TestimonialsForm({ data, onChange }: Props) {
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

Add a `dynamic()` import at the top of the file alongside the other form imports:

```typescript
// At the top of BlockFormRenderer.tsx, with the other dynamic imports:
const TestimonialsForm = dynamic(() => import('./forms/TestimonialsForm').then(mod => mod.TestimonialsForm), { loading: () => <FormSkeleton /> });
```

Then add the case in the switch (wrap with `renderWithLayoutPicker` if the block supports layout variants):

```typescript
case 'testimonials': return renderWithLayoutPicker(<TestimonialsForm data={block.data} onChange={handleDataChange} />);
```

> **Note:** Do NOT use inline `await import()` inside the switch — all form imports use top-level `dynamic()` from `next/dynamic`.

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

`BlockFormRenderer` renders `LayoutVariantPicker` above the block's form for supported block types. Layout variants are driven by `template.config.defaultBlockLayouts` — there is no static `LAYOUT_VARIANTS` constant in `blockDefinitions.ts`. `getDefaultData()` reads `template.config.defaultBlockLayouts[type]` and sets the `layoutVariant` property in `baseData` automatically.

To add variants to a block type:

1. Define variant options in `LayoutVariantPicker.tsx` for your block type
2. In the block's public component, check `data.layoutVariant`
3. To set a default variant per-template, add to `lib/templates/definitions.ts`:
   ```typescript
   defaultBlockLayouts: { hero: 'split', testimonials: 'grid', ... }
   ```

---

## Action: `add-module-block`

Module blocks are contributed by modules (e.g., `reservation`, `pos_menu`). They appear in the Add Blocks panel only when the module is enabled.

1. In the module's definition (`lib/modules/definitions.ts`), add a `blocks` entry:
   ```typescript
   blocks: [{ type: 'pos_menu', label: 'POS Menu', icon: 'shopping-bag' }]
   ```
2. The `AddBlocksPanel` reads `subscribeToEnabledModules()` and automatically includes these
3. Create the form + public component using the same patterns as core blocks
4. Register in `BlockRenderer.tsx` (or use `ModuleBlockLoader` which checks the module registry)
5. Add `BlockFormRenderer` case so the block is editable in the canvas
6. Add a label in `BlockOutlineItem.tsx → getBlockLabel()` — the default fallback renders `'Module ({type})'`

> **Note:** The `reservation` block type exists in `BlockType` and is rendered by `BlockRenderer.tsx` via `ReservationBlock.tsx`, but currently has no form in `BlockFormRenderer`. It is treated as a read-only module block. If you need to make it editable, follow steps 3–6 above.
>
> **Note:** `reservation_cta` also exists in `BlockType` but has no BLOCK_OPTIONS entry, no form, and no case in `BlockRenderer`. It is a dangling type — do not use it until it is fully implemented.

---

## Key Contexts

### `usePageStudio()` — global page state
```typescript
const {
  // Page list
  pages, activePageId,
  pagesLoading, pageLoading,
  error,

  // Form state
  formData,              // { title, slug, blocks, seoTitle, ..., pixelFb, ... }
  isDirty, saving,
  hydratedData,          // hydrated block data (system blocks)
  globalSettings,        // site-wide settings

  // Field setters
  setTitle, setSlug, setBlocks, setContent,
  setSeoTitle, setSeoDescription, setSeoImage, setSeoNoIndex,
  setPixelFb, setPixelGa, setPixelTiktok,
  setOverrideSeo, setOverridePixels,
  showSeoSettings, setShowSeoSettings,

  // Page actions
  switchPage, savePage, deletePage,
  setHomepage, unsetHomepage,

  // Global settings
  updateFooterText,
  refreshGlobalSettings, updateGlobalSettings,

  // Trash
  trashedPages, trashedPagesLoading,
  trashPage, trashPageById,
  loadTrashedPages, restorePage, restoreAllPages,
  permanentlyDeletePage, permanentlyDeleteAllPages,

  // Unsaved changes dialog
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

**System blocks render live data, not form data.** `quick_actions`, `hours`, `featured_product`, `branches` pull from `hydratePageBlocks(siteId, blocks)` which fetches site-wide settings. Their `data` field in Firestore is typically empty `{}`. These types ARE in `BLOCK_OPTIONS` — they can be added via the Add Blocks panel.

**Slug must be unique per site.** `savePage()` checks for duplicate slugs. The homepage slug is stored separately in `siteSettings.homepageSlug` (default: `'home'`).

**Module blocks need the module enabled.** If a page has a module block but the module is disabled, `ModuleBlockLoader` silently renders nothing on the public site.

**Legacy pages have a `content` (HTML) field but no `blocks`.** `PageStudioContext` handles this with a migration prompt in `PageStudioInner`. Don't write new code that reads `page.content`.

**`social_embed` does not use `LayoutVariantPicker`.** It's the only core block rendered without `renderWithLayoutPicker` in `BlockFormRenderer`. Don't add one without verifying the public component supports `layoutVariant`.

**`BlockRenderer` checks for template-specific block overrides first.** Before rendering a `Default*` block, it reads `fullTemplate.components?.Blocks` and dispatches to the template's custom component if present (e.g. MRB's `MrbHero`, `MrbQuickActions`). When building new block types, add them to `BlockRenderer`'s switch — but be aware a template can shadow the default with its own implementation.

**Public block prop signatures vary.** Not all blocks receive `theme` and `profile` — only `hero` passes both. `text`, `image`, `button`, `faq`, `map` receive neither in `BlockRenderer`. Check the actual switch case before assuming props are available in a public block component.

**There is no static `LAYOUT_VARIANTS` constant.** The spec previously described this as an export from `blockDefinitions.ts`, but it does not exist. Variant defaults come from `template.config.defaultBlockLayouts` and are applied inside `getDefaultData()`.

**The Canvas Studio entry route is `/canvas`, not `/pages`.** The `/pages` route now redirects to `/canvas`. The entry file is `app/admin/(dashboard)/canvas/page.tsx`.

---

## Critical File Paths

```
ADMIN UI (clicker-platform-v2/):

Page entry:
  app/admin/(dashboard)/canvas/page.tsx          ← entry, PageStudioProvider wrapper
  app/admin/(dashboard)/pages/page.tsx           ← redirects to /canvas (legacy)

Contexts:
  components/admin/blocks/PageStudioContext.tsx  ← page list, save, dirty tracking, trash, SEO/pixel setters
  components/admin/blocks/EditorContext.tsx      ← blocks, selection, device view

Main editor:
  components/admin/blocks/CanvasStudio.tsx       ← 3-panel layout + L/F/B/I slide-over
  components/admin/blocks/StudioTopBar.tsx       ← top bar
  components/admin/blocks/BlockManager.tsx       ← navigator + DnD
  components/admin/blocks/BlockOutlineItem.tsx   ← single navigator item
  components/admin/blocks/LeftSidebarPanels.tsx  ← PagesPanel, AddBlocksPanel
  components/admin/blocks/ChromeSlotPanel.tsx    ← header/footer/bottomnav props
  components/admin/blocks/PageSwitcherDropdown.tsx ← page switcher dropdown component

Mobile:
  components/admin/blocks/MobileStudioTabBar.tsx ← mobile tab bar replacing desktop sidebar
  components/admin/blocks/MobileBottomSheet.tsx  ← mobile slide-up panel for block forms

Block form system:
  components/admin/blocks/BlockFormRenderer.tsx          ← dispatches to type-specific forms
  components/admin/blocks/blockDefinitions.ts            ← BLOCK_OPTIONS, getDefaultData()
  components/admin/blocks/forms/LayoutVariantPicker.tsx  ← layout switcher rendered above block forms
  components/admin/blocks/forms/HeroForm.tsx
  components/admin/blocks/forms/ContentShowcaseForm.tsx
  components/admin/blocks/forms/TextForm.tsx
  components/admin/blocks/forms/ImageForm.tsx
  components/admin/blocks/forms/ButtonForm.tsx
  components/admin/blocks/forms/FAQForm.tsx              ← note: uppercase FAQ
  components/admin/blocks/forms/ProductsForm.tsx
  components/admin/blocks/forms/LinkBlockForm.tsx
  components/admin/blocks/forms/MapForm.tsx
  components/admin/blocks/forms/ImageGalleryBlockForm.tsx
  components/admin/blocks/forms/QuickActionsBlockForm.tsx
  components/admin/blocks/forms/SystemBlockForm.tsx      ← used for hours, featured_product, branches
  components/admin/blocks/forms/SocialEmbedForm.tsx

Block rendering (shared admin + public):
  components/blocks/BlockRenderer.tsx            ← routes to Default* or custom components; checks template.components.Blocks for overrides first
  components/blocks/SafeBlockRenderer.tsx        ← error-boundary wrapper around every rendered block
  components/blocks/public/Default*.tsx          ← public block components
  components/blocks/public/DefaultSocialEmbedBlock.tsx
  components/blocks/public/DefaultContentShowcaseBlock.tsx
  components/blocks/public/MediaView.tsx         ← shared media renderer (image/video/lottie) used by image + content_showcase blocks
  components/blocks/public/ReservationBlock.tsx  ← reservation module block (read-only in canvas)
  components/blocks/public/LinkBlockClient.tsx   ← client-side interactive wrapper for link blocks
  components/blocks/public/ProductsBlockClient.tsx ← client-side interactive wrapper for product blocks
  components/blocks/public/cardStyles.ts         ← getCardClasses(), getTextColor()
  components/blocks/mrb/                        ← MRB template-specific block overrides (MrbHero, MrbQuickActions, MrbOperatingHours)

Image/media uploads in blocks:
  components/admin/blocks/BlockImageUploader.tsx    ← image upload/preview widget
  components/admin/blocks/BackgroundMediaEditor.tsx ← background media editor (used by page/canvas background settings)

Legacy block editor (deprecated — use BlockFormRenderer + CanvasStudio):
  components/admin/blocks/BlockEditor.tsx        ← older inline-expand editor, still present but superseded

Slide-over panels:
  components/admin/blocks/SlideOverPanel.tsx     ← slide-over container used by L/F/B/I shortcuts
  components/admin/blocks/panels/LinksPanel.tsx
  components/admin/blocks/panels/FormsPanel.tsx
  components/admin/blocks/panels/ProductsPanel.tsx
  components/admin/blocks/panels/SiteInfoPanel.tsx
  components/admin/blocks/panels/BrandingPanel.tsx  ← branding slide-over (no keyboard hotkey)
  components/admin/blocks/panels/HeaderNavPanel.tsx
  components/admin/blocks/panels/ChromeBottomNavProperties.tsx

Rich text:
  components/admin/blocks/rich-text/RichTextEditor.tsx
  components/admin/blocks/rich-text/Toolbar.tsx
  components/admin/blocks/rich-text/LinkSelector.tsx

Types:
  data/mockData.ts                               ← PageBlock, Page, BlockType interfaces
```
