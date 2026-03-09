---
name: core_business
description: >
  Work with the Clicker Platform Core Business features: Business Profile,
  General Settings, Team Management, and the Core Product Catalog.
  Use this skill when modifying site metadata, domain settings, adding staff,
  or dealing with the base product catalog (before POS/Inventory modules).
  Trigger on: "business profile", "site settings", "add a product", "product catalog",
  "team management", "staff access", "domains",
  "app/admin/(dashboard)/business", "app/admin/(dashboard)/settings", 
  "app/admin/(dashboard)/products".
---

# /core_business — Profile, Settings & Products

You are working on the **Clicker Platform Core Business layer**. This system manages the identity, global settings, team access, and the foundational product catalog of a tenant's site.

This skill is invoked as `/core_business [action]`.

---

## 1. Business Profile (`app/admin/(dashboard)/business`)

The **Business Profile** controls the public-facing identity of the tenant.

- **Fields:** Business Name, Address, Contact Email, Phone, Logo, Cover Image.
- **Firestore Path:** Primarily saved to `sites/{siteId}`, but some specialized data might live in specialized profile collections.
- **Interaction with Modules:**
  - *Crucial Rule:* The Business Name and Address defined here are the **canonical source of truth**. Modules (like the POS system receipts) must pull `businessName` from this core profile, *not* from module-specific settings, to prevent data divergence.

---

## 2. Settings & Team Management (`app/admin/(dashboard)/settings`)

The Settings area is restricted to high-level configurations, mostly accessible only by the site `Owner`.

### Domains and SEO

- Contains forms for setting up custom domains (if applicable) and general SEO metadata.
- Modifying domain logic often involves backend Vercel Domain API interactions.

### Team Management (`settings/team`)

- **Action: Add/Edit Staff**
- This is where Owners invite staff and assign RBAC roles (`owner`, `editor`, `viewer`, `staff`) or granular module permissions.
- When saving a team member's access, the payload is written directly to `sites/{siteId}/members/{userId}`.
- If you add a new module (e.g., "Reservations"), ensure the UI here is updated so the Owner can check a box to grant `reservation` access to staff.

---

## 3. Product Catalog (`app/admin/(dashboard)/products`)

The `products` directory represents the **Core Catalog**.

### Core Catalog vs. Module Features

1. **Core Products:** The basic definition of an item (Name, Price, Image, Category, Description, Type).
2. **Module Overlays:**
   - When a tenant turns on the **Inventory** module, the core product gets linked to inventory tracking logic.
   - When a tenant turns on the **BYOD POS** module, the core product can be added to the POS menu.

### Action: `add-product-field`

If asked to add a new core field to products (e.g., "SKU" or "Dietary Badges"):

1. Update `ProductFormModal.tsx` to include the form input.
2. Update the base Product type definition (usually in `types.ts` or `mockData.ts` if typing is shared).
3. Ensure the `ProductsClient.tsx` save function passes this new field to Firestore without accidentally stripping it.

---

## Common Gotchas

- **File Uploads:** Uploading logos in the Business Profile or images in the Product Catalog relies on Firebase Storage. Ensure you use the shared `upload.ts` utility (if available) rather than writing raw `uploadBytes` logic inside the UI component.
- **RBAC Checks:** The `/settings` and `/settings/team` routes are highly sensitive. Ensure robust `if (!isOwner) return <AccessDenied />;` guards are in place on these specific client components.
