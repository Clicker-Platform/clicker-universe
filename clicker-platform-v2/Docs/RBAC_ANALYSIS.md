# RBAC Architecture Analysis

**Date:** 2026-01-09
**Subject:** Role-Based Access Control (RBAC) System Review

## Executive Summary
The current system employs a hybrid RBAC approach. Security is **strongly enforced at the database level** via Firestore Security Rules, but **loosely handled at the client level** where route protection relies primarily on authentication state rather than explicit role verification.

## 1. Database Security (Firestore Rules)
**Status: Strong**
- **Authority**: The `modules/byod_pos/admins` collection is the source of truth for admin privileges.
- **Enforcement**:
  - `isAdmin()` helper function exists in `firestore.rules` to check for document existence in the admins collection.
  - Critical collections (`settings`, `menu_items`, `transactions`) are write-protected and often read-protected to Admins only.
  - `orders` collection implements a dual-access model:
    - **Admins**: Full Read/Update/Delete access.
    - **Owners**: Read/Update access to their own orders (`creatorId == request.auth.uid`).

## 2. Client-Side Security
**Status: Partial / Authentication-Focused**
- **Route Protection**:
  - `AdminGuard.tsx` protects `/admin/*` routes.
  - **Limitation**: It only verifies that a user is **logged in** (`firebase/auth`). It does *not* verify if the user has the `admin` role.
  - **Result**: Any authenticated user can access admin routes, though they will likely see empty pages or errors because Firestore Rules will reject their data requests.
- **UI Logic**:
  - `AdminSidebar.tsx` does not appear to filter menu items based on roles (it renders based on enabled modules).
  - Implicit security: UI will likely fail to load data for unauthorized users.

## 3. Role Assignment
**Status: Self-Service / Dev-Tooling**
- **Mechanism**: Roles are assigned via the `/admin/claim-admin` page.
- **Logic**: The page writes to `modules/byod_pos/admins/{uid}` with `{ role: 'admin' }`.
- **Security**: The write is allowed because `firestore.rules` permits a user to write to their own admin document (`request.auth.uid == adminId`). This effectively allows *anyone* to make themselves an admin if they know this URL. This is likely intended for development/bootstrapping but is a security risk for production.

## Recommendations
1.  **Hardening Route Protection**: Update `AdminGuard` to fetch and verify the admin status from `modules/byod_pos/admins` before rendering children.
2.  **Locking Down Assignment**: Remove the self-service `allow write` rule for `admins/{adminId}` in production, or restrict it to only existing admins.
3.  **UI Feedback**: Implement explicit "Unauthorized" states in UI components rather than letting them fail silently or with generic errors.
