# Strict Modularity Rules

To ensure system resilience and flexibility, all feature modules located in `lib/modules/*` must adhere to the following **Strict Modularity** guidelines.

## Core Principle
**A module must function in complete isolation.**
Disabling one module (e.g., Inventory) MUST NOT cause build errors, runtime crashes, or critical failures in another module (e.g., POS).

## 1. Zero Hard Dependencies
-   **Forbidden**: Top-level static imports of **values** (functions, classes, constants) from sibling modules.
    ```typescript
    // ❌ WRONG
    import { updateStock } from '@/lib/modules/inventory/api';
    ```
-   **Allowed**: Imports from shared kernel/core (`@/lib/utils`, `@/components/common`, `@/lib/firebase`).
-   **Allowed**: Type-only imports (Types/Interfaces) are permitted as they are erased at runtime.
    ```typescript
    // ✅ OK (Types only)
    import type { InventoryItem } from '@/lib/modules/inventory/types';
    ```

## 2. Dynamic Integration
-   **Requirement**: Use **Dynamic Imports** for any logic that relies on another module.
    ```typescript
    // ✅ CORRECT
    if (await isModuleEnabled('inventory')) {
        const { updateStock } = await import('@/lib/modules/inventory/api');
        await updateStock(...);
    }
    ```

## 3. Feature Flags & Checks
-   **Requirement**: Always check if a target module is enabled before invoking its functionality.
-   **Helper**: Use `isModuleEnabled(moduleId)` from `@/lib/modules/registry`.
    ```typescript
    const loyaltyEnabled = await isModuleEnabled('membership');
    if (!loyaltyEnabled) return; 
    ```

## 4. Graceful Degradation
-   **UI Components**: If a dependent module is disabled, the UI should simply hide the related button or link, or show a simplified view, rather than crashing or showing a broken state.
-   **Client Components**: Use `next/dynamic` or conditional rendering for components from other modules.

## 5. Data Independence
-   **Requirement**: Modules should primarily manage their own data.
-   **Cross-Module Writes**: If Module A needs to update Module B's data (e.g., POS updates Inventory), it must be done via the Dynamic Integration pattern (Rule #2), not direct database writes (unless unavoidable and documented).

## Summary Table

| Action | Restricted? | Rule |
| :--- | :--- | :--- |
| `import { func } from '@/lib/modules/B'` | 🔴 **FORBIDDEN** | Automatic hard dependency. |
| `import type { Type } from '@/lib/modules/B'` | 🟢 **ALLOWED** | Types are erased at build time. |
| `import { Button } from '@/components/common'` | 🟢 **ALLOWED** | Shared core component. |
| `await import('@/lib/modules/B')` | 🟢 **REQUIRED** | For cross-module logic. |
| `isModuleEnabled('B')` | 🟢 **REQUIRED** | Guard clause before usage. |
