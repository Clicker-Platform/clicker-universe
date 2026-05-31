# Canvas Studio — Complete Feature Inventory

*Clicker Platform WYSIWYG Page Builder — reference for "Introduction to Canvas Studio" presentation.*
*Compiled 2026-05-30 by reading the live editor code (`CanvasStudio.tsx`, contexts, panels, forms) — not the skill summary.*

> **Entry route:** [/admin/(dashboard)/canvas](../../clicker-platform-v2/app/admin/(dashboard)/canvas/page.tsx) — the old `/pages` route redirects here.

---

## 1. Editor Shell & Layout

A **3-panel WYSIWYG layout** (desktop) that collapses to a **bottom-sheet layout** (mobile).

- **Left rail** — icon strip (w-12) + switchable panel (w-56)
- **Center canvas** — live full-template preview (WYSIWYG)
- **Right sidebar** — properties (w-80 / 320px), collapsible to a strip

### 1.1 Left Icon Rail
- **Page-editing group** (toggles the w-56 panel): Pages `P`, Add Block `A`, Layers `Z`
- **Divider**
- **Feature-management group** (opens slide-over panels): Links `L`, Forms `F`, Products `B`, Site Info `I`, Branding `G`, Site Styles `T`, Media `M`
- Each icon shows a **hover tooltip** with label + shortcut.
- Active panel highlighted blue; clicking an active icon **toggles it closed**.

### 1.2 Keyboard Shortcuts (desktop only)
- `P A Z` → left panels (Pages / Add / Layers)
- `L F B I G T M` → slide-overs
- Suppressed while typing in inputs / textareas / contentEditable.

### 1.3 Right Sidebar
- **Header buttons:** Title & Slug, SEO & Analytics, Page Background, Close.
- Auto-syncs with selection: shows the block/chrome form when selected; page-level tabs otherwise.
- **Auto-collapses** to a 12px strip when nothing is selected and not manually opened.
- Empty state: *"Select a block on the canvas to edit its properties."*

---

## 2. The Canvas (Center / WYSIWYG Preview)

- Renders a **real full template** via `getTemplate()`:
  - Template header / NavBar (`chrome:header` — clickable)
  - Profile header (avatar/name/tagline) when present
  - All **blocks** via `BlockRenderer` (`previewMode={true}`)
  - Footer (`chrome:footer` — clickable)
  - Bottom nav (`chrome:bottomnav` — clickable, if template enables it)
- **Dotted-grid backdrop** (light/dark aware).
- **Device-view frames:** Desktop (full, min 1024px), Tablet (768px), Mobile (375–390px) — persisted in localStorage.
- **Selection ring** (blue) on the selected block; **hover guides** toggleable (`showGuides`).
- **Click-to-select** any block; click empty canvas **deselects**.
- **Auto-scroll** canvas to selected block; auto-scroll sidebar to focused field (brief blue flash).
- `pointer-events: none` on most preview children so links/buttons don't fire.
- **"Loading page…"** overlay during page switches.
- Header nav is **interactive for page-switching** in preview (internal nav switches the canvas; external links open a new tab).
- Empty-page state: *"Start adding blocks from the left panel…"*

---

## 3. Top Bar (StudioTopBar)
- Device toggle, Save, homepage controls, dirty indicator (orange dot).
- *(Mobile replaces this with the bottom tab bar — see §11.)*

---

## 4. Pages Panel (`P`)
- **Page list** — homepage first; title, `/slug`, **Home** icon on homepage.
- **New page** (+) → "create" mode.
- **Switch page** by click (with unsaved-changes guard).
- **Per-page trash** — hover trash button → inline **Confirm / Cancel**.
- **Trash drawer** (collapsible, count badge): Restore All, Empty Trash; per-item Restore / Delete permanently (confirmation dialog); relative deleted time; **restored-slug notice** on collision.
- Confirmation dialogs: *"Delete Permanently?"*, *"Empty Trash?"*.

---

## 5. Add Blocks Panel (`A`)
- **View toggle:** List ↔ Grid (persisted).
- Adding **inserts after the selected block** (or appends), auto-selects it, switches to Layers.
- **Core blocks:** Hero, Text, Content Showcase, Image, Button, Product List, FAQ, Link Card, Map, Image Gallery, Social Embeds, Heading, Feature Cards, Columns, Grid, Marquee, Testimonials, Inline Form.
- **System blocks** (auto-hydrate from settings): Quick Actions, Operating Hours, Featured Product, Branches.
- **Module-contributed blocks** appear **only when the module is enabled** (live registry) — e.g. Reservation, Digital Product Grid, POS Menu.

---

## 6. Layers Panel / Navigator (`Z`)
The page's structural tree.
- **Pinned chrome rows** (locked, not deletable): Header Navigation, Site Footer, Bottom Navigation.
- **Block tree** (dashed connector):
  - **Drag-to-reorder** (DnD-kit: mouse, touch 200ms hold, keyboard).
  - **Rename** — double-click label (Enter commit, Esc cancel; clearing → default label).
  - **Show / Hide** (Eye / EyeOff) — hidden = 40% opacity in tree, omitted on public page.
  - **Delete** — inline `<ConfirmButton>` (soft-red Confirm/Cancel).
  - **Expand / collapse** nested containers (Columns / Grid / Feature Cards).
  - **Collapse-all / Expand-all** toggle in title bar.
- Empty state: *"No blocks yet → + Add your first block."*

---

## 7. Block Property Forms (Right Sidebar)

### 7.1 Layout Variant Picker (above most forms)
- **Hero:** Centered *(Split / Fullbleed disabled — "Soon")*
- **Text:** Prose / 2-Col / Boxed
- **Image:** Standard / Full
- **FAQ:** Accordion / Grid / List
- **Map:** Embed / Card

### 7.2 Per-block forms (field-level)
- **Hero** — bg mode (Image/Color/None); desktop + optional mobile image with **drag focal-point picker** (desktop & mobile); text-color mode (Auto / Force Light / Force Dark); Tagline, Title, Subtitle (each add/remove, with size, weight, per-field color, align); Primary & Secondary CTAs (URL / Page / Form targets); button alignment.
- **Heading** — heading + size + align; optional subheading (size, bold, underline, align); vertical spacing; horizontal padding.
- **Text** — rich-text editor; vertical spacing; horizontal padding.
- **Content Showcase** — block settings (max width, row gap, vertical align, default layout, media column width, alternating row bg colors); **repeatable rows** (heading, media, rich-text, per-row layout/width override, optional CTA) — expandable, reorderable, deletable (min 1).
- **Image** — media field (image/video/lottie); caption.
- **Button** — text, open-in-new-tab, tier/variant, size, alignment; optional secondary button.
- **Product List** — section title; multi-select products (opens Products slide-over).
- **FAQ** — repeatable Question / Answer items.
- **Link Card** — pick saved link; background & border color overrides.
- **Map** — address.
- **Image Gallery** — multi-image grid (max count).
- **Social Embeds** — section title; max embeds (1–12); repeatable URL + caption.
- **Inline Form** — pick form; heading; subheading; success message; redirect URL.
- **Feature Cards** — column count + repeatable cards.
- **Columns / Grid** — nested-block containers; gaps, padding, stack-on-mobile, max width, column sizes / grid cells; **drill-down editing** of nested blocks.
- **Marquee** — repeatable items (label + icon); speed; direction; icon size; item gap.
- **Testimonials** — testimonials block form.
- **Quick Actions** (system) — section title override; layout toggle; per-link show/hide.
- **Hours / Featured Product / Branches** (system) — minimal title override; configured elsewhere.
- **Module blocks** — module info card + "Configure {module} Settings" deep-link.

---

## 8. Inline Edit Toolbar (on-canvas)
Floating toolbar above a focused Hero/Heading field (portal):
- **Title/Heading:** size (S / M / L / XL)
- **Subheading:** size (S / M / L / XL) + Bold + Underline
- **Field label** indicator
- **Alignment:** Left / Center / Right
- **Clear field** (trash)

---

## 9. Chrome Property Panels
- **Header Navigation** — style preset, variant, width, show border, typography (logo font, case/size/weight/tracking overrides), scroll behavior, advanced, link type, button label.
- **Site Footer** — footer text (saved on blur; **Global Setting**).
- **Bottom Navigation** — appearance, background color, show border-top, nav links (icon, destination, Page/Form/URL), center FAB button.

---

## 10. Slide-Over Feature Panels
- **Links (`L`)** — link-in-bio manager: add/edit (type URL/Form/Page, title, target, subtitle, **icon selector**, Hide-on-Home, Open-in-New-Tab); drag-reorder; Settings (section title, Show-on-Home); Trash (restore/empty/permanent); RBAC-gated.
- **Forms (`F`)** — form builder: title, button text, published toggle; fields (label, type, placeholder, required, options).
- **Products (`B`)** — product manager: name, price, description, images/gallery, label/category, badge (text + show), CTA (URL Button / WhatsApp Button w/ message template, button + text color), hidden toggle, section title.
- **Site Info (`I`)** — Site Identity (title, meta description, **live Google search preview**, homepage slug); Images (favicon, OG image, **live social-share preview**); Tracking Pixels (FB/GA/TikTok, collapsible); Social Media (platform picker + handle helper); Save w/ "Saved ✓".
- **Branding (`G`)** — display name, tagline, description; avatar/logo upload; global background editor.
- **Site Styles (`T`)** — index → Fonts (heading+body pack), Buttons (style pack + colors); Colors & Forms = *Coming Soon*.
- **Media (`M`)** — browse library grid; **click to copy URL** (toast); "Manage" → `/admin/media`.

---

## 11. Page-Level Settings (Right Sidebar Tabs)
- **Title & Slug** — title (auto-slug for new pages); slug (live URL preview `host/tenant/slug`).
- **SEO & Analytics** — Tracking Pixels ("Use Global"/"Overriding" toggle; FB/GA/TikTok); SEO Meta ("Use Global"/"Overriding"; meta title, description, OG image URL, **noindex** toggle).
- **Page Background** — BackgroundMediaEditor with **inherit-from-global** option.

---

## 12. Media Field & Picker (inside blocks)
- **MediaField** — type tabs **Image / Video / Lottie**; aspect ratio; object-fit; poster; **size-recommendation warning** if below recommended resolution.
- **MediaPicker** — shared modal with **Library / Upload / URL** tabs.
- Used by Image block, Content Showcase rows, rich-text image insert, background editors, single-image uploaders.

---

## 13. Rich Text Editor (Tiptap)
Toolbar (active-state highlight): Undo / Redo · Heading popover · Bold / Italic / Underline / Strikethrough · Text color popover / Highlight popover · Font size popover / Line height popover · Align L/C/R · Bullet list / Numbered list / Blockquote · Link selector · Image (MediaPicker) · Video embed.

---

## 14. State, Save & Data Integrity
- **Two contexts:** `EditorContext` (blocks, selection, device view, hover, guides) + `PageStudioContext` (page list, form data, save, dirty tracking, trash, SEO/pixels, global settings).
- **Single-owner selection model** — discriminated union (`none`/`blocks`/`slots`/`chrome`) prevents render loops.
- **Dirty tracking** — JSON-snapshot diff; orange-dot indicator.
- **Unsaved-changes guards** — `beforeunload` warning + **Save & Switch / Discard / Cancel** dialog on page switch.
- **Page cache** — LRU (10 pages) for instant switches + silent **background refresh** from Firestore.
- **Block hydration** — system/data blocks (links, products, hours, branches, reservation) via `hydratePageBlocks`.
- **Save** — slug validation (lowercase/hyphens, uniqueness), auto-name empties ("Untitled"), purge tenant cache.
- **Set / Unset homepage** (stored in `siteSettings.homepageSlug`).
- **Legacy migration** — auto-converts old HTML `content` pages and legacy homepage block order.

---

## 15. Mobile Experience
- Full-width canvas + **bottom tab bar**: Pages, Layers, Add, Properties (badge when block selected), More, + **Save** (orange when dirty).
- **Bottom sheets** replace sidebars; Properties sheet has sub-tabs (Page / SEO / Background).
- **"More"** sheet groups the feature panels (Links, Forms, Products, Site Info, Branding, Site Styles).

---

## Suggested slide grouping
1. What is Canvas Studio (WYSIWYG, block-based, multi-tenant)
2. The 3-panel layout + shortcuts (§1)
3. The live canvas + device preview (§2)
4. Pages & trash (§4)
5. Blocks: add, arrange, layer (§5, §6)
6. Editing blocks — forms, layout variants, inline toolbar (§7, §8)
7. Site-wide settings — Branding, Site Info, Site Styles, Media (§10)
8. SEO & page settings (§11)
9. Media + Rich text (§12, §13)
10. Under the hood — autosave, dirty guard, caching (§14)
11. Mobile (§15)
