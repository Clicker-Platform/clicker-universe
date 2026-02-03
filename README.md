# Clicker Universe (Monorepo)

Welcome to the **Clicker Universe**, the central repository for the entire Clicker ecosystem. This is a **Monorepo** containing multiple distinct applications that work together.

## 📂 Project Structure

This repository is organized into the following services:

### 1. [Clicker Platform V2](./clicker-platform-v2)
**`clicker-platform-v2/`**
The core **Multi-Tenant SaaS Platform**.
- **Tech**: Next.js 14, Firebase, Tailwind.
- **Features**: Dynamic Permissions, Module System, Inventory, POS, Membership.
- **Multi-Tenancy**: Serves multiple sites (Tenants) from a single codebase using `siteId` scoping.

### 2. [Auth Gateway](./auth-gateway)
**`auth-gateway/`**
The centralized authentication service.
- Handles user login/registration across the ecosystem.
- Provides unified session management.

### 3. [Backyard](./backyard)
**`backyard/`**
The **Super Admin** dashboard for internal management.
- Used by Clicker staff/admins to manage tenants (create sites, toggle modules, billing).

## 🚀 Getting Started

To work on a specific project, navigate to its directory:

```bash
# To work on the main platform
cd clicker-platform-v2
npm install
npm run dev

# To work on the auth gateway
cd auth-gateway
npm install
npm run dev
```

## 🏗️ Architecture Note
This is a **Multi-Tenant** system managed within a **Monorepo**.
- **Multi-Tenant**: The code in `clicker-platform-v2` supports multiple customers (sites) simultaneously.
- **Monorepo**: All related micro-services and apps are stored in this single Git repository for easier versioning and code sharing.
