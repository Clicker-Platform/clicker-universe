# Rich Text Block Upgrade: Design & Analysis

## 1. Executive Summary
The goal is to transform the `TextBlock` from a simple HTML container into a powerful "Multi-Purpose Content Block" capable of handling rich formatting, embedded media (single images, carousels), and advanced layout features.

**Recommendation**: Use **Tiptap** (Headless Editor based on ProseMirror).
**Why?**
*   **Headless**: Gives us full control over styling to make it **Theme Agnostic**. instead of hardcoding styles, we will map standard HTML tags (h1, p, blockquote) to our Template System's CSS variables (e.g., `text-[var(--theme-foreground)]`, `font-[var(--font-heading)]`).
*   **Extensible**: Supports custom "Node Views", essential for embedding complex React components (like Carousels) directly inside the text flow.
*   **Data Format**: HTML export is clean, but JSON output is robust for complex nested components if needed.

## 2. Feature Analysis

### 2.1. Basic Rich Text (Formatting)
*   **Requirement**: Bold, Italic, Headings, Lists, Links, Alignment.
*   **Solution**: Standard Tiptap extensions (`StarterKit`, `TextAlign`, `Link`).
*   **Impact**: High ease of use for content creators.

### 2.2. Single Link/Multiple Images (Inline)
*   **Requirement**: Ability to insert images directly between paragraphs.
*   **Solution**: Custom Image Extension.
    *   **Drag & Drop**: Supported via `dnd-kit` integration or simple file input.
    *   **Upload**: Need to integrate with Firebase Storage. Editor uploads file $\to$ gets URL $\to$ inserts `<img>` tag.
*   **Complexity**: Medium. Requires an upload handler in the `BlockEditor`.

### 2.3. Carousel / Gallery (Inline)
*   **Requirement**: "Multiple images (become carousel)".
*   **Analysis**: Inserting a carousel *inside* a text block is complex but powerful. It requires a "Custom Node View" in Tiptap.
    *   The editor sees a custom block `<carousel-node items="[...]">`.
    *   The renderer sees a React Component `<Carousel images={...} />`.
*   **Alternative**: Keep `ImageGalleryBlock` separate.
    *   *Pros*: Simpler data model, less nesting.
    *   *Cons*: Breaks the "flow" if you want text-gallery-text in one block.
*   **Verdict**: **Implement Inline Gallery Node**. It fulfills the "true page content" vision.

### 2.4. Pagination
*   **Requirement**: "Pagination (if not too complex)".
*   **Interpretation**: Splitting long long-form content into "pages" or "slides".
*   **Analysis**:
    *   **Web Standard**: Pagination for single articles is generally discouraged in modern UX (scrolling is better).
    *   **Complexity**: High. Requires splitting the Content HTML string into chunks and managing standard "Page 1 of X" state in the public renderer.
*   **Recommendation**: **Defer or Discard**. Instead, suggest a **"Read More" / Collapse** feature or "Table of Contents" for better navigation of long content, OR simply rely on the user adding multiple Text Blocks if they *really* want to separate content (though that's not pagination).
    *   *Alternative*: A "Slide Deck" Block Type if the goal is presentation-style content.

## 3. Technical Architecture

### 3.1. Admin Editor (`RichTextEditor.tsx`)
A new component replacing `TextForm.tsx`.
*   **Toolbar**: Sticky toolbar with formatting buttons (Bold, H1, H2, Link, Image, Gallery).
*   **Styling**: Use `tailwindcss-typography` with custom modifiers to hook into our Template System.
    *   Instead of `prose-stone` (hardcoded gray), we Configure `prose` to use `var(--theme-foreground)` and `var(--theme-primary)`.
    *   This ensures that if a user switches from "Classic" (Serif/Black) to "Neon" (Mono/Green), the rich text content updates instantly without database changes.
*   **Image Handler**: Button triggering a file picker $\to$ Upload to Firebase $\to$ Insert Node.

### 3.2. Public Renderer (`TextBlock.tsx` Upgrade)
*   **Current**: `dangerouslySetInnerHTML`.
*   **Proposed**: Continue using `dangerouslySetInnerHTML` for basic HTML, BUT for complex nodes (like inline Carousels), we might need to parse the HTML or use a library like `html-react-parser` to replace specific `<div data-type="carousel">` tags with actual React Components (`<Carousel />`).
    *   *Better Approach*: Tiptap Render-only mode? A bit heavy.
    *   *Best Approach*: Use standard HTML for everything *except* interactive components. For interactive components, use `htmr` or `html-react-parser` to hydrate them.

## 4. Implementation Plan

### Phase 1: The Foundation (Basic Formatting)
*   Install `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`.
*   Build `RichTextEditor` component with a basic Toolbar.
*   Replace `textarea` in `TextForm` with `RichTextEditor`.
*   Verify `TextBlock` still renders the output correctly (HTML compatibility).

### Phase 2: Media Integration (Images)
*   Add `@tiptap/extension-image`.
*   Implement `ImageUploader` logic in the toolbar.
*   Allow resizing/alignment of images in the editor.

### Phase 3: Advanced Nodes (Inline Carousel)
*   Create a custom Tiptap Node `GalleryNode`.
*   Implement the Admin View (Upload multiple images $\to$ Display grid in editor).
*   Implement the Public View (Hydrate `<gallery>` tags into a Swipeable Carousel).

## 5. Migration Strategy
*   Existing `TextBlock` data is simple HTML strings.
*   Tiptap `editor.setContent(htmlString)` handles legacy content perfectly.
*   **No database migration required.** simple switch-over.

---

## 6. Risk Assessment: **Medium**

*   **Regression Risk: Low**. The new editor is an isolated component. It does not touch the core logic of other blocks. Existing content is just HTML strings, which Tiptap supports natively.
*   **Implementation Risk: High**. Tiptap state management is complex (syncing JSON/HTML, cursor positions). Inline image uploading requires robust async handling.
*   **Performance Risk: Medium**. Text editors are heavy dependencies. We **must** use `next/dynamic` to lazy-load the editor only when the user clicks to edit, otherwise the Admin Page initial load will slow down.
*   **Mitigation**: Phase 1 includes strict "Lazy Loading" implementation and focuses on basic features first to ensure stability.
