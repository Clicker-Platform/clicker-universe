# Clicker Platform: Content Block Architecture

> **Version 1.0** - Detailed structure and styling rules for all Content Blocks.

This document outlines the structure, purpose, and styling conventions for all block components rendered dynamically via the `<BlockRenderer />`.

---

## 1. System Blocks (Homepage Core)

System blocks are managed via the `homeBlockOrder` in the site settings. They pull data automatically from the business profile and catalog. They heavily rely on the active template's theme context.

### `QuickActions` (`<QuickActions />`)

* **Purpose:** Primary navigation links (URLs, form links, page links). Formatted as buttons or cards. Includes logic to automatically convert "Whatsapp" or "Order" links into direct WA API links if a contact number exists.
* **Component Structure:**
  * Container (`div.space-y-4`)
  * Section Title (`h2` inside a styled `div`): Rendered conditionally based on `showOnHome` and template overrides.
  * Links: Loops through `links` array, rendering `<LinkCard />` for each.
* **Styling (`useTemplate`):**
  * `isClean` (cardStyle === 'clean'): Minimal styling.
  * `!isClean` (Brutalist): Hard borders (`border-foreground`), solid drop shadows (`boxShadow: '4px 4px 0px [color]'`).

### `OperatingHours` (`<OperatingHours />`)

* **Purpose:** Displays open/close schedule and real-time "Open Now"/"Closed" status.
* **Component Structure:**
  * Container card
  * Floating Status Badge: Positioned absolute, color changes based on real-time calculated status.
  * Title (`h3`)
  * Hours Text (`p`): Grouped into Mon-Fri and Sat-Sun strings.
* **Styling:**
  * `isClean`: Light borders, gray text, inline badge.
  * `!isClean`: Thick dark borders, rotated card (`-rotate-1`), offset overlapping badge (`rotate-6`).

### `BranchesList` (`<BranchesList />`)

* **Purpose:** Displays main business location and collapsible list of other branches.
* **Component Structure:**
  * Main Location Card: Highlights primary address with a map icon and "Get Directions" link.
  * Accordion (`button` trigger): Shows count of other locations. Expanding reveals list of secondary locations with Map and Phone links.
* **Styling:**
  * Applies template border radius. Uses high-contrast backgrounds (`bg-brand-green/10`) for the main location card in brutalist themes.

### `FeaturedProduct` (`<FeaturedProduct />`)

* **Purpose:** Highlights a 'Star Pick' with a large call to action opening the product modal.
* **Component Structure:**
  * Container holding an Image Container (`aspect-[4/3]`) and Content box.
  * Floating Badge ("Star Pick").
  * Price Tag: Absolute positioned over the image.
  * Action Button: Triggers `ProductDetailModal`.
* **Styling:**
  * Highly theme-dependent.
  * `isBold` (!clean): Uses primary color for text, foreground color for borders and solid drop shadows. Button is uppercase with heavy tracking. Image container has thick borders.
  * Clean: Soft shadows, rounded corners, standard button styling.

### `ProductsBlock` (`<ProductsBlock />` / `<ProductsBlockClient />`)

* **Purpose:** Grid of products (Gallery). Server component fetches data, Client renders it.
* **Component Structure:**
  * Server: Fetches specific `productIds` if provided in block data, else uses all pre-fetched products.
  * Client: Renders a CSS Grid (`grid-cols-[repeat(auto-fit,minmax(160px,1fr))]`).
  * Cards: Image container (4:3) on top, text details below. Clicking opens `ProductDetailModal`.
* **Styling:**
  * Maps CSS Grid gaps and card borders/shadows directly from the theme config.

---

## 2. Custom Page Blocks

These blocks are driven by a generic `data` object configured in the page builder (e.g., custom landing pages).

### `HeroBlock` (`<HeroBlock />`)

* **Purpose:** Large introductory banner.
* **Structure:** `section` wrapper. Absolute positioned `next/image` acting as a background with a gradient fade (`bg-gradient-to-t`). Relative `z-10` content containing large `title` and `subtitle`.
* **Styling:** Brutalist themes apply a slight rotation (`-rotate-1`) to the heading.

### `TextBlock` (`<TextBlock />`)

* **Purpose:** Standard rich text HTML output.
* **Structure:** Wraps content in Tailwind Typography (`prose`). The component injects CSS variables inline into the wrapper style attribute to map `prose` colors/fonts to the current Template Theme (e.g., `prose-headings:text-[var(--theme-foreground)]`).

### `ImageBlock` (`<ImageBlock />`)

* **Purpose:** Single responsive image with optional caption.
* **Structure:** A styled container holding `next/image` (`width: 100%, height: auto`).

### `ImageGalleryBlock` (`<ImageGalleryBlock />`)

* **Purpose:** A single "Cover" image that acts as a trigger to open a FullScreen gallery modal of multiple images.
* **Structure:**
  * Visual wrapper with adaptive aspect ratio (4:5 mobile, 21:9 desktop).
  * Layered background effect: The cover image is duplicated, blurred, and scaled up behind the main image to create a glowing backdrop that fills the container.
  * Overlay badge showing photo count.
  * Triggers `<FullScreenGallery />`.

### `ButtonBlock` (`<ButtonBlock />`)

* **Purpose:** Standalone call to action.
* **Structure:** Container handling alignment (left, center, right, full). `<Link>` tag for the button.
* **Styling:** Uses block `data.variant` (secondary, outline, primary) AND the theme `cardStyle` to determine exact Tailwind classes for backgrounds, borders, and hover states.

### `LinkBlock` (`<LinkBlock />` / `<LinkBlockClient />`)

* **Purpose:** Renders a stylised link card based on a specific `linkId`.
* **Structure:** Server component fetches the specific link doc from Firestore. Client component renders it using the shared `<LinkCard />` component for consistent styling with QuickActions.

### `FAQBlock` (`<FAQBlock />`)

* **Purpose:** Accordion list.
* **Structure:** Uses native HTML `<details>` and `<summary>` tags for lightweight accordion behavior. Includes chevron icons that rotate on open.

### `MapBlock` (`<MapBlock />`)

* **Purpose:** Embedded Google Map.
* **Structure:** Card container. Header showing the address string. A `300px` high container embedding a Google Maps `iframe` using the URL-encoded address.

---

## General Styling & Implementation Rules for Blocks

1. **Theme Awareness:** All blocks **must** use the `useTemplate()` hook to access `theme` (colors, fonts, cardStyle, borderRadius).
2. **Conditional Styling:** Use `const isClean = theme.cardStyle === 'clean';` to branch styling logic between modern/minimalist aesthetics and bold/brutalist aesthetics.
3. **CSS Variables:** Favor using inline styles mapping mapped to CSS variables (e.g., `style={{ borderRadius: 'var(--theme-radius)' }}`) for dynamic theme properties over trying to construct arbitrary Tailwind classes, especially for colors and fonts.
4. **Modals:** Interactive elements like Products should trigger shared components (like `<ProductDetailModal />` or `<FullScreenGallery />`) rather than building isolated modal logic.
