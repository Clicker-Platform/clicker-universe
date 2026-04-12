# Clicker Platform — Design Token Audit

> Extracted 2026-04-09 from all Canvas Studio admin block forms, public block renderers, MRB template overrides, and template definitions.  
> Scope: **Canvas Studio block system** (admin property panel + public renderers + template definitions).  
> Note: §1 admin UI tokens are platform-wide conventions that Canvas Studio conforms to — not Canvas Studio-exclusive.

---

## Table of Contents

1. [Admin UI Tokens (dark theme)](#1-admin-ui-tokens-dark-theme)
2. [Card Style System (public blocks)](#2-card-style-system-public-blocks)
3. [Typography Scale](#3-typography-scale)
4. [Spacing System](#4-spacing-system)
5. [Interactive States](#5-interactive-states)
6. [Color Palette in Use](#6-color-palette-in-use)
7. [Motion and Transitions](#7-motion-and-transitions)
8. [Layout Patterns](#8-layout-patterns)
9. [Template-Level Design Decisions](#9-template-level-design-decisions)
10. [Anomalies and Inconsistencies](#10-anomalies-and-inconsistencies)

---

## 1. Admin UI Tokens (dark theme)

All admin forms use the same neutral-based dark surface system with `gray-*` (light mode) and `dark:neutral-*` (dark mode) pairs. Three const variables are **canonically defined** in `HeroForm.tsx` and `SocialEmbedForm.tsx` and duplicated (often inline) across other forms.

### Canonical tokens (3+ files)

| Token | Class string | Used in | Purpose |
|---|---|---|---|
| `inputClass` (primary) | `w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium` | HeroForm (const), SocialEmbedForm (const), ButtonForm (inline ×2) | Standard text/url input |
| `labelClass` | `block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1` (or `mb-2`) | HeroForm (const), SocialEmbedForm (const), ButtonForm, MapForm, ImageGalleryBlockForm, FAQForm, LinkBlockForm, ProductsForm, SystemBlockForm (all inline) | Field label above inputs |
| `sectionClass` | `p-3 bg-gray-100/50 dark:bg-neutral-900/50 rounded-xl border border-gray-200 dark:border-neutral-800 space-y-3` | HeroForm (const, used for button sub-panels + toggle panel) | Subsection grouping container |
| Item card | `p-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl border border-gray-300 dark:border-neutral-700 relative group shadow-sm` | FAQForm (item rows), SocialEmbedForm (item rows) | Repeatable list item container |
| Empty state | `text-center py-10 bg-gray-100/50 dark:bg-neutral-900/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 text-sm` | FAQForm, SocialEmbedForm (clickable variant adds hover states), ProductsForm, ImageGalleryBlockForm | Empty placeholder for list/gallery |
| Add button (accent) | `text-xs font-bold text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20` | FAQForm, SocialEmbedForm | "Add Item" / "Add Embed" action |
| Delete button (overlay) | `absolute top-2 right-2 p-1.5 bg-gray-200 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-red-400 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-all active:scale-90` | FAQForm, SocialEmbedForm | Per-row delete — hover-reveal |
| System block notice | `bg-blue-500/5 rounded-2xl p-5 border border-blue-500/10` | SystemBlockForm, QuickActionsBlockForm | "Dynamic system block" info banner |
| System notice headline | `font-black text-blue-400 text-xs uppercase tracking-widest mb-2` | SystemBlockForm, QuickActionsBlockForm | Banner title |
| Manage content link | `flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-200 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all active:scale-[0.98]` | SystemBlockForm, QuickActionsBlockForm, BlockFormRenderer (module default) | "Edit …" navigation link button |
| Section divider heading | `font-bold text-neutral-900 dark:text-neutral-200 text-xs uppercase tracking-wider mb-4` | SystemBlockForm, QuickActionsBlockForm | Sub-header above manage-content area |
| Loading spinner wrapper | `py-12 bg-gray-100/30 dark:bg-neutral-900/30 rounded-2xl border border-gray-200/50 dark:border-neutral-800/50 flex flex-col items-center justify-center gap-3` | ProductsForm, LinkBlockForm | Full-area loading state container |
| Loading skeleton line | `h-4 bg-gray-100 dark:bg-neutral-800 rounded w-1/3` (also `h-10`, `h-32`) | BlockFormRenderer (`FormSkeleton`) | Pulse-skeleton during lazy form load |
| Segmented control track | `flex gap-1 p-1 bg-gray-50 dark:bg-neutral-900 rounded-xl border border-gray-200 dark:border-neutral-800` | HeroForm (title size + alignment pickers) | Toggle button group container |
| Segmented control — active | `bg-blue-600 text-white shadow` | HeroForm | Active segment pill |
| Segmented control — inactive | `text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800` | HeroForm | Inactive segment pill |

### Local tokens (1–2 files)

| Token | Class string | Used in | Notes |
|---|---|---|---|
| `inputClass` (lighter surface) | `w-full px-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-bold text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none` | QuickActionsBlockForm, SystemBlockForm, ProductsForm, MapForm | Lighter `gray-50/neutral-900` bg; `py-2` not `py-2.5`; `font-bold` |
| `labelClass` (with icon slot) | `flex items-center gap-2 text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2` | QuickActionsBlockForm | Flex row label with leading lucide icon |
| `inputClass` (nested in item card) | `w-full px-4 py-2.5 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm ... focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium` | SocialEmbedForm (inside item cards), FAQForm (question field) | `bg-white/neutral-900` for contrast inside neutral-800 card |
| Select dropdown | `w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium appearance-none cursor-pointer` | ButtonForm (×2), LinkBlockForm | `appearance-none` removes browser arrow — no custom chevron rendered |
| Color swatch trigger | `w-8 h-8 rounded-lg border border-gray-400 dark:border-neutral-600 cursor-pointer overflow-hidden flex-shrink-0 relative` | HeroForm (`ColorInput`) | Wraps hidden `<input type="color">` |
| Hex text input | `flex-1 px-3 py-1.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-xs text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 outline-none focus:border-blue-500 font-mono` | HeroForm | Companion hex field; `rounded-lg` not `rounded-xl` |
| Toggle switch track | `relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-blue-600' : 'bg-gray-300 dark:bg-neutral-700'}` | HeroForm | Boolean on/off toggle |
| Toggle switch knob | `absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}` | HeroForm | Toggle thumb |
| Focal point container | `relative w-full rounded-xl overflow-hidden cursor-crosshair select-none border border-gray-300 dark:border-neutral-700` | HeroForm | Image focal-point drag area |
| Dashed add button (blue hover) | `w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-bold text-neutral-400 dark:text-neutral-500 hover:text-blue-400 hover:border-blue-500/50 transition-all` | HeroForm (primary CTA add) | Dashed affordance — blue hover |
| Dashed add button (neutral hover) | Same + `hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-600` | HeroForm (secondary CTA add) | Dashed affordance — neutral hover |
| Platform badge | `text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformBadge[p]}` | SocialEmbedForm | TikTok / Instagram / YouTube inline chip |
| Error notice | `p-4 bg-red-500/10 border border-red-500/20 rounded-xl` | QuickActionsBlockForm, LinkBlockForm | Empty-links / error notice |
| Layout toggle (active) | `flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-bold transition-all bg-blue-500/10 border-blue-500/40 text-blue-400` | QuickActionsBlockForm | Active layout selector |
| Layout toggle (inactive) | Same base + `bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-700` | QuickActionsBlockForm | Inactive layout selector |
| Gallery thumbnail grid | `grid grid-cols-2 sm:grid-cols-3 gap-4` | ImageGalleryBlockForm | Thumbnail preview grid |
| Gallery tile | `group relative aspect-square bg-gray-100 dark:bg-neutral-900 rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-inner` | ImageGalleryBlockForm | Individual thumbnail container |
| Gallery tile overlay | `absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2` | ImageGalleryBlockForm | Hover action overlay |
| Cover badge | `absolute top-2 left-2 bg-yellow-500 text-black text-[9px] font-black px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 border border-yellow-600/20` | ImageGalleryBlockForm | "COVER" star marker |
| Product row (selected) | `p-3 rounded-xl border cursor-pointer flex items-center gap-4 transition-all active:scale-[0.98] border-blue-500 bg-blue-500/10 shadow-blue-500/20` | ProductsForm | Selected product card |
| Product row (default) | `p-3 rounded-xl border cursor-pointer flex items-center gap-4 transition-all active:scale-[0.98] border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800` | ProductsForm | Unselected product card |
| Link visibility row (visible) | `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700` | QuickActionsBlockForm | Link row — visible state |
| Link visibility row (hidden) | Same + `opacity-50 bg-gray-100/30 dark:bg-neutral-900/30 border-gray-200/50 dark:border-neutral-800/50` | QuickActionsBlockForm | Link row — hidden/dimmed state |
| LayoutVariantPicker container | `mb-6 p-4 bg-gray-100 dark:bg-neutral-800 rounded-2xl border border-gray-300 dark:border-neutral-700 shadow-sm` | LayoutVariantPicker | Outer wrapper |
| Variant button (active) | `relative flex flex-col items-center justify-center p-3 rounded-xl border text-sm font-bold transition-all group border-blue-500 bg-gray-200 dark:bg-neutral-700 text-blue-400 shadow-lg` | LayoutVariantPicker | Selected layout option |
| Variant button (inactive) | Same base + `border-transparent bg-gray-100/50 dark:bg-neutral-900/50 text-neutral-400 dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300 shadow-sm` | LayoutVariantPicker | Unselected layout option |
| Variant button (disabled) | Same base + `border-transparent bg-gray-100/30 dark:bg-neutral-900/30 text-neutral-400 dark:text-neutral-700 cursor-not-allowed opacity-50` | LayoutVariantPicker | Disabled/coming-soon variant |
| Active checkmark dot | `absolute top-1.5 right-1.5 w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center shadow-sm` | LayoutVariantPicker | Active state indicator |
| "Custom" override badge | `text-[10px] font-bold text-amber-600 dark:text-amber-300 bg-amber-100/30 dark:bg-amber-900/30 px-2 py-0.5 rounded-full border border-amber-300/30 dark:border-amber-800/30 uppercase tracking-wider` | LayoutVariantPicker | User overrode template default |
| "Template default" badge | `text-[10px] font-bold text-neutral-400 dark:text-neutral-500 bg-gray-100/50 dark:bg-neutral-900/50 px-2 py-0.5 rounded-full border border-gray-300 dark:border-neutral-700 uppercase tracking-wider` | LayoutVariantPicker | Variant matches template default |
| Module block info card | `bg-gray-100 dark:bg-neutral-800 rounded-xl p-4 border border-gray-300 dark:border-neutral-700 flex items-center justify-between shadow-sm` | BlockFormRenderer (module default) | Module detection info |
| Unsupported block warning | `bg-amber-100/20 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-300/30 dark:border-amber-800/30` | BlockFormRenderer | Fallback for unknown block type |
| Map preview wrapper | `rounded-2xl overflow-hidden border border-gray-300 dark:border-neutral-700 h-[220px] bg-gray-50 dark:bg-neutral-900 mt-4 shadow-inner ring-1 ring-black/5 dark:ring-white/5` | MapForm | Admin embedded map preview |
| Map input (icon-prefixed) | `w-full pl-11 pr-4 py-2 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl text-sm font-bold ... focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none` | MapForm | Input with left-side MapPin icon space |
| TextForm editor wrapper | `min-h-[200px] rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-gray-100/50 dark:bg-neutral-900/50` | TextForm | RichTextEditor container |
| TextForm loading placeholder | `h-[200px] w-full bg-gray-100/50 dark:bg-neutral-900/50 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 gap-3` | TextForm | Suspense fallback while editor loads |

---

## 2. Card Style System (public blocks)

**Single source of truth:** `components/blocks/public/cardStyles.ts` — `getCardClasses()` and `getTextColor()`.

### `getCardClasses(cardStyle?, extra?)`

| Style | Tailwind classes | Semantic meaning |
|---|---|---|
| `'brutalist'` (default) | `bg-white border-[3px] border-theme-border shadow-sticker overflow-hidden` | Thick CSS-var border, sticker shadow — bold/playful |
| `'clean'` | `bg-white border border-gray-200 shadow-sm` | Minimal white card, light border — professional |
| `'glass'` | `bg-black/20 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden` | Semi-transparent dark surface, blur backdrop — dark-mode |

### `getTextColor(cardStyle?, muted?)`

| Context | Normal | Muted |
|---|---|---|
| `'glass'` | `text-white` | `text-white/60` |
| `'brutalist'` / `'clean'` | `text-theme-foreground` | `text-gray-500` |

### Template → card style mapping

| Template | `cardStyle` |
|---|---|
| `classic` (Sunnyside) | `brutalist` |
| `modern` | `clean` |
| `sojourner` | `clean` |
| `shuvo` | `clean` |
| `mrb` (Mr Brightside) | `glass` |

### Dark mode application

Card styles do **not** use Tailwind `dark:` prefixes on public blocks. The `glass` style is inherently dark, designed for MRB's `background: #0a0a0a`. The `brutalist` and `clean` styles assume a light background. Dark mode is template-driven, not OS-preference-driven.

### ⚠ Blocks that bypass `getCardClasses()`

`DefaultHeroBlock` and `DefaultTextBlock` inline their own card classes instead of calling `getCardClasses()`. Their glass variant uses `bg-white/5` instead of the canonical `bg-black/20`:

```
// cardStyles.ts (canonical)
glass → bg-black/20 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden

// DefaultHeroBlock.tsx:82 + DefaultTextBlock.tsx:19 (inline deviation)
glass → bg-white/5 backdrop-blur-md border border-white/10 shadow-xl
```

---

## 3. Typography Scale

### Public blocks

| Role | Classes | Color | Used in |
|---|---|---|---|
| Block section H2 | `text-2xl font-black` | `getTextColor(cardStyle)` | DefaultFAQBlock |
| Hero H1 (sm) | `text-2xl md:text-3xl` | `text-theme-foreground` / `text-white` (fullbleed) | DefaultHeroBlock |
| Hero H1 (md, default) | `text-4xl md:text-5xl` | same | DefaultHeroBlock |
| Hero H1 (lg) | `text-5xl md:text-6xl` | same | DefaultHeroBlock |
| Hero H1 (xl) | `text-6xl md:text-7xl` | same | DefaultHeroBlock |
| MrbHero H1 (sm) | `text-3xl md:text-4xl` | `text-white` | MrbHero |
| MrbHero H1 (md) | `text-5xl md:text-6xl` | `text-white` | MrbHero |
| MrbHero H1 (lg, MRB default) | `text-6xl md:text-7xl` | `text-white` | MrbHero |
| MrbHero H1 (xl) | `text-7xl md:text-8xl` | `text-white` | MrbHero |
| Hero subtitle | `text-xl font-medium` | `text-gray-600` (light) / `text-theme-foreground/70` (glass) / `text-white/90` (fullbleed) | DefaultHeroBlock |
| MRB hero subtitle | `text-lg font-medium leading-relaxed max-w-md opacity-80` | `theme.colors.foreground` (inline style) | MrbHero |
| Hero tagline | `text-xs font-bold uppercase tracking-[0.2em] text-theme-foreground/50` | overridable via `style=` | DefaultHeroBlock |
| MRB tagline bubble | `text-[10px] font-bold uppercase` + `letterSpacing: '0.25em'` | `theme.colors.primary` (inline style) | MrbHero |
| Section heading label | `text-slate-400 text-xs font-bold uppercase tracking-[0.2em]` | `text-slate-400` | DefaultSocialEmbedBlock, MrbQuickActions |
| FAQ H2 | `text-2xl font-black` | `getTextColor(cardStyle)` | DefaultFAQBlock |
| FAQ question (grid) | `font-bold text-base mb-3 leading-snug` | `getTextColor(cardStyle)` | DefaultFAQBlock |
| FAQ question (accordion/list) | `font-bold text-lg` | `getTextColor(cardStyle)` | DefaultFAQBlock |
| FAQ answer | `text-sm leading-relaxed` | `getTextColor(cardStyle, true)` | DefaultFAQBlock |
| Prose body | `font-medium text-[15px] leading-[1.65] sm:text-[16px] md:text-[18px] md:leading-[1.75]` | `text-theme-foreground` | DefaultTextBlock |
| Prose headings | `prose-headings:font-heading prose-headings:text-[var(--theme-foreground)] prose-headings:mt-8 prose-headings:mb-4` | CSS var | DefaultTextBlock |
| Prose links | `prose-a:text-[var(--theme-primary)]` | CSS var | DefaultTextBlock |
| Image caption (standard/full-width) | `text-center text-sm font-bold mt-3 italic` | `text-gray-500` / `text-white/50` (glass) | DefaultImageBlock |
| Image caption (rounded-card) | `text-center text-sm font-medium` | `text-gray-600` / `text-white/70` (glass) | DefaultImageBlock |
| Image caption (side-caption) | `text-lg font-medium italic leading-relaxed` | `text-gray-700` / `text-white/70` (glass) | DefaultImageBlock |
| Map address | `text-sm font-medium line-clamp-1` | `getTextColor(cardStyle)` | DefaultMapBlock |
| Map directions link | `text-xs font-semibold text-[var(--theme-primary)]` | CSS var | DefaultMapBlock |
| CTA button (hero) | `text-sm font-bold` | `text-white` / `text-gray-900` | DefaultHeroBlock `CtaButtons` |
| MRB CTA button | `text-sm font-bold uppercase tracking-wide` | `theme.colors.background` (inline) | MrbHero |
| Quick-action title | `text-white font-bold text-lg` | `text-white` | MrbQuickActions |
| Quick-action subtitle | `text-slate-500 text-sm` | `text-slate-500` | MrbQuickActions |
| Operating hours heading | `text-white text-2xl font-black` | `text-white` | MrbOperatingHours |
| Operating hours day label | `text-slate-500` | `text-slate-500` | MrbOperatingHours |
| Operating hours value | `text-white font-bold` | `text-white` | MrbOperatingHours |

### Admin UI

| Role | Classes | Used in |
|---|---|---|
| Field label | `text-xs font-medium text-neutral-400 dark:text-neutral-500` | All forms |
| Section notice headline | `font-black text-blue-400 text-xs uppercase tracking-widest` | SystemBlockForm, QuickActionsBlockForm |
| Section notice body | `text-sm text-neutral-400 leading-relaxed` | SystemBlockForm, QuickActionsBlockForm |
| Section divider heading | `font-bold text-neutral-900 dark:text-neutral-200 text-xs uppercase tracking-wider` | SystemBlockForm, QuickActionsBlockForm |
| Help text / hint | `text-xs text-neutral-400 dark:text-neutral-500 font-medium` | Multiple forms |
| Micro hint (10px) | `text-[10px] text-neutral-400 dark:text-neutral-600 font-mono` | HeroForm (focal point coords) |
| Loading label | `text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-widest` | ProductsForm |
| Button section label (primary) | `text-xs font-bold text-blue-400 uppercase tracking-wider` | HeroForm |
| Button section label (secondary) | `text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider` | HeroForm |

---

## 4. Spacing System

### Admin forms

| Pattern | Class | Context |
|---|---|---|
| Form root stack (default) | `space-y-4` | Most forms |
| Form root stack (wider) | `space-y-6` | ProductsForm, SystemBlockForm, QuickActionsBlockForm |
| Item list stack | `space-y-3` | FAQForm, SocialEmbedForm |
| Link row list | `space-y-1.5` | QuickActionsBlockForm |
| Input padding (primary) | `px-4 py-2.5` | Primary `inputClass` |
| Input padding (lighter variant) | `px-4 py-2` | QuickActionsBlockForm, SystemBlockForm, ProductsForm, MapForm |
| Section panel | `p-3` | `sectionClass` (HeroForm sub-panels) |
| Item card | `p-4` | FAQForm, SocialEmbedForm |
| System notice | `p-5` | SystemBlockForm, QuickActionsBlockForm |
| Layout picker | `p-4 mb-6` | LayoutVariantPicker |
| Variant grid gap | `gap-2` | LayoutVariantPicker |
| Gallery grid | `grid-cols-2 sm:grid-cols-3 gap-4` | ImageGalleryBlockForm |
| Product grid | `grid-cols-1 sm:grid-cols-2 gap-3 max-h-72` | ProductsForm |
| Two-col form | `grid grid-cols-1 md:grid-cols-2 gap-4` | ButtonForm |
| Map admin preview | `h-[220px]` | MapForm |
| Divider (small) | `pt-4 border-t border-gray-200 dark:border-neutral-800` | QuickActionsBlockForm |
| Divider (large) | `pt-6 border-t border-gray-200 dark:border-neutral-800` | SystemBlockForm |

### Public blocks

| Pattern | Class | Context |
|---|---|---|
| Block padding (responsive) | `p-6 md:p-10` | DefaultFAQBlock, DefaultTextBlock (all variants) |
| Hero padding (centered) | `py-16 px-6` | DefaultHeroBlock centered |
| Hero padding (split content) | `p-8 md:p-12` | DefaultHeroBlock split |
| Hero fullbleed content | `p-6 max-w-4xl mx-auto` | DefaultHeroBlock fullbleed |
| Image block (standard) | `px-4 md:px-8 py-6 max-w-5xl mx-auto` | DefaultImageBlock |
| Image block (side-caption) | `p-6 md:p-12 max-w-6xl mx-auto` | DefaultImageBlock |
| Image block (rounded-card) | `p-4 md:p-8` | DefaultImageBlock |
| Text highlight-box | `py-12 px-4 md:px-8 max-w-5xl mx-auto` wrapper + `p-8 md:p-12` content | DefaultTextBlock |
| FAQ grid | `grid-cols-1 md:grid-cols-2 gap-6` | DefaultFAQBlock |
| FAQ grid item | `p-6 rounded-xl` | DefaultFAQBlock |
| FAQ accordion stack | `space-y-4` | DefaultFAQBlock |
| FAQ simple-list stack | `space-y-6` | DefaultFAQBlock |
| CTA button group | `flex flex-wrap gap-3 mt-6` | DefaultHeroBlock `CtaButtons` |
| MRB CTA group | `flex flex-wrap gap-4` | MrbHero |
| CTA button size | `px-6 py-2.5` | DefaultHeroBlock |
| MRB CTA button size | `px-6 py-3` | MrbHero |
| Map full embed | `h-[500px]` | DefaultMapBlock `embed-full` |
| Map card embed | `h-[300px]` | DefaultMapBlock `card-with-address` |
| MRB hero | `h-[560px]` (fixed) + `pb-16 px-6 md:px-12` | MrbHero |
| Gallery desktop grid | `hidden md:grid grid-cols-2 gap-2` | DefaultImageGalleryBlock |
| Social embed carousel gap | `gap-4 pb-4 pt-2` | DefaultSocialEmbedBlock |
| Social embed card width | `w-[80%] max-w-[280px] sm:w-[320px] shrink-0` | DefaultSocialEmbedBlock |
| Max-width (hero centered) | `max-w-3xl mx-auto` | DefaultHeroBlock |
| Max-width (hero fullbleed) | `max-w-4xl mx-auto` | DefaultHeroBlock |
| Max-width (prose text) | `max-w-4xl mx-auto` | DefaultTextBlock |
| Max-width (highlight-box) | `max-w-5xl mx-auto` | DefaultTextBlock |
| Max-width (image standard) | `max-w-5xl mx-auto` | DefaultImageBlock |
| Max-width (image side-caption) | `max-w-6xl mx-auto` | DefaultImageBlock |
| Operating hours outer | `py-8` | MrbOperatingHours |
| Operating hours card | `p-8` | MrbOperatingHours |

---

## 5. Interactive States

### Inputs (admin)

| State | Classes |
|---|---|
| Focus | `focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none` |
| Focus (no ring, minimal) | `focus:border-blue-500 outline-none` (ColorInput text field, LinkBlockForm select) |
| Default border (primary) | `border border-gray-300 dark:border-neutral-700` |
| Default border (secondary) | `border border-gray-200 dark:border-neutral-800` |
| Placeholder | `placeholder-neutral-400 dark:placeholder-neutral-600` |

### Buttons — admin

| State | Classes | Element |
|---|---|---|
| Hover (add accent) | `hover:text-blue-300` | Add Item / Add Embed |
| Hover (manage link) | `hover:bg-gray-200 dark:hover:bg-neutral-700` | Manage Content link |
| Hover (delete icon) | `hover:text-red-400` | Per-row trash icon |
| Hover (dashed add — blue) | `hover:text-blue-400 hover:border-blue-500/50` | HeroForm add primary btn |
| Hover (dashed add — neutral) | `hover:text-neutral-700 dark:hover:text-neutral-300 hover:border-gray-400 dark:hover:border-neutral-600` | HeroForm add secondary btn |
| Active press (small) | `active:scale-90` | Delete icon buttons |
| Active press (standard) | `active:scale-[0.98]` | Manage link, product cards |
| Active press (upload btn) | `active:scale-95` | ImageGalleryBlockForm upload |
| Disabled | `disabled:opacity-40 disabled:cursor-not-allowed` | SocialEmbedForm add (max reached) |
| Disabled (upload) | `disabled:opacity-50` | ImageGalleryBlockForm add (max reached) |
| Group-hover reveal | `opacity-0 group-hover:opacity-100` | Delete button on item cards |

### LayoutVariantPicker buttons

| State | Classes |
|---|---|
| Active | `border-blue-500 bg-gray-200 dark:bg-neutral-700 text-blue-400 shadow-lg` |
| Inactive | `border-transparent bg-gray-100/50 dark:bg-neutral-900/50 text-neutral-400 dark:text-neutral-500 shadow-sm` |
| Inactive hover | `hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300` |
| Disabled | `border-transparent bg-gray-100/30 dark:bg-neutral-900/30 text-neutral-400 dark:text-neutral-700 cursor-not-allowed opacity-50` |

### Public blocks

| State | Classes | Element |
|---|---|---|
| CTA primary hover | `hover:opacity-90` | Hero CTA primary |
| CTA secondary hover (glass) | `hover:bg-white/10` | Hero CTA secondary dark |
| CTA secondary hover (light) | `hover:bg-black/5` | Hero CTA secondary light |
| CTA press | `active:scale-[0.98]` | Hero CTAs, MRB CTAs |
| Button block hover (brutalist) | `hover:-translate-y-1 hover:shadow-lg` | DefaultButtonBlock |
| Button block hover (clean/glass) | `hover:-translate-y-0.5 hover:shadow-lg` | DefaultButtonBlock |
| Gallery tile hover | `group-hover:scale-105 transition-all duration-500` | DefaultImageGalleryBlock thumbnail |
| Gallery tile hover (brutalist) | `hover:shadow-none hover:translate-y-[2px] hover:translate-x-[2px]` | DefaultImageGalleryBlock tile |
| Gallery overlay reveal | `opacity-0 group-hover:opacity-100 transition-opacity` | DefaultImageGalleryBlock overlay |
| MRB quick-action hover | `hover:bg-primary/10` | MrbQuickActions card |
| MRB icon hover | `group-hover:scale-110 transition-transform` | MrbQuickActions icon |
| Map link hover | `hover:opacity-80 transition-opacity` | DefaultMapBlock directions link |
| FAQ summary hover | `hover:opacity-80 transition-opacity` | DefaultFAQBlock summary |
| FAQ chevron open | `transition group-open:rotate-180` | DefaultFAQBlock chevron |

---

## 6. Color Palette in Use

### CSS variables — public (template-driven)

| Variable | Role |
|---|---|
| `var(--theme-primary)` | Brand accent, CTA buttons, link color in prose, border-left accents |
| `var(--theme-foreground)` | Primary text on all templates |
| `var(--theme-background)` | Page background; CTA button text on brutalist |
| `var(--theme-border)` | Card border for brutalist cards |
| `var(--theme-radius)` | Corner radius for all public blocks (set per template) |

### Explicit Tailwind colors — admin

| Color | Role |
|---|---|
| `neutral-800` | Input background, item card background (dark) |
| `neutral-700` | Input border (dark), delete button bg (dark) |
| `neutral-500` | Hint text, icon color (dark) |
| `neutral-400` | Label text, placeholder-ish |
| `neutral-200` | Input text, primary text (dark mode) |
| `neutral-900/50` | sectionClass bg (dark), empty state bg (dark) |
| `gray-100` | Input bg (light), item card bg (light), skeleton lines |
| `gray-50` | Lighter input bg (QuickActions, Map, LinkBlock) |
| `gray-300` | Input border (light) |
| `gray-200` | Secondary border (light), delete button bg (light) |
| `blue-600` | Active toggle/segment bg |
| `blue-500` | Focus ring, add-item accent, spinner, active variant border |
| `blue-400` | Blue muted text on dark (section labels, active toggle text) |
| `blue-500/10` | Add button bg, active layout toggle bg, system notice bg |
| `red-400` | Destructive hover (delete icons) |
| `red-500/10` + `red-500/20` | Error notice bg + border |
| `amber-*` | "Custom" override badge + unsupported block warning |
| `yellow-500` | Gallery cover badge |
| `pink-500/20` + `pink-300` | TikTok platform badge |
| `purple-500/20` + `purple-300` | Instagram platform badge |
| `red-500/20` + `red-300` | YouTube platform badge |

### Explicit Tailwind colors — public blocks

| Color | Role |
|---|---|
| `white` / `white/60–90` | Glass text and muted glass text |
| `white/5` | Text block / hero glass surface (deviation from canonical `black/20`) |
| `white/10` | Glass card border, MRB gallery tile border |
| `black/20` | Canonical glass card bg (`getCardClasses`) |
| `black/40–50` | Map overlay, gallery hover overlay, MRB loading overlay |
| `black/60` | Fullbleed hero gradient end |
| `gray-100` | Map iframe bg, standard image bg placeholder |
| `gray-200` | Clean card border |
| `gray-500` | Muted caption text (non-glass) |
| `gray-600–700` | Subtitle / body text (clean/brutalist) |
| `slate-400` | Section label in social embed + MRB quick-actions |
| `slate-300/500` | MRB operating hours schedule text |
| `green-400/500` | "Open Now" badge (MrbOperatingHours) |
| `red-400/500` | "Closed" badge (MrbOperatingHours) |
| `neutral-100/800` | Social embed placeholder (light/dark mode) |

---

## 7. Motion and Transitions

### Transition utilities

| Class | Used in | Element |
|---|---|---|
| `transition-all` | All form inputs, variant picker buttons, product/link rows | General catch-all |
| `transition-colors` | Add/delete buttons, visibility toggles | Color-only changes |
| `transition-opacity` | MrbOperatingHours badge, FAQ accordion, gallery overlay | Opacity changes |
| `transition-transform` | HeroForm toggle knob, MRB icon, gallery thumbnail | Transform-only |

### Durations and animations

| Class | Used in | Element |
|---|---|---|
| `duration-500` | DefaultImageGalleryBlock GalleryTile | Hover scale on thumbnail |
| `animate-spin` | `<Loader2>` across BlockFormRenderer, ProductsForm, ImageGalleryBlockForm, QuickActionsBlockForm, LinkBlockForm | Loading spinners |
| `animate-pulse` | `FormSkeleton` in BlockFormRenderer | Loading skeleton bars |
| `animate-in fade-in slide-in-from-top-1` | DefaultFAQBlock accordion answer | Content entry animation |
| `animate-fade-in` | SystemBlockForm, QuickActionsBlockForm root div | Form entry (custom utility) |
| `shimmer 1.4s infinite linear` (inline `style=`) | DefaultImageGalleryBlock shimmer overlay | Custom shimmer (requires keyframe definition) |
| `transition-opacity duration-300` | MrbOperatingHours status badge on mount | Deferred visibility reveal |

### Transform interactions

| Class | Used in | Element |
|---|---|---|
| `hover:-translate-y-1 hover:shadow-lg` | DefaultButtonBlock (brutalist) | Button lift |
| `hover:-translate-y-0.5 hover:shadow-lg` | DefaultButtonBlock (glass/clean) | Softer button lift |
| `group-hover:scale-105` | DefaultImageGalleryBlock | Thumbnail zoom |
| `group-hover:scale-110` | MrbQuickActions icon | Icon pop |
| `hover:translate-y-[2px] hover:translate-x-[2px]` | DefaultImageGalleryBlock (brutalist tile) | Sticker push-down |
| `active:scale-90` | Delete buttons | Hard press |
| `active:scale-[0.98]` | Manage links, product cards, hero CTAs, MRB CTAs | Gentle press |
| `active:scale-95` | ImageGalleryBlockForm upload button | Upload press |
| `group-open:rotate-180` | DefaultFAQBlock chevron | Accordion toggle |
| `transform -rotate-1` | DefaultHeroBlock H1 (brutalist only) | Slight brand-personality tilt |
| `translate-x-0` / `translate-x-4` | HeroForm toggle knob | On/off toggle thumb |

---

## 8. Layout Patterns

### Admin form layouts

| Pattern | Classes | Used in |
|---|---|---|
| Single-column stack | `space-y-4` / `space-y-6` | All forms (root) |
| Two-column responsive | `grid grid-cols-1 md:grid-cols-2 gap-4` | ButtonForm |
| Full-span in two-col | `md:col-span-2` | ButtonForm fields |
| Gallery thumbnail grid | `grid grid-cols-2 sm:grid-cols-3 gap-4` | ImageGalleryBlockForm |
| Product grid | `grid grid-cols-1 sm:grid-cols-2 gap-3` | ProductsForm |
| Variant picker grid | `grid grid-cols-2 lg:grid-cols-3 gap-2` | LayoutVariantPicker |
| Section header row | `flex justify-between items-center` | FAQForm, SocialEmbedForm, ImageGalleryBlockForm |
| Layout toggle row | `flex gap-2` | QuickActionsBlockForm |

### Public block layouts

| Pattern | Classes | Used in |
|---|---|---|
| Hero split (stacks mobile) | `flex flex-col md:flex-row items-stretch` | DefaultHeroBlock split |
| Hero fullbleed | `relative w-full h-[60vh] min-h-[400px] flex items-center justify-center overflow-hidden` | DefaultHeroBlock fullbleed |
| Image side-caption | `flex flex-col md:flex-row items-center gap-8` | DefaultImageBlock |
| Image caption sidebar | `w-full md:w-1/3` | DefaultImageBlock side-caption |
| FAQ grid | `grid grid-cols-1 md:grid-cols-2 gap-6` | DefaultFAQBlock |
| Gallery desktop grid | `hidden md:grid grid-cols-2 gap-2` | DefaultImageGalleryBlock |
| Gallery mobile cover | `md:hidden w-full` | DefaultImageGalleryBlock |
| Social horizontal scroll | `flex gap-4 overflow-x-auto snap-x snap-mandatory pb-4 pt-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]` | DefaultSocialEmbedBlock |
| MRB hero (bottom-anchored) | `relative flex h-[560px] flex-col gap-6 justify-end` | MrbHero |
| MRB quick-actions list | `flex flex-col gap-3` | MrbQuickActions |
| MRB quick-actions grid | `grid grid-cols-1 sm:grid-cols-3 gap-4` | MrbQuickActions |
| MRB operating hours row | `flex flex-col md:flex-row md:items-center justify-between gap-6` | MrbOperatingHours |

### Border radius conventions

All public blocks set `borderRadius` via `style={{ borderRadius: 'var(--theme-radius)' }}`. Per template:

| Template | `--theme-radius` value |
|---|---|
| `classic` | `1.5rem` |
| `modern` | `1rem` |
| `sojourner` | `1rem` |
| `shuvo` | `1rem` |
| `mrb` | `1rem` |

Button block: `calc(var(--theme-radius) * 0.75)` — slightly tighter than card radius.

Admin forms: `rounded-xl` (12px) for inputs/buttons, `rounded-2xl` (16px) for panels/cards, `rounded-full` for pills and icon circles.

---

## 9. Template-Level Design Decisions

### Template overview

| Template | Primary | Background | Foreground | `cardStyle` | `borderRadius` | Fonts |
|---|---|---|---|---|---|---|
| `classic` (Sunnyside) | `#B6FF2E` | `#B6FF2E` | `#0E3B2E` | `brutalist` | `1.5rem` | Jakarta / Jakarta |
| `modern` | `#FFD400` | `#FFFFFF` | `#1A1A1A` | `clean` | `1rem` | Space Mono / Space Mono |
| `sojourner` | `#00AA6C` | `#F5F7FA` | `#1C1C1C` | `clean` | `1rem` | Inter / Inter |
| `shuvo` | `#1A1A1A` | `#F5F5F0` | `#1A1A1A` | `clean` | `1rem` | Playfair / Jakarta |
| `mrb` | `#ec5b13` | `#0a0a0a` | `#f8fafc` | `glass` | `1rem` | Inter / Inter |

### Default block layouts per template

| Block | `classic` | `modern` | `sojourner` | `shuvo` | `mrb` |
|---|---|---|---|---|---|
| `hero` | `centered` | `split` | `fullbleed` | `split` | `centered` |
| `text` | `prose` | `two-column` | `prose` | `highlight-box` | `two-column` |
| `image` | `standard` | `full-width` | `standard` | `rounded-card` | `full-width` |
| `faq` | `simple-list` | `accordion` | `grid` | `accordion` | `accordion` |
| `map` | `card-with-address` | `embed-full` | `embed-full` | `card-with-address` | `embed-full` |

### Per-template `custom` config

| Template | Key | Value | Effect |
|---|---|---|---|
| `shuvo` | `bottomNavStyle` | `'minimal'` | Minimal bottom nav |
| `shuvo` | `cardOpacity` | `0.95` | Semi-transparent cards |
| `shuvo` | `heroHeight` | `'large'` | Tall hero |
| `shuvo` | `hideQuickActionsTitle` | `true` | Hides "Quick Actions" section header |
| `mrb` | `bottomNavStyle` | `'glass'` | Glass-style bottom nav |

### MRB `homeBlockOrder`

Only `mrb` defines an explicit home page block ordering (all other templates use canvas order):

```
['hero', 'quick_actions', 'branches', 'featured', 'gallery', 'hours']
```

### Template layout config

| Template | `containerWidth` | `navMode` | `showBottomNav` | Grid gap |
|---|---|---|---|---|
| `classic` | `narrow` | `mobile-only` | — | `gap-4` |
| `modern` | `boxed` | `adaptive` | — | `gap-6` |
| `sojourner` | `full` | `adaptive` | — | `gap-8` |
| `shuvo` | `tablet` | `adaptive` | `true` | `gap-4` |
| `mrb` | `boxed` | `adaptive` | `true` | `gap-6` |

---

## 10. Anomalies and Inconsistencies

### A1 — `social_embed` skips `LayoutVariantPicker`
**File:** `BlockFormRenderer.tsx:125`  
`case 'social_embed'` returns `<SocialEmbedForm>` directly, bypassing `renderWithLayoutPicker()`. Every other block goes through the picker. Intentional (social embed has no layout variants) but breaks the structural pattern — a future variant addition would require a code change in two places.

### A2 — Hero and Text blocks bypass `getCardClasses()`
**Files:** `DefaultHeroBlock.tsx:82`, `DefaultTextBlock.tsx:19`  
Both inline their own card classes. Their glass variant uses `bg-white/5` while `cardStyles.ts` specifies `bg-black/20`. `DefaultFAQBlock`, `DefaultImageBlock`, and `DefaultMapBlock` correctly use `getCardClasses()`.

```
// Canonical (cardStyles.ts)
glass → bg-black/20 backdrop-blur-md border border-white/10 shadow-xl overflow-hidden

// Inline deviation (HeroBlock + TextBlock)
glass → bg-white/5 backdrop-blur-md border border-white/10 shadow-xl
```

### A3 — Two `inputClass` variants with no shared constant
**Files:** HeroForm, SocialEmbedForm (primary: `bg-gray-100`, `py-2.5`) vs QuickActionsBlockForm, SystemBlockForm, MapForm, ProductsForm (lighter: `bg-gray-50`, `py-2`, `font-bold`). These render visibly differently and have no single source of truth — both are inline duplications.

### A4 — `labelClass` margin inconsistency
**Files:** All forms  
`HeroForm`'s const defines `mb-1`. Most other forms hardcode `mb-2` inline. QuickActionsBlockForm uses a flex-row variant with icon. Three variants exist with no shared constant.

### A5 — `select` elements have no custom chevron
**Files:** `ButtonForm.tsx`, `LinkBlockForm.tsx`  
Both use `appearance-none` to remove the native browser arrow but render no replacement. The dropdown arrow is invisible.

### A6 — `quick_actions` is not a `SystemBlockForm`
**Files:** `BlockFormRenderer.tsx:127-128`  
`hours`, `featured_product`, and `branches` all use `<SystemBlockForm>`. `quick_actions` has its own `QuickActionsBlockForm` with richer controls, creating an implicit two-tier system block category with no shared base component.

### A7 — MRB hero title scale is one step larger than Default hero
**Files:** `MrbHero.tsx:9-14`, `DefaultHeroBlock.tsx:7-12`  
MRB default title size is `lg` (`text-6xl/7xl`). DefaultHeroBlock default is `md` (`text-4xl/5xl`). Both share the same `HeroForm` editor with S/M/L/XL labels — the same label renders at different sizes depending on the active renderer. New MRB blocks should use the MRB scale.

### A8 — `DefaultSocialEmbedBlock` builds its own card class
**File:** `DefaultSocialEmbedBlock.tsx:104-109`  
Does not call `getCardClasses()`. Builds a local `baseCardClass` that omits `backdrop-blur` for glass and has different border-radius logic (`rounded-xl` for clean, `rounded-2xl` for others).

### A9 — `DefaultImageBlock` standard variant double-applies border-radius
**File:** `DefaultImageBlock.tsx:96`  
Applies both `rounded-xl` in the Tailwind class string and `style={{ borderRadius: 'var(--theme-radius)' }}` on the same element. The inline style overrides the Tailwind class, making `rounded-xl` a no-op.

### A10 — `pt-4` vs `pt-6` divider before "Manage Content"
**Files:** `QuickActionsBlockForm.tsx` (`pt-4`), `SystemBlockForm.tsx` (`pt-6`)  
Same semantic element — a divider section before the manage-content link — uses different top padding.

### A11 — MRB quick-actions uses inline `style=` for glass instead of shared utility
**File:** `MrbQuickActions.tsx:119-122`  
References `glass-effect` CSS class and also applies glass styles inline via `style={{ background: 'rgba(26,26,26,0.6)', backdropFilter: 'blur(12px)' }}`. The `glass-effect` class is a non-Tailwind CSS utility — its definition lives outside the token system audited here.

### A12 — MRB operating hours card uses hardcoded hex colors
**File:** `MrbOperatingHours.tsx:51`  
`bg-gradient-to-r from-[#262626] to-[#1a1a1a]` hardcodes surface colors instead of using `theme.colors.surface` or CSS variables. Breaks if the MRB template color palette is ever updated.
