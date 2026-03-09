---
name: template
description: >
  Scaffold, audit, and manage Clicker Platform visual templates. Use this skill whenever
  working with the template system: creating a new template, swapping header/background
  components, auditing template registration, or checking template status.
  Trigger on: "create template", "add template", "audit template", "template status",
  "add-component", or any request touching lib/templates/, definitions.ts, registry.ts,
  or the template system.
---

# /template — Clicker Platform Template Workflow Skill

You are helping work with the Clicker Platform template system — the theming and layout engine that defines how customer sites look.

This skill is invoked as `/template [action] [templateId]`

---

## Actions

| Action | Usage | Purpose |
|--------|-------|---------|
| `create` | `/template create {templateId}` | Scaffold a new system template end-to-end |
| `audit` | `/template audit {templateId}` | Check all registration points for completeness |
| `add-component` | `/template add-component {templateId}` | Swap or add a Header/Background component |
| `status` | `/template status` | Cross-reference all registered templates |

---

## Action: `create`

### Step 0 — Confirm Spec First

Before writing any code, collect from the user:

1. **Template ID** — snake_case (e.g. `brutalist`, `neon_city`, `coffee_shop`)
2. **Display name** — human label (e.g. `Brutalist Grid`)
3. **Description** — one sentence describing the aesthetic
4. **isPro** — `free` or `premium` tier
5. **Colors** (hex values):
   - `primary` — main brand color (buttons, highlights)
   - `background` — page background
   - `foreground` — text color
   - `surface` — card/panel background
   - `border` — border/divider color
   - `accent` (optional) — secondary accent color
6. **Fonts** — choose heading + body from available vars:
   - `var(--font-jakarta), sans-serif` — Plus Jakarta Sans (default)
   - `var(--font-space), monospace` — Space Mono
   - `var(--font-inter), sans-serif` — Inter
   - `var(--font-playfair), serif` — Playfair Display
7. **borderRadius** — CSS value (e.g. `1rem`, `1.5rem`, `0.5rem`, `0`)
8. **cardVariant** — `'shadow'` | `'outlined'` | `'flat'`
9. **headerLayout** — `'center'` | `'left'` | `'minimal'`
10. **homeButtonStyle** — `'pill'` | `'text'` | `'icon'`
11. **homeButtonColor** — `'primary'` | `'foreground'` | `'glass'`
12. **taglineStyle** — `'contrast'` | `'gentle'` | `'outline'`
13. **containerWidth** — `'narrow'` (480px) | `'boxed'` (1024px) | `'full'` (100%) | `'tablet'` (768px)
14. **navMode** — `'mobile-only'` (always bottom bar) | `'adaptive'` (mobile → desktop top bar)
15. **Grid** — columns per breakpoint + gap class:
   - mobile: usually `1`
   - tablet: usually `1` or `2`
   - desktop: usually `1`, `2`, or `3`
   - gap: `'gap-4'` | `'gap-6'` | `'gap-8'`
16. **allowThemeColorOverride** — `true` (user can change colors) | `false` (locked brand colors)
17. **backgroundElements** — list of floating SVG icons (or `[]` for none):
   - Each item: `{ icon: 'Croissant', position: 'top-10 left-4', rotation: -15, size: 'w-16 h-16' }`
   - Available icons: `Croissant`, `Coffee`, `Sparkles`, `Clock`, `Flame`, `Star`, `Leaf`, `Heart`
18. **Header component** — reuse existing or create new:
   - `ClassicProfileHeader` — bold centered layout with background art
   - `ModernProfileHeader` — left-aligned, structured
   - `ShuvoHeader` — minimal architectural style
   - Or: create new `{Name}Header.tsx`
19. **Background component** — `BackgroundDecorations` (floating SVG icons) | `() => null` (no background)

### Step 1 — Add to `lib/templates/definitions.ts`

Add entry to the `templateDefinitions` object:

```typescript
'{templateId}': {
    id: '{templateId}',
    name: '{Display Name}',
    description: '{One sentence description.}',
    isPro: false, // or true for premium
    config: {
        colors: {
            primary: '{hex}',
            accent: '{hex}',
            background: '{hex}',
            foreground: '{hex}',
            surface: '{hex}',
            border: '{hex}',
        },
        fonts: {
            heading: 'var(--font-jakarta), sans-serif',
            body: 'var(--font-jakarta), sans-serif',
        },
        borderRadius: '1rem',
        cardStyle: 'clean', // Keep for backward compat — mirrors cardVariant
        cardVariant: 'shadow', // 'shadow' | 'outlined' | 'flat'
        backgroundElements: [], // or list of BackgroundElement objects
        allowThemeColorOverride: true, // false = locked brand template
        headerLayout: 'left', // 'center' | 'left' | 'minimal'
        homeButtonStyle: 'pill', // 'pill' | 'text' | 'icon'
        homeButtonColor: 'primary', // 'primary' | 'foreground' | 'glass'
        taglineStyle: 'contrast', // 'contrast' | 'gentle' | 'outline'

        layout: {
            containerWidth: 'boxed', // 'narrow' | 'boxed' | 'full' | 'tablet'
            navMode: 'adaptive',     // 'mobile-only' | 'adaptive'
            grid: { mobile: 1, tablet: 1, desktop: 1, gap: 'gap-4' }
        }

        // Optional: template-specific overrides
        // custom: {
        //     bottomNavStyle: 'minimal',
        //     heroHeight: 'large',
        // }
    }
},
```

**cardStyle mapping** (deprecated but required for compatibility):
- `cardVariant: 'shadow'` → `cardStyle: 'clean'`
- `cardVariant: 'outlined'` → `cardStyle: 'glass'`
- `cardVariant: 'flat'` → `cardStyle: 'clean'`

### Step 2 — Register in `lib/templates/registry.ts`

Add entry to `templateComponents`:

```typescript
'{templateId}': {
    Header: {HeaderComponent},   // Import at top of file
    Background: BackgroundDecorations, // or: () => null
},
```

If reusing an existing header, add the import if not already present:

```typescript
import { {HeaderComponent} } from '@/components/headers/{HeaderComponent}';
```

If creating a **new header component**, create first:

**`dev/clicker-platform-v2/components/headers/{Name}Header.tsx`**
- Reference pattern: `components/headers/ModernProfileHeader.tsx`
- Use `useTemplate()` from `@/lib/templates/TemplateProvider` to access theme values
- Use `useSite()` from `@/lib/site-context` if site-specific data needed
- Export as named export: `export const {Name}Header = ...`

### Step 3 — Seed to Firestore

After updating definitions.ts, sync to the `templates/` Firestore collection:

```
GET /api/admin/seed-templates
```

Or in admin panel: `/admin/appearance` → click "Seed Templates" button.

This saves all `templateDefinitions` entries as `TemplateDocument` records with `type: 'system'`.

### Step 4 — Verify in AppearanceClient

The template appears automatically in the gallery — no code change needed in `AppearanceClient.tsx`. The gallery reads from `getAvailableTemplates()` which combines static definitions + Firestore docs.

---

## Action: `audit`

Read the following files and check each point for `{templateId}`:

**Checklist (report ✓/✗ with file path for each):**

1. Entry exists in `lib/templates/definitions.ts` → `templateDefinitions['{templateId}']`
2. All required `TemplateConfig` fields present: `colors`, `fonts`, `borderRadius`, `cardStyle`, `cardVariant`, `headerLayout`, `homeButtonStyle`, `homeButtonColor`, `taglineStyle`, `layout`
3. Entry exists in `lib/templates/registry.ts` → `templateComponents['{templateId}']`
4. `Header` component is imported at top of `registry.ts` and file exists on disk
5. `Background` component is either `BackgroundDecorations` (imported) or explicit `() => null`
6. `layout.containerWidth` is one of: `'narrow'`, `'boxed'`, `'full'`, `'tablet'`
7. If `allowThemeColorOverride: false`, it is intentional (brand-locked template)
8. No `firebase-admin` imports in any file in `lib/templates/`
9. Template is seeded in Firestore `templates/{templateId}` (verify via seed endpoint or Firestore console)

---

## Action: `add-component`

To swap or add a Header or Background component for an existing template `{templateId}`:

1. If creating new component: create `components/headers/{NewName}Header.tsx` (reference: `ModernProfileHeader.tsx`)
2. Add import to top of `lib/templates/registry.ts`:
   ```typescript
   import { {NewName}Header } from '@/components/headers/{NewName}Header';
   ```
3. Update `templateComponents['{templateId}']`:
   ```typescript
   '{templateId}': {
       Header: {NewName}Header,  // changed
       Background: BackgroundDecorations,
   },
   ```
4. No Firestore update needed — component changes are code-only (registry.ts is not seeded)
5. No `AppearanceClient.tsx` update needed

---

## Action: `status`

Read these files and produce a cross-reference table:
- `lib/templates/definitions.ts` — all templateIds and their configs
- `lib/templates/registry.ts` — all entries in templateComponents

Output format:
```
Template: {id} — "{name}"
  Tier: free/premium  |  containerWidth: narrow/boxed/full/tablet
  Definition:    ✓/✗  lib/templates/definitions.ts
  Registry:      ✓/✗  lib/templates/registry.ts
  Header:        ✓/✗  {ComponentName}
  Background:    ✓/✗  {ComponentName or inline}
  colorOverride: locked/user-customizable

Unregistered definitions (in definitions.ts but no registry entry): ...
Missing definitions (in registry.ts but no definitions.ts entry): ...
```

---

## Critical File Paths

```
PLATFORM (dev/clicker-platform-v2/):
  lib/templates/types.ts                              ← interfaces (TemplateDefinition, TemplateConfig, etc.)
  lib/templates/definitions.ts                        ← templateDefinitions static registry
  lib/templates/registry.ts                           ← templateComponents (Header + Background mapping)
  lib/templates/service.ts                            ← Firestore CRUD (getAvailableTemplates, fetchTemplate, saveTemplate)
  lib/templates/layoutUtils.ts                        ← getBlockSpan() grid helpers
  components/headers/ClassicProfileHeader.tsx         ← Header: classic
  components/headers/ModernProfileHeader.tsx          ← Header: modern, sojourner
  components/headers/ShuvoHeader.tsx                  ← Header: shuvo
  components/BackgroundDecorations.tsx                ← Background: classic, sojourner, shuvo
  components/TemplateProvider.tsx                     ← React context, useTemplate(), CSS variable injection
  app/admin/(dashboard)/appearance/AppearanceClient.tsx  ← template gallery UI (1,326 lines)
  app/api/admin/seed-templates/route.ts               ← seeding endpoint (GET /api/admin/seed-templates)
```

---

## Architecture Rules (never violate)

- Template ID must match in BOTH `templateDefinitions` (definitions.ts) AND `templateComponents` (registry.ts) — mismatched IDs cause silent fallback to `classic`
- `cardStyle` is deprecated but MUST be set alongside `cardVariant` for backward compatibility
- `allowThemeColorOverride: false` is intentional for brand-locked templates — do not remove
- Header components use **static imports** in registry.ts (NOT dynamic like module components)
- Never import `firebase-admin` anywhere in `lib/templates/` or `components/headers/`
- After ANY change to `definitions.ts`, run `GET /api/admin/seed-templates` to sync Firestore
- Per-site active template lives at `sites/{siteId}/content/siteSettings.layoutStyle` — changing a template definition does NOT change any site's active template
- `getTemplate(id)` in registry.ts falls back to `classic` if ID not found — always test with the real ID
