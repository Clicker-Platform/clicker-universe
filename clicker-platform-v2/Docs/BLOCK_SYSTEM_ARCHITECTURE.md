# Block System Architecture Analysis

## 1. Overview
The Block System enables dynamic page creation by composing pre-defined "blocks" (Hero, Text, Products, etc.) into a linear layout. It separates the **Admin Editing** experience from the **Public Rendering** logic, using a shared data model stored in Firestore.

## 2. Data Model
Blocks are stored within the `blocks` array of a `Page` document in Firestore.

**Type Definitions** (`data/mockData.ts`):
```typescript
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'reservation_cta' | 'reservation' | string;

export interface PageBlock {
    id: string;       // Unique UUID for the block instance
    type: BlockType;  // Discriminator for rendering
    data: any;        // Flexible payload specific to the block type
}

export interface Page {
    // ...
    blocks?: PageBlock[];
}
```

## 3. Admin Architecture (Editor)
The admin interface allows users to add, reorder, delete, and configure blocks.

**Key Components**:
- **`BlockManager`** (`components/admin/blocks/BlockManager.tsx`)
    - **Role**: Main container. Manages the list state of blocks.
    - **Features**:
        - Implements Drag & Drop reordering using `@dnd-kit`.
        - "Add Block" menu listing all available block types.
        - Subscribes to `subscribeToEnabledModules` to dynamically register blocks from optional modules (e.g., Reservation).
    - **Props**: `blocks: PageBlock[]`, `onChange: (blocks: PageBlock[]) => void`

- **`BlockEditor`** (`components/admin/blocks/BlockEditor.tsx`)
    - **Role**: Wrapper for individual block editing.
    - **Features**:
        - Collapsible/Expandable UI.
        - Delete and Drag handles.
        - **Form Registry**: Switches on `block.type` to render the specific form component (e.g., `<TextForm />`).
        - **Module Support**: Dynamically fetches labels and meta-info for external module blocks.

- **Block Forms** (`components/admin/blocks/forms/*`)
    - Specialized forms for editing `block.data`.
    - **Examples**:
        - `TextForm`: Simple textarea for HTML content.
        - `ProductsForm`: Selector for picking products by ID.
        - `HeroForm`: Inputs for title, subtitle, image, and CTA.

**Flow**:
User interaction in `BlockManager` updates the local `blocks` state array in `PageEditor` (`app/admin/(dashboard)/pages/[id]/page.tsx`). On "Save", this array is written to Firestore.

## 4. Public Architecture (Renderer)
The public side fetches the Page data and transforms the block definitions into React components.

**Key Components**:
- **`app/[...slug]/page.tsx` & `app/page.tsx`**
    - Fetches `Page` data from Firestore.
    - Iterates over `page.blocks[]`.
    - Computes layout classes (grid spans) using `getBlockSpan`.
    - Invokes `BlockRenderer` for each block.

- **`BlockRenderer`** (`components/blocks/BlockRenderer.tsx`)
    - **Role**: Server Component (mostly). Dispatcher.
    - **Features**:
        - Uses `next/dynamic` to lazy-load actual block components (Client Components) to optimize bundle size.
        - Switches on `block.type` to return the correct component.
        - **Fallback**: Delegates unknown types to `ModuleBlockLoader`.
    - **Safety**: Wraps execution in `SafeBlockRenderer` (Error Boundary) to prevent one bad block from crashing the whole page.

- **Public Blocks** (`components/blocks/public/*`)
    - Actual UI implementations.
    - **Data Fetching**:
        - Simple blocks (`Text`, `Hero`) use `data` directly.
        - Complex blocks (`ProductsBlock`) may perform their own server-side fetching (e.g., resolving `productIds` to full `Product` objects).
    - **Styling**: Access global theme via `TemplateProvider` hooks or CSS variables.

## 5. Extensibility (Modules)
The system supports pluggable blocks from modules (e.g., Reservation, POS).
- **Admin**: Modules register blocks via `registry.ts`. `BlockManager` automatically picks them up.
- **Public**: `BlockRenderer` falls back to `ModuleBlockLoader`, which finds the module's registered public component.

## 6. Current Block Types
| Block Type | Admin Form | Public Component | Description |
| :--- | :--- | :--- | :--- |
| `hero` | `HeroForm` | `HeroBlock` | Big banner with text & CTA |
| `text` | `TextForm` | `TextBlock` | Rich text / HTML content |
| `image` | `ImageForm` | `ImageBlock` | Single image with caption |
| `button` | `ButtonForm` | `ButtonBlock` | Standalone CTA button |
| `products` | `ProductsForm` | `ProductsBlock` | Grid of selected products |
| `faq` | `FAQForm` | `FAQBlock` | Accordion list of Q&A |
| `link` | `LinkBlockForm` | `LinkBlock` | External link card |
| `map` | `MapForm` | `MapBlock` | Google Maps embed |
| `image_gallery`| `ImageGalleryBlockForm`| `ImageGalleryBlock`| Grid of images |

## 7. Template System Compatibility
The Block System is designed to be **theme-agnostic** but **template-aware**, ensuring that blocks look good in any template (Classic, Modern, Brutalist).

### 7.1. Styling & Theming
Blocks do NOT hardcode colors or fonts. Instead, they rely on:
1.  **CSS Variables**: Injected by `TemplateProvider`.
    *   `--theme-primary`, `--theme-background`, `--theme-foreground`, `--theme-radius`, etc.
    *   Blocks use `style={{ borderRadius: 'var(--theme-radius)' }}` for dynamic shaping.
2.  **Theme Config**:
    *   Blocks consume `const { theme } = useTemplate()`.
    *   Logic switches based on `theme.cardVariant` (e.g., 'shadow' vs 'outlined') or `cardStyle` (legacy 'clean' vs 'brutalist').
    *   Example (`TextBlock.tsx`):
        ```tsx
        const isClean = theme.cardStyle === 'clean';
        // Render minimal border if Clean, bold heavy border if Brutalist
        ```

### 7.2. Layout Control (The Responsive Grid)
Blocks are placed within a CSS Grid defined by the parent page (`app/[...slug]/page.tsx`).
- **Dynamic Columns**: The grid columns (1, 2, or 3) are set by the active template's config (`template.config.layout.grid`).
- **Span Logic**: `layoutUtils.getSpan(block.type)` determines how wide a block should be.
    - `Hero`, `Map`, `Gallery` → `col-span-full` (Always full width)
    - `Newsletter`, `Contact` → `col-span-2` (Wide on desktop)
    - `Text`, `Image` → `col-span-1` (Fits in grid slots)
- **Mobile First**: All blocks default to full width (`col-span-full` effective) on mobile 1-column grids.

### 7.3. Extensibility
*   **Custom Templates**: Can override `layout.grid` to create unique block arrangements (e.g., a 4-column wide dashboard).
*   **Custom Blocks**: New blocks can legally assume the theme variables exist, ensuring they instantly match the site's look upon installation.


