# Clicker Alina Day

Welcome to **Clicker Alina Day**, a specialized module within the Clicker Platform designed to streamline interactions and improve efficiency for our day-to-day operations.

## Overview

This project is built with [Next.js](https://nextjs.org), leveraging its powerful features for server-side rendering and static site generation to ensure high performance and SEO optimization.

## Getting Started

To get the development environment running:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Clicker-Platform/clicker-alinaday.git
    cd clicker-alinaday
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    pnpm install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    # or
    pnpm dev
    ```

4.  Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

-   **Responsive Design:** Optimized for both desktop and mobile views.
-   **Integrated Functionality:** Seamlessly connects with other Clicker Platform services.
-   **Modern UI/UX:** Built with a focus on user experience and aesthetics.

**Project ID:** `alina-day-spa`
**Hosting Site:** `alina-day`
**Live URL:** [https://alina-day.web.app](https://alina-day.web.app)

## Learn More

To learn more about the technologies used:

-   [Next.js Documentation](https://nextjs.org/docs)
-   [Firebase Documentation](https://firebase.google.com/docs)

## Latest Updates (2026-02-03)

### 🛡️ Dynamic Permission System & RBAC Refactor
- **Full Dynamic Enforcement**: Removed hardcoded module restrictions. Access is now governed entirely by granular permissions stored in Firestore.
- **Role Consolidation**: Unified `owner` and `admin` roles into a single high-privilege `owner` role for simplicity.
- **View-Only Mode**: implemented strict "View-Only" enforcement for Staff roles across key modules:
  - **Inventory**: Staff can view stock but cannot create/edit items or adjust stock.
  - **POS**: Menu items are view-only for staff without explicit 'Menu Manager' permission.
  - **Membership**: Staff can view member details but cannot edit profiles or settings.
- **UX Improvements**: Replaced generic "Error" toast notifications with informative **"View Only Mode"** alerts (Blue/Info) to reduce user confusion.

### 🔧 Technical Improvements
- **Security**: Updated `firestore.rules` to use dynamic `hasWritePermission()` checks instead of static role checks.
- **Code Quality**: Fixed TypeScript errors in POS module and generic error handling.
- **Modularity**: Admin sidebar logic is now 100% data-driven based on enabled modules and user permissions.

---

## 🏗️ Architecture & Technical Reference

### 1. Technology Stack
- **Framework**: [Next.js 14+](https://nextjs.org/) (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS / Brutalist UI Design System
- **Backend & Database**: Firebase (Firestore, Auth, Storage, Functions)
- **State Management**: React Context (`UserContext`, `SiteContext`) + SWR/Realtime Listeners

### 2. Multi-Tenancy Architecture
The platform is built from the ground up to support multiple tenants (Sites) from a single codebase.
- **Site Resolution**: Middleware (`middleware.ts`) detects the tenant via `activeSite` cookie or URL parameters.
- **Data Isolation**: All tenant data is strictly scoped within Firestore under the `sites/{siteId}/` collection.
  - *Example*: `sites/cafe-alina/modules/byod_pos/orders`
- **Authentication**: Usage of **Auth Gateway** allows a single user identity to access multiple sites with different roles.

### 3. Module System
Feature sets are encapsulated into **Modules** that can be toggled per tenant.
- **Registry**: `lib/modules/registry.ts` manages dynamic loading of modules.
- **Core Modules**:
  - `byod_pos`: Point of Sale, Menu Management, Kitchen Display System (KDS).
  - `inventory`: Stock tracking, low stock alerts, ingredient linking.
  - `membership`: Customer loyalty, points system, history.
  - `reservation`: Table/Service booking engine, calendar view.
  - `sales-pipeline`: Lead tracking and CRM.
  - `ai-sales-agent`: AI-powered customer interaction bot.

### 4. Security & Permissions (RBAC)
Access control is implemented at both the Application and Database layers.
- **Roles**: Simplified to **Owner** (Full Access) and **Staff** (Granular Access).
- **Dynamic Permissions**: Staff access is defined by `moduleAccess` map in Firestore, allowing read/write toggles per module.
- **Enforcement**:
  - **UI Layer**: `usePermission()` hook hides/disables UI elements and shows "View Only" alerts.
  - **API Layer**: Server-side checks verify `moduleAccess` before processing requests.
  - **Database Layer**: `firestore.rules` uses `hasWritePermission()` helper to strictly enforce granular writes.

### 5. Deployment
- **Hosting**: Firebase Hosting (rewrites to Cloud Functions for SSR).
- **Environment**: Configured via `.env` and `.firebaserc`.
- **CI/CD**: Manual deployment via `firebase deploy`.
