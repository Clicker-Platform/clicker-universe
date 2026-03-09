---
name: core_appearance
description: >
  Work with the Clicker Platform Appearance, Theme, and Template system.
  Use this skill whenever adding a new layout template, modifying theme colors,
  fonts, or the live-preview Appearance editor.
  Trigger on: "add a layout", "new template", "edit theme", "appearance settings",
  "change font", "add a color", "modify AppearanceClient", "lib/templates",
  "app/admin/(dashboard)/appearance".
---

# /core_appearance — Themes, Templates & Appearance

You are working on the **Clicker Platform Appearance System**. This system controls the public-facing storefront/website for a tenant, including colors, fonts, layouts, and component swaps.

This skill is invoked as `/core_appearance [action]`.

---

## Architecture Overview

The Appearance System is divided into three parts:

1. **The Data Layer (`lib/templates/types.ts`)**: Defines the strict `TemplateConfig` schema saved to the tenant's Firestore document.
2. **The Registry (`lib/templates/`)**: Hardcoded defaults (`definitions.ts`) and React component mappings (`registry.ts`) for system templates.
3. **The Admin UI (`app/admin/(dashboard)/appearance/AppearanceClient.tsx`)**: The massive live-preview editor where tenants customize their look.

---

## Action: `add-template`

To add a completely new system template (e.g., "Minimalist Blog"), you must touch exactly three areas:

### Step 1: Define the Config (`lib/templates/definitions.ts`)

Add the new template to `templateDefinitions`. You MUST provide all required properties of `TemplateConfig`:

- `colors` (primary, background, foreground, etc.)
- `fonts` (heading, body)
- `cardVariant` ('shadow', 'outlined', 'flat')
- `headerLayout`, `homeButtonStyle`, `taglineStyle`
- `layout`: Defines the structural width (`narrow`, `boxed`, `full`, `tablet`) and grid columns.

### Step 2: Register Components (`lib/templates/registry.ts`)

Map the template ID to its specific React components in `templateComponents`:

- `Header`: e.g., `ClassicProfileHeader`, `ModernProfileHeader`.
- `Background`: e.g., `BackgroundDecorations` or `() => null`.

*If your new template needs a totally different header layout, create a new `components/headers/{Name}Header.tsx` first.*

### Step 3: Update Types (if needed) (`lib/templates/types.ts`)

If the new template requires a completely new CSS token (e.g., `bottomNavStyle`), add it to the `TemplateConfig` interface (preferably under the `custom?: Record<string, any>` bucket to avoid polluting global types).

---

## Action: `modify-editor`

When editing `app/admin/(dashboard)/appearance/AppearanceClient.tsx`, adhere to these strict rules:

### 1. State Management

The editor uses a `draftConfig` state for the live preview. **Never** mutate the `siteData` directly. All UI controls (color pickers, font selectors, layout toggles) must update `draftConfig`.

### 2. Live Preview iframe vs. DOM

The Appearance editor renders a live preview of the public site. Ensure any new configuration toggle you add actually passes its value down to the Preview component wrapper so the user gets real-time feedback.

### 3. Saving to Firestore

When the user clicks "Save", `updateSite(siteId, { appearance: { templateId, config: draftConfig } })` is called. Ensure your new fields don't accidentally send `undefined` values to Firestore (Firestore will crash). Default them or strip them.

---

## Common Gotchas

- **Color Overrides:** `allowThemeColorOverride` defaults to `true`. If a template imposes a strict aesthetic (like 'Sojourner' or 'Shuvo'), set this to `false` in `definitions.ts` so user color picks don't destroy the layout's contrast.
- **Hydration:** Always ensure theme tokens (like `--font-jakarta`) match exactly what is loaded in the root `layout.tsx`.
- **CSS Variables:** The system maps `draftConfig.colors` to CSS variables. If you add a new color role (e.g., `muted`), you must ensure the root wrapper component actually converts `muted: '#Hex'` into `--color-muted: 123 45 67`.
