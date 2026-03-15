---
name: template
description: >
  Scaffold, audit, and manage Clicker Platform visual templates. Use this skill whenever
  working with the template system, even if the user doesn't say "template" explicitly —
  creating a new site theme, swapping a header component, checking why a template isn't
  showing, or reviewing which templates are registered all qualify.
  Trigger on: "create template", "new theme", "add header", "swap header", "template not
  loading", "audit template", "template status", "template gallery", or any request
  touching lib/templates/, definitions.ts, registry.ts, TemplateClient.tsx, or
  components/headers/.
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
    - `MrbHeader` — dark glassmorphic style for dark-mode templates
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
        },

        defaultBlockLayouts: {
            hero: 'centered',         // 'centered' | 'split' | 'fullbleed'
            text: 'prose',            // 'prose' | 'two-column' | 'highlight-box'
            image: 'standard',        // 'standard' | 'full-width' | 'rounded-card' | 'side-caption'
            faq: 'simple-list',       // 'simple-list' | 'accordion' | 'grid'
            map: 'card-with-address', // 'card-with-address' | 'embed-full'
        },

        // Optional: template-specific settings (used for shuvo, mrb)
        // custom: {
        //     bottomNavStyle: 'minimal', // 'minimal' | 'glass'
        //     heroHeight: 'large',
        //     hideQuickActionsTitle: true,
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
    // Optional: override specific block components for this template
    // Blocks: {
    //     Hero: {TemplateId}HeroBlock,
    //     QuickActions: {TemplateId}QuickActions,
    //     OperatingHours: {TemplateId}OperatingHours,
    //     Text: {TemplateId}TextBlock,
    //     // ... any key from TemplateComponents.Blocks
    // }
},
```

> **Block overrides** are optional. If a `Blocks` key is present, `BlockRenderer` will use the template-specific component instead of the Default block. MRB uses this pattern for `Hero`, `QuickActions`, and `OperatingHours`. Block override components live in `components/blocks/{templateId}/`.

If reusing an existing header, add the import if not already present:

```typescript
import { {HeaderComponent} } from '@/components/headers/{HeaderComponent}';
```

If creating a **new header component**, create first:

```text
dev/clicker-platform-v2/components/headers/{Name}Header.tsx
```

- Reference pattern: `components/headers/ModernProfileHeader.tsx`
- Use `useTemplate()` from `@/lib/templates/TemplateProvider` to access theme values
- Use `useSite()` from `@/lib/site-context` if site-specific data needed
- Export as named export: `export const {Name}Header = ...`

### Step 3 — Seed to Firestore

After updating definitions.ts, sync to the `templates/` Firestore collection:

```
GET /api/admin/seed-templates
```

Or in admin panel: `/admin/template` → click "Seed Templates" button.

This saves all `templateDefinitions` entries as `TemplateDocument` records with `type: 'system'`.

### Step 4 — Verify in TemplateClient

The template appears automatically in the gallery — no code change needed in `TemplateClient.tsx`. The gallery reads from `getAvailableTemplates()` which combines static definitions + Firestore docs.

---

## Action: `audit`

Read the following files and check each point for `{templateId}`:

**Checklist (report ✓/✗ with file path for each):**

1. Entry exists in `lib/templates/definitions.ts` → `templateDefinitions['{templateId}']`
2. All required `TemplateConfig` fields present:
   - Core: `colors`, `fonts`, `borderRadius`, `cardStyle`, `cardVariant`
   - Layout tokens: `headerLayout`, `homeButtonStyle`, `homeButtonColor`, `taglineStyle`
   - `layout` object with `containerWidth`, `navMode`, `grid`
   - `defaultBlockLayouts` map (should have at least: `hero`, `text`, `image`, `faq`, `map`)
   - Optional but check if template is dark-mode / brand-specific: `custom`, `backgroundElements`
3. Entry exists in `lib/templates/registry.ts` → `templateComponents['{templateId}']`
4. `Header` component is imported at top of `registry.ts` and file exists on disk
5. `Background` component is either `BackgroundDecorations` (imported) or explicit `() => null`
6. `layout.containerWidth` is one of: `'narrow'`, `'boxed'`, `'full'`, `'tablet'`
7. If `allowThemeColorOverride: false`, it is intentional (brand-locked template)
8. No `firebase-admin` imports in any file in `lib/templates/`
9. Template is seeded in Firestore `templates/{templateId}` (verify via seed endpoint or Firestore console)
10. If `Blocks` key is present in registry entry, confirm each component file exists on disk at `components/blocks/{templateId}/`

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
5. No `TemplateClient.tsx` update needed

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
  Blocks:        ✓/✗  {list keys or "none"}
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
  components/headers/MrbHeader.tsx                    ← Header: mrb
  components/BackgroundDecorations.tsx                ← Background: classic, sojourner, shuvo
  components/TemplateProvider.tsx                     ← React context, useTemplate(), CSS variable injection
  components/blocks/{templateId}/                     ← Template-specific block overrides (e.g. components/blocks/mrb/)
  components/blocks/public/cardStyles.ts              ← getCardClasses(), getTextColor() utilities
  app/admin/(dashboard)/template/TemplateClient.tsx   ← template gallery UI
  app/api/admin/seed-templates/route.ts               ← seeding endpoint (GET /api/admin/seed-templates)
DOCS (dev/docs/):
  template-blocks-architecture.md                     ← Reference: Structure and styling rules for Content Blocks
```

---

## Architecture Rules

- **Template ID must match in both files.** `templateDefinitions` (definitions.ts) and `templateComponents` (registry.ts) are keyed by the same ID — a mismatch causes a silent fallback to `classic` with no error thrown, which is hard to debug.
- **Always set `cardStyle` alongside `cardVariant`.** `cardStyle` is deprecated but still read by older components. Without it, cards may render incorrectly on sites that haven't fully migrated. Use the mapping: `shadow → clean`, `outlined → glass`, `flat → clean`.
- **`allowThemeColorOverride: false` is intentional.** This locks the palette for brand templates where user overrides would break the design intent. Don't remove it assuming it's a mistake.
- **Header components use static imports in registry.ts.** Unlike module components, the template registry is evaluated synchronously at render time — dynamic imports won't work here.
- **Never import `firebase-admin` in `lib/templates/` or `components/headers/`.** These files run on the client; firebase-admin is server-only and will cause a build error.
- **After any change to `definitions.ts`, seed Firestore.** The UI reads from Firestore, not the static file directly. Run `GET /api/admin/seed-templates` or use the "Seed Templates" button in `/admin/template`.
- **Changing a definition does not affect active sites.** Per-site active template is stored at `sites/{siteId}/content/siteSettings.layoutStyle`. Updating definitions.ts only affects what's available to choose — it doesn't reassign anyone.
- **`getTemplate(id)` falls back to `classic` silently.** Always verify with the actual template ID; a typo will appear to "work" but render the wrong template.
- **Block overrides live in `components/blocks/{templateId}/`.** Template-specific block implementations follow the same props interface as their Default counterparts. Register them in `registry.ts` under `Blocks`. The `BlockRenderer` checks `customBlocks?.[Key]` before falling back to the Default block.
- **`useTemplate()` is imported from `@/components/TemplateProvider`**, not `@/lib/templates/TemplateProvider`. Use this import in all header and block components.
