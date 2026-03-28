# Changelog

All notable changes to the Clicker Platform v2 project will be documented in this file.

---

## [Unreleased] - 2026-03-28

### Added

- **DeviceView Context System** — New `DeviceViewContext.tsx` with `useDeviceView()` hook and `dv()` helper, allowing all public blocks and layout components to respond to Canvas Studio's device preview (mobile/tablet/desktop) instead of relying solely on CSS media queries. Adopted across: DefaultHeroBlock, DefaultFAQBlock, DefaultImageBlock, DefaultImageGalleryBlock, DefaultTextBlock, MrbHero, MrbQuickActions, ResponsiveNavBar, BottomNavBar, SharedPageLayout, and FullScreenGallery.
- **Warranty Card PDF Generation** — New `WarrantyCardPdf.tsx` component using `@react-pdf/renderer`. The `/api/warranty/[warrantyCode]/pdf` route now generates and streams a real PDF download instead of redirecting to the public page.
- **AI Sales Agent Lazy Loading** — New `ChatWidgetLoader.tsx` that lazy-loads the chat widget. Tenant layout now fetches lightweight public data and passes `agentName` to the loader for improved performance.
- **PageStudio Global Settings Refresh** — Added `refreshGlobalSettings()` and `updateGlobalSettings()` to `PageStudioContext`, enabling panels (e.g., SiteInfoPanel) to update the live Canvas Studio preview immediately after saving.
- **Server-side Reservation Data Hydration** — Tenant page now calls `hydratePageBlocks()` to pre-fetch reservation services, staff, and settings in parallel, passing them as props to blocks.
- **Confirmation Dialog for Void Warranty** — `RecordDetailPage` replaced `window.confirm()` with a proper `ConfirmationDialog` component for voiding warranty cards.
- **Dependencies** — Added `@react-pdf/renderer` and related packages.

### Changed

- **Service Records Module — Dark Mode & UI Overhaul** — Comprehensive dark mode support (`dark:` classes) and UI consistency improvements across all admin pages: RecordDetailPage, RecordFormPage, RecordsListPage, RemindersPage, ServiceTypesPage, SettingsPage, VehiclesPage, PaymentStatusBadge, and RecordStatusBadge.
- **Canvas Studio Preview Improvements** — Preview now wraps content in `DeviceViewProvider`; navbar respects device view (`forceMobile` only when not desktop); removed extra padding/margins for tighter preview layout.
- **Admin Dashboard Typography Cleanup** — Replaced `font-black uppercase` headers with cleaner `font-bold` styling and proper dark mode text colors (`dark:text-neutral-100`) across Dashboard, TemplateClient, and other admin pages.
- **Admin Sidebar Simplification** — Removed "Team" from core nav items and dropped the "Organization" sidebar group.
- **Warranty Card Page** — Switched from `firebase-admin` to client SDK `collectionGroup` query; builds warranty URL server-side to avoid QR code hydration mismatch.
- **Reservation Module UI** — Expanded `BookingDetailPanel` with additional booking detail fields; minor refinements to `ServicesClient`.
- **Block Responsive Behavior** — All public blocks now use `dv()` helper for responsive classes (grid columns, padding, font sizes, margins) ensuring accurate Canvas Studio preview at all device sizes.
- **SiteInfoPanel** — Now calls `refreshGlobalSettings()` after save so Canvas Studio preview updates immediately.
- **Next.js Config** — Added new configuration entries in `next.config.mjs`.
- **Minor Fixes** — Dark mode class additions across multiple admin module pages (AI Sales Agent, BYOD POS, Inventory, Membership, Reservation, Forms, Inbox, Links, Products, Sales Pipeline, Settings).
