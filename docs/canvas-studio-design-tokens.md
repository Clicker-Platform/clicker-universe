# Canvas Studio — Design Tokens

> Extracted from the Canvas Studio WYSIWYG page builder.  
> Source: `components/admin/blocks/` and related modules.  
> These tokens represent the ground truth of Canvas Studio's visual language.

---

## 1. Color Palette

### Brand / CSS Custom Properties

| Token | Value | Usage |
|---|---|---|
| `--color-brand-green` | `#B6FF2E` | Brand accent (canvas site themes) |
| `--color-brand-dark` | `#0E3B2E` | Brand dark surface |
| `--color-studio-blue` | `#2563EB` | Primary action color in Canvas Studio UI |
| `--color-studio-blue-muted` | `#3B82F6` | Hover / secondary blue variant |
| `--color-brand-white` | `#FFFFFF` | Pure white |

### Semantic Theme Variables

| Token | Light | Dark |
|---|---|---|
| `--theme-surface` | `#FFFFFF` | `#171717` (neutral-900) |
| `--theme-border` | `#E5E7EB` (gray-200) | `#262626` (neutral-800) |
| `--theme-text-primary` | `#171717` (neutral-900) | `#E5E5E5` (neutral-200) |
| `--theme-text-secondary` | `#404040` (neutral-700) | `#D4D4D4` (neutral-300) |
| `--theme-text-muted` | `#737373` (neutral-500) | `#A3A3A3` (neutral-400) |

### Tailwind Colors Used (Light / Dark)

#### Neutral / Gray Scale (UI Surfaces)

| Tailwind Token | Hex | Role |
|---|---|---|
| `gray-50` | `#F9FAFB` | Panel backgrounds (light) |
| `gray-100` | `#F3F4F6` | Input backgrounds, tag chips |
| `gray-200` | `#E5E7EB` | Borders, dividers, canvas bg |
| `gray-300` | `#D1D5DB` | Stronger borders |
| `gray-400` | `#9CA3AF` | Disabled text, placeholder |
| `neutral-700` | `#404040` | Sidebar text (dark) |
| `neutral-800` | `#262626` | Input bg (dark), panel bg |
| `neutral-900` | `#171717` | Panel bg (dark) |
| `neutral-950` | `#0A0A0A` | Canvas bg (dark), deepest surface |

#### Blue (Primary / Action)

| Tailwind Token | Hex | Role |
|---|---|---|
| `blue-300` | `#93C5FD` | Hover states, ring on hover |
| `blue-400` | `#60A5FA` | Icon color, text link |
| `blue-500` | `#3B82F6` | Borders, ring focus |
| `blue-600` | `#2563EB` | Primary button bg (`studio-blue`) |
| `blue-700` | `#1D4ED8` | Primary button hover |
| `blue-500/10` | `#3B82F6 10%` | Subtle blue background |
| `blue-500/20` | `#3B82F6 20%` | Focus ring fill |
| `blue-500/30` | `#3B82F6 30%` | Border on highlighted items |
| `blue-500/40` | `#3B82F6 40%` | Selected block ring |

#### Amber / Warning

| Tailwind Token | Role |
|---|---|
| `amber-100` | Warning bg (light) |
| `amber-400` | Warning icon, text |
| `amber-500` | Warning accent |
| `amber-500/5` | Ultra-subtle warning bg |
| `amber-500/10` | Subtle warning bg |
| `amber-500/20` | Warning border |
| `amber-700` | Warning text (dark) |
| `amber-800` | Warning text (darker) |
| `amber-900` | Warning text (darkest) |

#### Status Colors

| Token | Hex | Role |
|---|---|---|
| `green-400` | `#4ADE80` | Success icon |
| `red-400` | `#F87171` | Destructive icon |
| `red-500` | `#EF4444` | Destructive border/bg |
| `red-600` | `#DC2626` | Destructive button |
| `orange-400` | `#FB923C` | Warning accent |
| `yellow-500` | `#EAB308` | Caution indicator |

---

## 2. Typography

### Font Family

| Token | Value | Usage |
|---|---|---|
| `--font-jakarta` | Plus Jakarta Sans | Primary UI font across all of Canvas Studio |
| Fallback | `sans-serif` | System fallback |

### Font Sizes

| Tailwind | px | Usage |
|---|---|---|
| `text-[9px]` | 9px | Tiny badges only |
| `text-[10px]` | 10px | Extra-small labels |
| `text-xs` | 12px | Labels, helper text, panel section headers |
| `text-sm` | 14px | Body text, inputs, dropdowns, buttons |
| Base (16px) | 16px | Default — rarely overridden in Studio UI |

### Font Weights

| Tailwind | CSS Value | Usage |
|---|---|---|
| `font-normal` | 400 | Regular body text |
| `font-medium` | 500 | Label text, secondary info |
| `font-bold` | 700 | Buttons, titles, emphasized text |
| `font-black` | 900 | Special badges (e.g. "LIVE") |

### Text Transform & Spacing

| Class | Usage |
|---|---|
| `uppercase` | Section headers, badges, category labels |
| `tracking-wider` | Uppercase labels |
| `tracking-widest` | Maximum-spaced labels |
| `leading-relaxed` | Paragraphs and rich text areas |

### Text Colors

| Role | Light Mode | Dark Mode |
|---|---|---|
| Primary | `text-neutral-900` | `dark:text-neutral-200` |
| Secondary | `text-neutral-700` | `dark:text-neutral-300` |
| Muted / Tertiary | `text-neutral-500` | `dark:text-neutral-400` |
| Disabled | `text-neutral-400` | `dark:text-neutral-500` |
| Placeholder | `placeholder-neutral-400` | `dark:placeholder-neutral-600` |
| Link / Action | `text-blue-400` | (same or `text-blue-300`) |
| Warning | `text-amber-400` | (same) |
| Destructive | `text-red-400` | (same) |

---

## 3. Spacing

All spacing is Tailwind's 4px base grid.

### Padding

| Class | px | Usage |
|---|---|---|
| `p-1` / `px-1` / `py-1` | 4px | Tight icon buttons |
| `p-1.5` / `px-1.5` | 6px | Small icon buttons |
| `px-2` / `py-2` | 8px | Compact tags, badges |
| `px-2.5` / `py-2.5` | 10px | Form inputs (default) |
| `px-3` / `py-3` | 12px | Panel items, list rows |
| `px-4` / `py-3` | 16px / 12px | Standard buttons |
| `p-4` | 16px | Panel sections, card bodies |
| `p-5` | 20px | Larger content areas |
| `p-10` | 40px | Empty state containers |

### Gap (Flex / Grid)

| Class | px | Usage |
|---|---|---|
| `gap-0.5` | 2px | Tightest grouping |
| `gap-1` | 4px | Icon + badge pairs |
| `gap-1.5` | 6px | **Most common** — icon + label |
| `gap-2` | 8px | Button content, form rows |
| `gap-2.5` | 10px | Panel row items |
| `gap-3` | 12px | Sections within panel |
| `gap-4` | 16px | Block list items |
| `gap-5` / `gap-6` | 20px / 24px | Major section spacing |

### Margin

| Class | px | Usage |
|---|---|---|
| `mb-1` / `mb-1.5` | 4–6px | Label bottom margin |
| `mb-2` / `mb-3` | 8–12px | Field group spacing |
| `mb-4` | 16px | Section spacing |
| `mt-1` / `mt-2` | 4–8px | Top spacing |
| `my-8` | 32px | Canvas block vertical margin |

---

## 4. Border & Outline

### Border Width

| Class | Width | Usage |
|---|---|---|
| `border` | 1px | Default borders |
| `border-2` | 2px | Emphasized borders (selection) |
| `border-l-2` | 2px left | Left accent for list items |
| `border-dashed` | — | Drop targets, empty states |

### Border Colors

| State | Light | Dark |
|---|---|---|
| Default | `border-gray-200` | `dark:border-neutral-800` |
| Medium | `border-gray-300` | `dark:border-neutral-700` |
| Strong | `border-gray-400` | `dark:border-neutral-600` |
| Focus | `border-blue-500` | (same) |
| Subtle blue | `border-blue-500/30` | (same) |
| Transparent | `border-transparent` | (same) |

### Ring (Focus / Selection)

| Class | Usage |
|---|---|
| `ring-1 ring-black/10 dark:ring-white/10` | Canvas block container outline |
| `ring-1 ring-blue-500/40` | Selected block state |
| `ring-2 ring-blue-300` | Block hover ring |
| `ring-4 ring-blue-500` | Strong selection / focus |
| `focus:ring-2 focus:ring-blue-500/20` | Input focus ring |

---

## 5. Border Radius

| Tailwind | px | Usage |
|---|---|---|
| `rounded` | 4px | Tiny badges, small tags |
| `rounded-md` | 6px | Small icon buttons |
| `rounded-lg` | 8px | Standard buttons, small cards |
| `rounded-xl` | 12px | **Default** — inputs, cards, panels |
| `rounded-2xl` | 16px | Large panels, modals, drawers |
| `rounded-t-2xl` | 16px top | Bottom sheet / drawer top corners |
| `rounded-full` | 50% | Pills, avatar circles, toggle buttons |

### Theme-Configurable Radius (Canvas Blocks)

These apply to user-facing block content (not Studio UI itself):

| Size Setting | Value |
|---|---|
| `small` | `12px` |
| `medium` | `16px` |
| `large` | `24px` |

---

## 6. Shadow

| Class | Usage |
|---|---|
| `shadow-sm` | Subtle depth — cards, dividers |
| `shadow-md` | Selected block state |
| `shadow-lg` | Dropdown menus, floating elements |
| `shadow-xl` | Tooltips, popovers |
| `shadow-2xl` | Canvas block shadow, floating panels |
| `shadow-inner` | Image preview wells |
| `shadow-lg shadow-blue-500/20` | Active/selected colored shadow |

---

## 7. Opacity & Transparency

| Pattern | Usage |
|---|---|
| `bg-black/50` | Overlay backdrop |
| `bg-white/60 dark:bg-neutral-950/60` | Loading overlay |
| `blue-500/10`, `/20`, `/30`, `/40` | Layered blue fills |
| `amber-500/5`, `/10`, `/20` | Layered amber fills |
| `opacity-40` | Disabled / inactive state |
| `opacity-0` / `opacity-100` | Visibility transitions |
| `disabled:opacity-50` | Disabled button state |

---

## 8. Buttons

### Primary (Studio Blue)

```
bg-studio-blue text-white
px-4 py-1.5 (compact) | px-4 py-3 (full-width)
rounded-lg | rounded-xl
font-bold text-sm
hover:bg-studio-blue/85
transition-colors
disabled:opacity-50
```

### Secondary / Ghost

```
bg-gray-100 dark:bg-neutral-800
text-neutral-700 dark:text-neutral-300
border border-gray-300 dark:border-neutral-700
rounded-xl
px-4 py-2.5
font-bold text-sm
hover:bg-gray-200 dark:hover:bg-neutral-700
transition-all
```

### Icon Button (Compact)

```
p-1.5
rounded-md
text-neutral-400 dark:text-neutral-500
hover:text-neutral-700 dark:hover:text-neutral-200
hover:bg-gray-100 dark:hover:bg-neutral-800
transition-colors
```

### Pill / Toggle Button

```
flex items-center gap-1.5
text-xs font-bold
bg-blue-500/10
px-3 py-1.5
rounded-full
border border-blue-500/20
hover:text-blue-300
transition-colors
```

### Destructive Button

```
bg-red-500 | bg-red-600
text-white
rounded-xl px-4 py-2.5
font-bold text-sm
hover:bg-red-700
transition-colors
```

### Button States Summary

| State | Class |
|---|---|
| Hover | Background lightened or darkened |
| Active / Press | `active:scale-95` or `active:scale-[0.98]` |
| Disabled | `disabled:opacity-50` |
| Loading | Spinner: `animate-spin` replaces icon |

---

## 9. Form Inputs

### Standard Input

```
w-full
px-4 py-2.5
bg-gray-100 dark:bg-neutral-800
border border-gray-300 dark:border-neutral-700
rounded-xl
text-sm
text-neutral-900 dark:text-neutral-200
placeholder-neutral-400 dark:placeholder-neutral-600
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500
outline-none
transition-all
font-medium
```

### Textarea

Same as standard input, plus:
```
h-20 resize-none
```
Or taller: `min-h-[200px]`

### Select / Dropdown

Same as standard input, plus:
```
appearance-none cursor-pointer
```

### Label

```
block
text-xs font-medium
text-neutral-400 dark:text-neutral-500
mb-1 (or mb-2)
```

### Focus Ring Detail

```
focus:ring-2 focus:ring-blue-500/20
focus:border-blue-500
outline-none
```

---

## 10. Panels & Sidebars

### Panel Container (Desktop)

```
bg-gray-50 dark:bg-neutral-900
border-r border-gray-200 dark:border-neutral-800
overflow-y-auto
custom-scrollbar
```

### Panel Header Row

```
px-3
h-10
border-b border-gray-200 dark:border-neutral-800
flex items-center gap-2
flex-shrink-0
```

### Panel Section

```
p-3
bg-gray-100/50 dark:bg-neutral-900/50
rounded-xl
border border-gray-200 dark:border-neutral-800
space-y-3
```

### Panel Content Area

```
p-4
overflow-y-auto flex-1
custom-scrollbar
bg-gray-50 dark:bg-neutral-900
```

---

## 11. Modal / Overlay / Bottom Sheet

### Backdrop

```
fixed inset-0 z-40
bg-black/50
```

### Modal / Bottom Sheet Container

```
fixed bottom-0 left-0 right-0 z-50
bg-white dark:bg-neutral-900
rounded-t-2xl
flex flex-col
transition-transform duration-200
```

### Loading Overlay (within containers)

```
absolute inset-0 z-30
bg-white/60 dark:bg-neutral-950/60
backdrop-blur-[2px]
flex items-center justify-center
transition-opacity duration-200
```

---

## 12. Glassmorphism & Backdrop Blur

| Blur Class | Strength | Usage |
|---|---|---|
| `backdrop-blur-[2px]` | Ultra-subtle | Loading/page-switch overlay |
| `backdrop-blur-md` | Medium | Rich text toolbar floating |
| `backdrop-blur-xl` | Strong | Floating link selector popover |

Glassmorphism is used sparingly — only in floating elements overlaid on the canvas.

---

## 13. Canvas & Block Rendering

### Canvas Outer Container

```
flex-1 flex justify-center
bg-gray-200 dark:bg-neutral-950
relative overflow-y-auto
```

### Block Wrapper (Default State)

```
shadow-2xl
ring-1 ring-black/10 dark:ring-white/10
overflow-hidden
transition-all duration-300
my-8 self-start
isolate
```

### Block Wrapper — Hover State

```
hover:ring-1 hover:ring-blue-400/30
cursor-pointer
```

### Block Wrapper — Selected State

```
ring-1 ring-blue-500/40
shadow-md shadow-blue-500/20
z-20
```

---

## 14. Animation & Transition

### Standard Transitions

| Class | Usage |
|---|---|
| `transition-colors` | Color-only changes (buttons, icons) |
| `transition-all` | Full property changes (inputs, panels) |
| `transition-opacity` | Show/hide elements |
| `transition-transform` | Slide animations |
| `duration-200` | Standard duration (200ms) |
| `duration-300` | Slower (300ms) — block state changes |

### Keyframe Animations

| Class | Usage |
|---|---|
| `animate-spin` | Loading spinners |
| `animate-pulse` | Skeleton placeholders |
| `animate-in fade-in` | Entrance fade |
| `slide-in-from-top-2` | Dropdown slide-in |
| `animate-fade-in` | Custom fade entrance |

### Interactive Press Effects

| Class | Usage |
|---|---|
| `active:scale-95` | Icon button press |
| `active:scale-[0.98]` | Standard button press |
| `cursor-grab active:cursor-grabbing` | Drag handles |

---

## 15. Icons

### Sizing

| px | Usage |
|---|---|
| 12–13px | Inline with tiny text |
| 14–15px | Small button icons |
| 16px | Standard icon size |
| 18–20px | Medium icons, section headers |
| 24px | Large icons, empty states |
| 32px | Feature/illustration icons |

### Icon Wrapper (Interactive)

```
flex items-center justify-center
p-2 rounded-xl
transition-all active:scale-95
```

### Icon Color States

| State | Class |
|---|---|
| Resting | `text-neutral-400 dark:text-neutral-500` |
| Hover | `hover:text-neutral-700 dark:hover:text-neutral-200` |
| Active / Blue | `text-blue-400 hover:text-blue-300` |
| Destructive | `hover:text-red-400` |
| Muted | `text-neutral-400 dark:text-neutral-600` |

---

## 16. Z-Index Scale

| Class | Usage |
|---|---|
| `z-10` | Elevated card or overlay |
| `z-20` | Selected block on canvas |
| `z-30` | Loading overlays |
| `z-40` | Modal backdrop |
| `z-50` | Modal / bottom sheet |
| `z-[100]` | Highest priority — tooltips, pickers |

---

## 17. Custom Utility Classes

| Class | Definition |
|---|---|
| `custom-scrollbar` | Custom scrollbar styling for panel overflow areas |
| `studio-blue` | Tailwind alias for `#2563EB` |
| `studio-blue-muted` | Tailwind alias for `#3B82F6` |
| `admin-layout` | Body class toggling admin-specific background |

---

## 18. Dark / Light Mode Pattern

Canvas Studio implements dark mode at the **component level** using Tailwind's `dark:` prefix — not via CSS variables swapping.

### Pattern

Every color has an explicit dark counterpart:
```
bg-gray-100 dark:bg-neutral-800
text-neutral-700 dark:text-neutral-300
border-gray-200 dark:border-neutral-800
```

### Admin Layout Body Colors

```css
.admin-layout body { background-color: #f3f4f6; }       /* gray-100 */
.dark.admin-layout body { background-color: #0a0a0a; }  /* neutral-950 */
.dark body { color: #e5e5e5; }
.dark .text-brand-dark { color: #e5e5e5; }
```

---

## 19. Responsive / Mobile Handling

| Pattern | Usage |
|---|---|
| `hidden sm:block` | Hide on mobile, show on sm+ |
| `md:col-span-2` | Grid column spanning |
| `isMobile` prop | Switches to mobile layout (bottom sheet, tab bar) |

Canvas Studio renders a **bottom tab bar** on mobile (`MobileStudioTabBar.tsx`) instead of side panels, and uses **bottom sheets** for editing instead of side drawers.
