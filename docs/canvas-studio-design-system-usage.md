# Canvas Studio — Design System Usage Guide

> How to apply Canvas Studio's visual language consistently across the Clicker Platform.  
> Companion to: `canvas-studio-design-tokens.md`

---

## Philosophy

Canvas Studio's UI follows these principles:

1. **Neutral base, blue action** — All surfaces are gray/neutral. Blue (`#2563EB`) is reserved for primary actions and selection states only.
2. **Explicit dark mode everywhere** — Every color class has a `dark:` counterpart. No component relies on CSS variable swaps.
3. **Rounded, not sharp** — Minimum `rounded-lg` (8px). Most UI uses `rounded-xl` (12px). Never square corners.
4. **Soft depth** — Shadows create hierarchy. No hard borders as the primary depth signal.
5. **Subtle, not flashy** — Animations are `transition-colors` / `transition-all` at 200ms. No bouncy keyframes in admin UI.
6. **Text size discipline** — Nearly all admin UI uses `text-xs` (labels) and `text-sm` (body/inputs). `text-base` (16px) rarely appears.

---

## Quick Reference Card

### Colors — Copy-Paste Classes

```
Surface (panel bg):        bg-gray-50 dark:bg-neutral-900
Surface (input bg):        bg-gray-100 dark:bg-neutral-800
Border (default):          border-gray-200 dark:border-neutral-800
Border (medium):           border-gray-300 dark:border-neutral-700
Text (primary):            text-neutral-900 dark:text-neutral-200
Text (secondary):          text-neutral-700 dark:text-neutral-300
Text (muted/label):        text-neutral-500 dark:text-neutral-400
Text (placeholder):        text-neutral-400 dark:text-neutral-500
Action color:              text-blue-400 / bg-blue-600 (studio-blue)
Focus ring:                focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
```

### Spacing — Most Used

```
Icon + label gap:          gap-1.5
Button internal gap:       gap-2
Field group spacing:       gap-3 (or space-y-3)
Section spacing:           gap-4 (or space-y-4)
Panel content padding:     p-4
Header row height:         h-10 px-3
```

### Radius — Decision Tree

```
Tiny badge / chip:         rounded (4px)
Icon button:               rounded-md (6px)
Standard button:           rounded-lg (8px)
Input / card:              rounded-xl (12px)  ← default
Large card / panel:        rounded-2xl (16px)
Bottom sheet top:          rounded-t-2xl
Pill / avatar:             rounded-full
```

---

## Component Patterns

### 1. Section Header (within a panel)

```tsx
<div className="flex items-center justify-between px-3 h-10 border-b border-gray-200 dark:border-neutral-800 flex-shrink-0">
  <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
    Section Title
  </span>
  <button className="p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
    <PlusIcon size={14} />
  </button>
</div>
```

### 2. Form Field (Label + Input)

```tsx
<div>
  <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1">
    Field Label
  </label>
  <input
    className="w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-xl text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium"
    placeholder="Enter value..."
  />
</div>
```

### 3. Primary Button

```tsx
<button className="flex items-center justify-center gap-2 bg-studio-blue text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-studio-blue/85 transition-colors disabled:opacity-50 active:scale-[0.98]">
  <SaveIcon size={14} />
  Save Changes
</button>
```

### 4. Secondary / Ghost Button

```tsx
<button className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 rounded-xl px-4 py-2.5 font-bold text-sm hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all">
  Cancel
</button>
```

### 5. Compact Icon Button

```tsx
<button className="p-1.5 rounded-md text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
  <EditIcon size={14} />
</button>
```

### 6. Panel Section Card

```tsx
<div className="p-3 bg-gray-100/50 dark:bg-neutral-900/50 rounded-xl border border-gray-200 dark:border-neutral-800 space-y-3">
  {/* content */}
</div>
```

### 7. List Row (Selectable Item)

```tsx
<div className="group flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors">
  <Icon size={14} className="text-neutral-400 dark:text-neutral-500" />
  <span className="text-sm font-medium text-neutral-900 dark:text-neutral-200 flex-1 truncate">
    Item Label
  </span>
  <button className="opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-400 hover:text-red-400 transition-all">
    <TrashIcon size={12} />
  </button>
</div>
```

### 8. Badge / Pill Tag

```tsx
{/* Info */}
<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
  Live
</span>

{/* Warning */}
<span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
  Draft
</span>
```

### 9. Modal / Bottom Sheet

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

{/* Sheet */}
<div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-neutral-900 rounded-t-2xl flex flex-col transition-transform duration-200">
  <div className="flex items-center justify-between px-4 h-14 border-b border-gray-200 dark:border-neutral-800">
    <h2 className="text-sm font-bold text-neutral-900 dark:text-neutral-200">Title</h2>
    <button className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
      <XIcon size={16} />
    </button>
  </div>
  <div className="p-4 overflow-y-auto custom-scrollbar">
    {/* content */}
  </div>
</div>
```

### 10. Loading Overlay (within a container)

```tsx
<div className="absolute inset-0 z-30 bg-white/60 dark:bg-neutral-950/60 backdrop-blur-[2px] flex items-center justify-center transition-opacity duration-200">
  <Loader2Icon size={20} className="animate-spin text-blue-500" />
</div>
```

### 11. Empty State

```tsx
<div className="flex flex-col items-center justify-center p-10 text-center">
  <div className="p-4 rounded-2xl bg-gray-100 dark:bg-neutral-800 mb-4">
    <Icon size={24} className="text-neutral-400 dark:text-neutral-500" />
  </div>
  <p className="text-sm font-bold text-neutral-700 dark:text-neutral-300 mb-1">No items yet</p>
  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">Description of what to do.</p>
  <button className="...primary button classes...">Add First Item</button>
</div>
```

### 12. Skeleton / Loading Placeholder

```tsx
<div className="animate-pulse space-y-2 p-4">
  <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-1/3" />
  <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-xl" />
  <div className="h-4 bg-gray-100 dark:bg-neutral-800 rounded w-1/2" />
  <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-xl" />
</div>
```

---

## Do's and Don'ts

### Do

- Use `rounded-xl` as your default radius for inputs, cards, and containers
- Pair every light color with a `dark:` variant
- Use `text-xs` for labels and `text-sm` for body/inputs in admin UI
- Use `transition-colors` for hover color changes, `transition-all` for layout changes
- Use `gap-1.5` for icon + text pairs
- Use `font-bold` for buttons and section headings
- Add `active:scale-[0.98]` or `active:scale-95` to interactive elements

### Don't

- Don't use `rounded-none` or `rounded-sm` in admin UI — always round corners
- Don't use colors outside the gray/neutral/blue/amber/red palette for UI chrome
- Don't use font sizes above `text-sm` in panel UI (except modal headings which can be `text-base`)
- Don't use `outline` — always replace with `outline-none` + custom `focus:ring-*`
- Don't use `border-black` or `border-white` — use semantic gray/neutral tokens
- Don't add glassmorphism (`backdrop-blur`) unless the element floats over canvas content
- Don't use brand-green (`#B6FF2E`) in admin UI — it belongs to public-facing canvas templates only

---

## Token Mapping by Use Case

### New Admin Page / Module Screen

| Element | Classes |
|---|---|
| Page wrapper | `flex flex-col flex-1 bg-gray-50 dark:bg-neutral-900` |
| Page header | `flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-900` |
| Page title | `text-sm font-bold text-neutral-900 dark:text-neutral-200` |
| Page body | `flex-1 overflow-y-auto p-6 custom-scrollbar` |
| Content card | `bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm` |

### Form / Settings Panel

| Element | Classes |
|---|---|
| Form wrapper | `space-y-4` |
| Field group | `space-y-3` |
| Section divider | `border-t border-gray-200 dark:border-neutral-800 pt-4 mt-4` |
| Section label | `text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3` |
| Submit row | `flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-neutral-800` |

### Data Table / List

| Element | Classes |
|---|---|
| Table container | `bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 overflow-hidden` |
| Table header | `px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-gray-200 dark:border-neutral-800` |
| Table row | `px-4 py-3 border-b border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition-colors` |
| Table cell | `text-sm text-neutral-700 dark:text-neutral-300` |

### Stat / Metric Card

| Element | Classes |
|---|---|
| Card | `bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-5` |
| Metric label | `text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1` |
| Metric value | `text-2xl font-bold text-neutral-900 dark:text-neutral-100` |
| Metric trend | `text-xs font-medium text-green-400` or `text-red-400` |

---

## Color Quick-Pick

When choosing a color for a new element, use this decision tree:

```
Is it a background surface?
  → Panel/sidebar: bg-gray-50 dark:bg-neutral-900
  → Card/input:    bg-gray-100 dark:bg-neutral-800
  → Deep/canvas:   bg-gray-200 dark:bg-neutral-950

Is it text?
  → Primary content:  text-neutral-900 dark:text-neutral-200
  → Secondary:        text-neutral-700 dark:text-neutral-300
  → Label/muted:      text-neutral-500 dark:text-neutral-400
  → Very muted:       text-neutral-400 dark:text-neutral-500

Is it a border/divider?
  → Default:    border-gray-200 dark:border-neutral-800
  → Emphasized: border-gray-300 dark:border-neutral-700

Is it an action / CTA?
  → Primary: bg-blue-600 (studio-blue) text-white
  → Secondary: outlined gray button
  → Danger: bg-red-500 text-white

Is it a status indicator?
  → Success: text-green-400 / bg-green-900/20
  → Warning: text-amber-400 / bg-amber-500/10
  → Error:   text-red-400 / bg-red-500/10
  → Info:    text-blue-400 / bg-blue-500/10
```
