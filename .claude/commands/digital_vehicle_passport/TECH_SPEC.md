# Technical Specification: Digital Vehicle Passport & Agnostic Booking

## 1. Domain Overview
This specification outlines the architectural updates to unify the Reservation and Service Records modules into a scalable, business-agnostic workflow, laying the structural foundation for the Digital Vehicle Passport (DVP).

## 2. Reservation Module Update (Agnostic Booking)
To support multi-tenant business types (Auto Detailers, SPAs, Clinics), the reservation module must not hardcode "Vehicle" terminology into its core schema, instead relying on configurable generic assets.

### Schema Changes (`lib/modules/reservation/types.ts`)
- **`ReservationSettings`**: Add a `formConfig` object to define the form inputs dynamically globally.
  - `requireAsset: boolean`
  - `assetLabel: string` (e.g. "License Plate" or "Room ID")
  - `assetPlaceholder: string`
  - `requireAssetModel: boolean`
  - `assetModelLabel: string`
- **`Booking`**: Add generic fields to capture the asset from the form.
  - `assetId?: string`
  - `assetModel?: string`
  
## 3. Service Records Module Update (POS-Like Checkout)
To support multiple inventory products with dynamic quantities, without breaking legacy records or enforcing blocking validations.

> **UI Constraint:** The user interface for configuring `consumedItems` must remain extremely simple. It should only consist of basic controls to add an item, remove an item, and edit its quantity. Do not build a complex or "fancy" POS screen.

### Schema Changes (`lib/modules/service-records/types.ts`)
- **`ConsumedItem` Interface**:
  - `inventoryItemId: string`
  - `name: string` (Denormalized)
  - `quantity: number`
- **`ServiceRecord` Modifications**:
  - `consumedItems?: ConsumedItem[]`
  - *Do NOT remove:* Keep `productUsed?: string` as a legacy escape hatch / free text field for materials bought off-the-books.

### API Logic Changes (`lib/modules/service-records/api.ts`)
- **`approveRecord` function**: Replace the single `updateStock` call. Check if `record.consumedItems` exists, then iterate over it. Dynamically deduct inventory via `updateStock` for each item using its respective `.quantity` as a negative value.

## 4. Vehicle & Car Catalog Database Schema
The system must gracefully connect Agnostic Booking inputs with strict Vehicle tracking required for automotive use-cases.

### Schema Changes (`lib/modules/service-records/types.ts`)
- **`Vehicle` Modifications**:
  - Remove deprecated string fields: `make`, `model`, `type`.
  - Add foreign key: `carCatalogId?: string` pointing to `CarCatalogEntry`.

### Flow Impact Analysis
- **Flow 1 (Booking -> Service Record):** When an admin starts a Service Record from a Reservation, the system uses the booking's `assetId` to look up an existing `Vehicle`. If none exists, the admin registers a new `Vehicle` by picking a strict `CarCatalogEntry` (Brand/Type) for the `carCatalogId`.
- **Flow 2 (Walk-in Dashboard):** Admin types the License Plate. If it's a new plate, the UI requires selecting a `CarCatalogEntry` dropdown to populate `carCatalogId`, rather than accepting free text for make/model.
