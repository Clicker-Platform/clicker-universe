---
name: create_template
description: Architect and implement a new Template/Theme for the Canvas Studio page builder.
---

# Skill: Create New Clicker Platform Template

You are an expert Next.js and Tailwind developer. Your task is to add a new visual Template to the Clicker Platform. The platform uses "Canvas Studio" to handle block-based content, but delegates the visual presentation to the Template system.

## 1. Architectural Rules
Before you write any code, you MUST understand how the Canvas Studio Block Renderer works:
- Canvas Studio defines generic blocks (`hero`, `products`, `quick_actions`).
- The `BlockRenderer.tsx` checks `lib/templates/registry.ts` to see if the active template has a **Custom Override Component**.
- If a custom override exists (e.g., `MrbHero`), it renders that.
- If it doesn't, it renders a fallback (`DefaultHeroBlock`) and applies the template's global `theme` config and the user's `layoutVariant`.

Never hardcode a `siteId` or tenant context. Always ensure components can receive dynamic `data` props from Canvas Studio.

## 2. Execution Steps

When asked to create a new template, you must follow these 4 steps sequentially:

### Step 1: Define the Config
**File:** `lib/templates/definitions.ts`  
- Create a new `TemplateDefinition` entry.
- Configure `colors`, `fonts` (heading/body), `borderRadius`, and `cardStyle`.
- Carefully map the `defaultBlockLayouts` so the Canvas Studio Editor knows the preferred layout variant for default blocks that won't be overridden.

### Step 2: Create the Header
**Directory:** `components/headers/`  
- Create `[TemplateName]Header.tsx`.
- Must accommodate `site.name`, `site.logo`, and render generic navigation links properly. Include logic for responsive mobile states.

### Step 3: Create Component Overrides
**Directory:** `components/blocks/[template_id]/`  
- Only the generic Canvas Studio blocks are not enough for highly premium aesthetics.
- You must create custom React components to replace specific blocks requested by the user.
- **Minimum required overrides:** Create a specific Hero block and at least one other block (e.g., Quick Actions or Products).
- Components MUST accept the standard props: `({ data, theme, profile, previewMode })`.

### Step 4: Hook into the Registry
**File:** `lib/templates/registry.ts`  
- Import the new Header and Custom Block Overrides.
- Add your template ID to the `templateComponents` record.
- Map them as:
  ```javascript
  '[template_id]': {
      Header: [TemplateName]Header,
      Blocks: {
          Hero: [TemplateName]Hero,
          // ...other overrides
      }
  }
  ```

## 3. Review
Once completed, verify that:
1. The template definition is exported correctly.
2. The registry properly maps the override components.
3. No imports are broken in `BlockRenderer.tsx` or Canvas Studio.
