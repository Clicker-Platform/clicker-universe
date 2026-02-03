# Strict Modularity & System Architecture

**Last Updated:** 2025-01-25

---

## Overview

This document describes the multi-tenant architecture with strict modularity controls. All modules are toggleable from Backyard (Superadmin dashboard).

---

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      BACKYARD (Superadmin)                  │
│  - Tenant CRUD                                              │
│  - Module ON/OFF per Tenant                                 │
│  - User RBAC Assignment                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     FIRESTORE DATABASE                       │
│  sites/{siteId}                                             │
│    ├── name, subdomain, ownerEmail                          │
│    ├── slug                                                 │
│    └── modules: { pos: true, inventory: false, ... }        │
│                                                             │
│  slugMappings/{slug}                                        │
│    └── siteId, isActive                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    TENANT ADMIN PANEL                        │
│  - Core Features (always visible)                           │
│  - Module Features (dynamic based on DB)                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Module System

### Source of Truth
- **Database:** `sites/{siteId}.modules` (Record<string, boolean>)
- **Definitions:** `lib/modules/definitions.ts` (SYSTEM_MODULES array)

### Flow
1. Backyard → createTenant() → stores `modules` map in DB
2. Admin Panel → subscribeToEnabledModules() → reads from DB
3. AdminSidebar → filters SYSTEM_MODULES by enabled status

### Available Modules

| Module ID | Display Name | Routes |
|-----------|--------------|--------|
| `pos` | POS | /admin/pos, /admin/pos/menu, /admin/pos/settings |
| `inventory` | Inventory | /admin/inventory |
| `booking` | Booking | /admin/reservation, /admin/reservation/calendar, etc. |
| `membership` | Membership | /admin/membership, /admin/membership/settings |

---

## Core Features (Always ON)

These features are hardcoded in `AdminSidebar.tsx` and always visible:

| Feature | Path |
|---------|------|
| Overview | /admin |
| Inbox | /admin/inbox |
| Links | /admin/links |
| Pages | /admin/pages |
| Forms Builder | /admin/forms |
| Products | /admin/products |
| Business | /admin/business |
| Appearance | /admin/appearance |
| Profile | /admin/profile |
| Settings | /admin/settings |

---

## Slug Per-Tenant

### Creation Flow
1. `createTenant()` generates siteId from subdomain
2. Creates `sites/{siteId}` document
3. Creates `slugMappings/{siteId}` document

### Resolution Flow
1. Middleware extracts slug from URL path
2. Sets `x-tenant-slug` header
3. Server component uses `resolveSlugToSiteId()` to get siteId

---

## Adding a New Module

1. Add definition to `lib/modules/definitions.ts`:
   ```typescript
   {
       id: 'analytics',
       displayName: 'Analytics',
       version: '1.0.0',
       description: 'Business Intelligence',
       icon: 'chart',
       adminRoutes: [
           { path: '/admin/analytics', componentKey: 'analytics:Dashboard', label: 'Dashboard' }
       ]
   }
   ```

2. Register components in `client-registry.tsx`

3. Deploy - Backyard will automatically show the new module in the Create/Manage forms

---

## Changes Made (2025-01-25)

### Strict Modularity
- Removed `enabled: true` from all module definitions
- Made `modules` required in createTenant (no defaults)
- Backyard form defaults all modules to OFF
- Dynamic module list imported from SYSTEM_MODULES

### Backyard Cleanup
- Removed SeedTool from Overview
- Stubbed Monitoring page (Coming Soon)
- Stubbed Settings page (Coming Soon)
