# Product Requirements — Clicker Universe

Product specs and PRDs that ground agent work in business intent.

---

## Platform Vision

Clicker Universe is a **multi-tenant SaaS platform** for local businesses in Indonesia. Each business (tenant) gets:

1. A public biolink/website (customizable via Canvas Studio)
2. An admin dashboard
3. Optional add-on modules based on business type

---

## Modules — Business Requirements

### byod_pos — Self Order POS
- Customers scan QR code at table and order directly from their phone
- Business owner manages orders and menu from admin dashboard
- Orders update in real-time via Firestore listeners
- Multi-branch support: each branch has its own menu and order queue

### reservation — Booking System
- Service-based businesses (salons, clinics) accept appointments online
- Customers pick service → staff → time slot
- Staff manage their own availability
- Waitlist support when slots are full

### inventory — Stock Management
- Track stock levels per product/item
- Log every in/out movement with audit trail
- Alert when stock falls below threshold

### membership — Loyalty Program
- Customers earn points on purchases
- Configurable tiers and rewards
- Member profile with transaction history

### ai_sales_agent — AI Chat Widget
- Gemini-powered chat widget on public tenant page
- Answers questions about products, services, hours, pricing
- Configured per tenant with custom persona and knowledge base

### sales_pipeline — CRM Kanban
- Visual pipeline for tracking leads and deals
- Custom stages per tenant
- Integration with Core CRM contacts

---

## Core Features — Business Requirements

### Canvas Studio (Page Builder)
- Drag-and-drop block editor for public pages
- Responsive preview: mobile / tablet / desktop
- Blocks: Hero, Gallery, FAQ, Map, Products Grid, Text, Links, Social embeds

### Appearance & Templates
- 5 prebuilt templates (themes) per tenant
- Per-template customization: colors, fonts, brand assets

### Core CRM
- Contact forms from public page feed into Inbox
- Owner manages leads and customer messages from admin
