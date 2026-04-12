# API Documentation — Clicker Universe

Overview of all API routes in the platform. All routes are under `clicker-platform-v2/app/api/`.

---

## Authentication

All admin API routes require a valid Firebase Auth session cookie. Public routes are unauthenticated.

---

## Core API Routes

### Site / Tenant

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/site/[siteId]` | Fetch public site settings |
| `GET` | `/api/resolve-site` | Resolve siteId from slug or subdomain |

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/auth/session` | Create session cookie from Firebase ID token |
| `DELETE` | `/api/auth/session` | Destroy session (logout) |

### Warranty

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/warranty/[warrantyCode]` | Fetch warranty card data |
| `GET` | `/api/warranty/[warrantyCode]/pdf` | Stream warranty card as PDF |

### AI Sales Agent

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/agent/chat` | Send message to AI sales agent (Gemini) |
| `GET` | `/api/agent/config/[siteId]` | Fetch agent configuration for a site |

### POS (byod_pos module)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/pos/menu/[siteId]` | Fetch public menu items |
| `POST` | `/api/pos/orders` | Create new order |
| `GET` | `/api/pos/orders/[orderId]` | Fetch order status |

### Reservation module

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/reservation/services/[siteId]` | Fetch available services |
| `GET` | `/api/reservation/availability` | Check slot availability |
| `POST` | `/api/reservation/bookings` | Create booking |

---

## Response Format

All API routes return JSON. Errors follow this shape:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

---

## Database Paths Reference

| Data | Firestore Path |
|------|---------------|
| Site settings | `sites/{siteId}/settings/general` |
| Module config | `sites/{siteId}/modules/{moduleName}/config` |
| POS orders | `sites/{siteId}/modules/byod_pos/orders` |
| Reservations | `sites/{siteId}/modules/reservation/bookings` |
| Members | `sites/{siteId}/modules/membership/members` |
| Inventory | `sites/{siteId}/modules/inventory/items` |
