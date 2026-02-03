# Template System Architecture

## Overview
The template system uses a **Hybrid Static/Dynamic Architecture**. It combines the performance and stability of hardcoded "System Templates" with the flexibility of Firestore-based configuration overrides.

## Core Components

### 1. Definitions (`lib/templates/definitions.ts`)
-   **Role**: Source of Truth for System Templates.
-   **Structure**: A dictionary of `TemplateDefinition` objects.
-   **Content**: Defines the visual "DNA" of a template (Colors, Fonts, Layout Rules, Background Elements).
-   **Key Trait**: These are *static* and shipped with the code.

### 2. Registry (`lib/templates/registry.ts`)
-   **Role**: The "Component Mapper".
-   **Mechanism**: Maps a `templateId` (e.g., `'classic'`) to specific React Components (e.g., `ClassicProfileHeader`).
-   **Modularity**: This allows completely different UI structures (like a "Dashboard" vs "Link-in-Bio") to coexist by just swapping the `Header` or `Background` component in the registry.

### 3. Service (`lib/templates/service.ts`)
-   **Role**: Data Access Layer.
-   **Logic**:
    1.  Checks **Firestore** for a document matching the ID.
    2.  If found, returns the dynamic configuration (allowing user customization).
    3.  If NOT found, falls back to the **Static Definition** (from `definitions.ts`).
-   **Caching**: Implements an in-memory TTL cache (5 min) to reduce database reads.

### 4. Provider (`components/TemplateProvider.tsx`)
-   **Role**: The "Engine" that powers the app.
-   **Function**:
    -   Fetches the active template using `service.ts`.
    -   Merges it with the static definition (Optimistic UI).
    -   **Injects CSS Variables**: Converts the `ThemeConfig` (JSON) into CSS Custom Properties (e.g., `--theme-primary`, `--layout-max-width`) that drive the styling of the entire app.
    -   **Responsive Logic**: Calculates grid columns and layout modes based on the config.

## Modularity Assessment

The system is **Highly Modular** because:
-   **Separation of Concerns**: Visuals (`definitions`), Functionality (`registry`), and Data (`service`) are decoupled.
-   **Component Swapping**: You can create a new template by simply defining a new key in the Registry and assigning different components.
-   **Schema-Driven UI**: The UI adapts based on the `ThemeConfig` schema (e.g., switching from "Mobile Only" nav to "Adaptive" nav) without code changes in the components themselves.

## Future Development Potential

1.  **User-Specific Visibility**:
    -   **Current**: Service fetches `all` active templates.
    -   **Future**: Update `service.ts` to query `where('ownerId', '==', currentUser.uid)`. This allows "Private" custom templates.

2.  **Marketplace / Community Templates**:
    -   **Current**: No mechanism for sharing.
    -   **Future**: A "Community" collection in Firestore where users publish their configs.

3.  **Visual Site Builder**:
    -   The `ThemeConfig` is granular enough (`borderRadius`, `grid.gap`, `headerLayout`) to power a deeper "Webflow-lite" editor.
    -   **Future**: Expose `layout` and `grid` controls in the Admin UI (currently hardcoded in definitions) to let users design their own layouts.

4.  **Dynamic Component Loading**:
    -   **Current**: All template components are imported in `registry.ts` (bundled).
    -   **Future**: Use `next/dynamic` or React.lazy in the registry to split code chunks, loading only the "Shuvo" header code when the "Shuvo" template is active.
