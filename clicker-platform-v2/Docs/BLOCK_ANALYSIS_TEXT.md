# TextBlock Component Analysis

## 1. Overview
The `TextBlock` is a fundamental content block that renders HTML text content within a themed card container. It is designed to be a "what you see is what you get" container for rich text.

## 2. Data Structure
**Type**: `'text'`

**Payload** (`block.data`):
```typescript
interface TextBlockData {
    content: string; // The HTML string to render
}
```

## 3. Admin Editing (`TextForm.tsx`)
*   **Path**: `components/admin/blocks/forms/TextForm.tsx`
*   **Interface**: A simple `textarea` input.
*   **Features**:
    *   Directly binds to `data.content`.
    *   No rich text editor (WYSIWYG) is currently implemented; it accepts raw text or HTML.
    *   Hint text: "Supports basic HTML tags."

## 4. Public Rendering (`TextBlock.tsx`)
*   **Path**: `components/blocks/public/TextBlock.tsx`
*   **Container Styling**:
    *   Uses a `<section>` wrapper.
    *   **Theme Integration**:
        *   `isClean` (Clean Theme): `border border-gray-200 shadow-sm`
        *   `!isClean` (Brutalist/Standard): `border-[3px] border-theme-border shadow-sticker`
        *   **Border Radius**: Dynamic via `style={{ borderRadius: 'var(--theme-radius)' }}`.
*   **Content Rendering**:
    *   Uses `dangerouslySetInnerHTML` to render `data.content`.
    *   **Typography**: Uses Tailwind Typography plugin (`prose prose-lg`) to automatically style headings, paragraphs, and lists.
    *   **Colors**: Text color set to `text-theme-foreground`.

## 5. Template Compatibility
*   **Grid Span**: Defaults to `col-span-1` (defined in `layoutUtils.ts`). It is designed to fit into a multi-column grid layer.
*   **Theming**: Fully compliant with `ThemeConfig`. It respects:
    *   `theme.cardStyle` (Structure)
    *   `theme.borderRadius` (Shape)
    *   `theme.colors.foreground` (Text Color)
    *   `theme.colors.border` (Border Color)

## 6. Improvement Opportunities
1.  **Rich Text Editor**: The admin form uses a raw textarea. Replacing this with a lightweight editor (like Tiptap or Quill) would safer and more user-friendly.
2.  **Alignment Controls**: No option to center or justify text (relies on HTML tags).
3.  **Background Color**: No option to override the default white background.
