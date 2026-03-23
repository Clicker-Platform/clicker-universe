---
name: admin_dark_theme
description: >
  Work with the Clicker Platform Admin Dashboard Dark Theme system.
  Use this skill whenever adding dark mode support to new admin pages or module
  admin components, debugging dark/light mode toggling, or modifying the theme
  infrastructure. Trigger on: "dark mode", "dark theme", "add dark mode",
  "admin dark", "useAdminTheme", "dark: classes", "theme toggle", or any issue
  where admin pages appear white/light when dark mode is active.
---

> **Architecture Reference:** Always read [`docs/ARCHITECTURE.md`](../../../clicker-platform-v2/docs/ARCHITECTURE.md) before making any changes.


# /admin_dark_theme — Admin Dashboard Dark Theme

The admin dashboard supports a **toggleable dark mode** that matches Canvas Studio's visual language (`bg-neutral-900/950` backgrounds, `bg-neutral-800` cards, `border-neutral-700/800` borders). The toggle is a sun/moon button in the sidebar footer.

---

## Architecture

```
globals.css
└── @custom-variant dark (&:where(.dark, .dark *))   ← registers dark: variant

lib/use-admin-theme.ts
└── useAdminTheme()   ← hook: reads/writes 'admin_dark_mode' in localStorage

app/admin/(dashboard)/layout.tsx   ← CLIENT COMPONENT
└── applies class "dark" to wrapper <div> when isDark === true

app/admin/(dashboard)/AdminSidebar.tsx
└── imports useAdminTheme(), renders Sun/Moon toggle button in footer
```

---

## Key Files

```
lib/use-admin-theme.ts                          ← dark mode hook (state + toggle)
app/globals.css                                 ← @custom-variant dark rule
app/admin/(dashboard)/layout.tsx                ← applies "dark" class to wrapper
app/admin/(dashboard)/AdminSidebar.tsx          ← toggle button (Moon/Sun icon)
```

---

## How It Works

1. `globals.css` registers the `dark:` variant to activate on any `.dark` ancestor:
   ```css
   @custom-variant dark (&:where(.dark, .dark *));
   ```

2. `useAdminTheme()` manages state in `localStorage` under key `admin_dark_mode`:
   ```typescript
   const { isDark, toggle } = useAdminTheme();
   ```

3. `layout.tsx` (a client component) applies the `dark` class:
   ```tsx
   <div className={`min-h-screen flex ... ${isDark ? 'dark bg-neutral-950' : 'bg-gray-100'}`}>
   ```

4. All child components use `dark:` variants — no props or context needed.

---

## Color Mapping

### Typography (follows Canvas Studio's neutral scale)

| Role | Light | Dark |
|------|-------|------|
| Heading / card title | `text-gray-900` | `dark:text-neutral-100` |
| Primary body | `text-gray-800` | `dark:text-neutral-200` |
| Secondary body | `text-gray-700` | `dark:text-neutral-300` |
| Description / secondary | `text-gray-600` | `dark:text-neutral-400` |
| Label / icon text | `text-gray-500` | `dark:text-neutral-500` |
| Muted / disabled | `text-gray-400` | `dark:text-neutral-600` |
| Input placeholder | `placeholder-gray-400` | `dark:placeholder-neutral-600` |
| Form field label | `text-gray-600` | `dark:text-neutral-500` |

### Layout & Surfaces

| Role | Light | Dark |
|------|-------|------|
| Page background | `bg-gray-100` | `dark:bg-neutral-950` |
| Card / panel | `bg-white` | `dark:bg-neutral-900` |
| Subtle secondary bg | `bg-gray-50` | `dark:bg-neutral-800/50` |
| Input background | `bg-white` (inputs) | `dark:bg-neutral-800` |
| Primary border | `border-gray-200` | `dark:border-neutral-800` |
| Secondary border | `border-gray-100` | `dark:border-neutral-800/50` |
| Divider | `divide-gray-100` | `dark:divide-neutral-800` |
| Hover bg | `hover:bg-gray-50` | `dark:hover:bg-neutral-800` |
| Hover bg stronger | `hover:bg-gray-100` | `dark:hover:bg-neutral-700` |
| Skeleton shimmer | `bg-gray-200/80` | `dark:bg-neutral-700/50` |

### Accents & Badges

| Role | Light | Dark |
|------|-------|------|
| Accent (blue) | `bg-blue-50` | `dark:bg-blue-950/30` |
| Accent (green) | `bg-green-50` | `dark:bg-green-950/30` |
| Accent (red) | `bg-red-50` | `dark:bg-red-950/30` |
| Badge neutral | `bg-gray-100 text-gray-500` | `dark:bg-neutral-800 dark:text-neutral-400` |
| Badge green | `bg-green-50 text-green-700` | `dark:bg-green-950/30 dark:text-green-400` |
| Badge blue | `bg-blue-100 text-blue-700` | `dark:bg-blue-950/30 dark:text-blue-400` |

**Never change:** `text-brand-green`, `bg-brand-green` — these brand accent colors work on both themes.

**Note on `text-brand-dark`:** This class is globally overridden in `.dark` scope via `globals.css` (`.dark .text-brand-dark { color: #e5e5e5 }`). Do not add per-element `dark:text-neutral-*` overrides for `text-brand-dark` — the CSS rule handles it globally.

---

## Typography Rule

**Never use green text for typography roles.** Green (`dark:text-green-*`) is reserved exclusively for semantic indicators:
- Status badges: Published, Confirmed, Paid, Active
- Success message backgrounds and their text
- Positive numeric deltas (e.g. +50 stock, +100 points)

For all other text — headings, labels, body copy, card titles, input text, captions — use the neutral scale above, mirroring Canvas Studio's pattern:

```
Heading / title  →  dark:text-neutral-100 or dark:text-neutral-200
Body text        →  dark:text-neutral-300
Labels           →  dark:text-neutral-400 or dark:text-neutral-500
Muted / hint     →  dark:text-neutral-600
```

---

## Adding Dark Mode to a New Admin Page

Add `dark:` counterparts alongside every light-theme class:

```tsx
// Before
<div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
  <h2 className="text-gray-600 font-semibold">Title</h2>
  <input className="border border-gray-200 rounded-lg px-4 py-2" />
</div>

// After
<div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
  <h2 className="text-gray-600 dark:text-neutral-400 font-semibold">Title</h2>
  <input className="border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg px-4 py-2" />
</div>
```

---

## Adding Dark Mode to a New Module Admin Page

Module admin components are inside `lib/modules/{module-id}/admin/`. They render inside the admin layout, so they automatically inherit the `.dark` class. Just add `dark:` variants to their Tailwind classes following the same mapping above.

---

## Exclusions

- **Canvas Studio** (`components/admin/blocks/`) — already uses neutral-900/800 throughout, no `dark:` needed
- **Public site blocks** (`components/blocks/public/`, `components/blocks/mrb/`) — use CSS theme variables, not gray Tailwind classes
- **Canvas Studio full-screen layout** (`pages/page.tsx`) — renders its own layout, independent of the admin dark wrapper

---

## `useAdminTheme()` API

```typescript
import { useAdminTheme } from '@/lib/use-admin-theme';

const { isDark, toggle } = useAdminTheme();
// isDark: boolean — current dark mode state
// toggle: () => void — flips dark mode and persists to localStorage
```

The hook reads from `localStorage` on mount (no flash on hydration because the layout conditionally applies `bg-neutral-950` vs `bg-gray-100` directly on the wrapper).
