---
name: sales_pipeline
description: >
  Work with the Clicker Platform Sales Pipeline Module (CRM Kanban).
  Use this skill whenever modifying the Kanban board, lead stages,
  form-to-lead integrations, or real-time lead updates.
  Trigger on: "sales pipeline", "kanban board", "lead management",
  "pipeline stages", "form integration", "lib/modules/sales-pipeline".
---

# /sales_pipeline — Sales Pipeline (Kanban CRM) Module

You are working on the **Clicker Platform Sales Pipeline Module**. This system provides a Kanban-style CRM for tenants to track leads through customizable stages (e.g., "New Lead", "Contacted", "Won").

This skill is invoked as `/sales_pipeline [action]`.

---

## 1. Architecture Overview

- **Module Directory:** Note that the source folder uses a dash: `lib/modules/sales-pipeline`.
- **Storage Location:** Data is stored under the tenant's document: `sites/{siteId}/modules/sales_pipeline/` (Note the underscore in the Firestore path).
- **Primary Collections:**
  - `leads`: The individual lead cards on the board.
  - `settings/config`: Stores the customizable `PipelineStage` array and `formIntegrations`.

### Real-Time Updates

Unlike many other admin tables, the Pipeline Board relies on **real-time Firestore listeners (`onSnapshot`)**.

- `subscribeToLeads()` in `api.ts` pushes live updates to the UI.
- When users drag-and-drop a lead to a new stage, the UI must optimistically update the state and simultaneously call `updateLeadStage()` to sync Firestore.

---

## 2. Form Integrations

The Sales Pipeline is deeply integrated with the **Core CRM Forms** (`/core_crm`).

- A tenant can configure a form so that every new submission automatically creates a Lead on the Kanban board.
- The `PipelineConfig` stores `formIntegrations`. Each contains:
  - `formId`
  - `targetStageId` (where the card should appear, usually the first column)
  - `fieldMapping` (maps form questions like "What is your name?" to Lead attributes like `name`, `contact`, `notes`).

### Action: `debug-form-integration`

If a form submission isn't appearing on the board:

1. Verify the integration exists in `sites/{siteId}/modules/sales_pipeline/settings/config`.
2. Check the raw form submission. The function responsible for processing the form (likely a Server Action or `/api/submissions/`) must check if the Pipeline module is active and if an integration exists for that `formId`.
3. If integration exists, it should cleanly extract the mapped fields and call `createLead()`.

---

## 3. Action: `add-lead-field`

If requested to add a new field to a Lead (e.g., "Expected Close Date"):

1. **Update Types:** Add the field to the `Lead` interface in `lib/modules/sales-pipeline/types.ts`.
2. **Update Admin UI:** Locate the creation/edit modal (likely within `app/admin/(dashboard)/sales-pipeline/`) and add the input.
3. **Update Card UI:** If the field should be visible on the board, update the `LeadCard` component.
4. **Update Form Mapping (Optional):** If this new field can be populated by a public form, you must also update `FormIntegration['fieldMapping']` in `types.ts` so tenants can wire it up.

---

## Common Gotchas

- **Timestamps:** Unlike other modules that use Firestore `Timestamp` objects natively, the Sales Pipeline currently uses JS Epoch Numbers (`Date.now()`) for `createdAt` and `updatedAt`. Ensure you do not accidentally pass `serverTimestamp()` to a lead update unless you refactor the types comprehensively.
- **Stage Ordering:** Stages are sorted by their `order` integer property. When a tenant reorders stages in settings, you must rewrite the entire `stages` array in the `config` document.
- **Deletions:** When a stage is deleted, you must decide how to handle orphaned leads (leads currently sitting in that stage). The UI should ideally prompt the user to move them to a different stage first, or default them to `won`/`lost`.
