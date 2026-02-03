# Implementation Plan - Optimize POS History Performance

The goal is to improve the loading performance of the POS History page by optimizing data fetching. Currently, the client fetches mixed orders and filters them, which is inefficient. We will implement server-side filtering for completed/cancelled orders.

## User Review Required
> [!NOTE]
> This change introduces a new firestore query index requirement for `status` ordering/filtering. You may see a "missing index" error in the console initially until the index is built.

## Proposed Changes

### POS Module
#### [MODIFY] [api.ts](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/api.ts)
- Implement `getHistoryOrders` function.
- Use `where('status', 'in', ['completed', 'cancelled', 'refunded'])` to fetch only relevant history items.
- Ensure proper ordering by `createdAt` descending.

#### [MODIFY] [TransactionsClient.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/admin/TransactionsClient.tsx)
- Replace `getPaginatedOrders` with `getHistoryOrders`.
- Remove the redundant client-side filtering logic `orders.filter(...)`.
- Update `loadOrders` to use the new API function.

### Bug Fixes (Completed/In-Progress)
#### [MODIFY] [order-tracker-context.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/order-tracker-context.tsx)
- Add guard clause to wait for user authentication before attaching Firestore listeners (Fixes "permission-denied" race condition).

### User Interface
#### [NEW] [HistoryBillRowSkeleton.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/admin/components/HistoryBillRowSkeleton.tsx)
- Create a skeleton component mimicking `HistoryBillRow`.

#### [MODIFY] [TransactionsClient.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/admin/TransactionsClient.tsx)
- Import `HistoryBillRowSkeleton`.
- Display 5-10 skeletons while `isInitial` loading is true.

- Display 5-10 skeletons while `isInitial` loading is true.

#### [MODIFY] [SettingsPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/admin/SettingsPage.tsx)
- Rename title to "POS SETTINGS".
- Rename description to "Configure POS system".
- Change grid breakpoints from `md:` to `xl:` for single-column tablet layout.

- Change grid breakpoints from `md:` to `xl:` for single-column tablet layout.

### Fix Public Category Visibility
**Root Cause**: 
1. `ensureCategoryExists` uses `updateDoc` which fails if the settings document doesn't exist yet. The Admin UI works because it derives categories client-side from items, ignoring the failing backend sync.
2. The Public UI (`MenuGrid.tsx`) relies strictly on the `settings.config` document categories.

#### [MODIFY] [api.ts](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/api.ts)
- Update `ensureCategoryExists` to use `setDoc` with `{ merge: true }` to ensure the document is created if missing.

#### [MODIFY] [MenuGrid.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/byod_pos/components/MenuGrid.tsx)
- Add fallback logic: If `settings.categories` is empty, derive categories from the initial fetch of items (similar to Admin logic) to ensure categories appear even if settings are empty.

### Automated Tests
- N/A

### Mobile/Tablet Layout Adjustment for Booking List
**Goal**: Optimize the Reservation List view for mobile/tablet.
- **Current**: Stacks List and Detail View, taking up too much vertical space.
- **Target**:
    - **Desktop (`lg+`)**: Keep side-by-side view (List + Details).
    - **Tablet/Mobile**: Show List ONLY. When clicking an item, show Details in an overlay (Sidebar for Tablet, Bottom Sheet for Mobile).

#### [MODIFY] [page.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/page.tsx)
- Update Grid Container: Ensure List takes full width on specific breakpoints.
- Hide "Desktop Detail Panel" on `< lg`.
- Add "Responsive Detail Overlay":
    - Renders only when `selectedBooking` is present and screen is `< lg` (via CSS `lg:hidden`).
    - Uses a `fixed inset-0` overlay.
    - Inside overlay: `BookingDetailPanel`.
    - Styling:
        - Mobile: Bottom Sheet style (`bottom-0 w-full rounded-t-3xl`).
        - Tablet: Sidebar style (`right-0 w-[600px] h-full`).

        - Tablet: Sidebar style (`right-0 w-[600px] h-full`).

### Move Membership Settings to Sidebar
**Goal**: Make the "Settings" link visible in the "Membership & Loyalty" sidebar group.
- **Current**: The route `/admin/membership/settings` is defined but marked as `hidden: true` in the module registration script.
- **Fix**: Update the registration script to remove `hidden: true` and add an icon. Then execute the script to update Firestore.

#### [MODIFY] [scripts/register-membership-module.ts](file:///Users/andre/Repository/clicker-alinaday/scripts/register-membership-module.ts)
- Remove `hidden: true` from the Settings route.
- Add `icon: 'settings'`.

#### [EXECUTE]
- Run `npx ts-node scripts/register-membership-module.ts` to apply changes to Firestore.

#### [EXECUTE]
- Run `npx ts-node scripts/register-membership-module.ts` to apply changes to Firestore.

### Optimize Mobile Member List Layout
**Goal**: Eliminate horizontal scrolling on mobile by switching to a card-based view.
- **Current**: Table view forces horizontal scroll on small screens.
- **Target**:
    - **Desktop**: Keep Table.
    - **Mobile/Tablet**: Card List.
    - **Card Design**:
        - Avatar + Name
        - Phone (small text)
        - Points (badge/highlight)
        - Entire card is clickable -> `/admin/membership/details?id=...`

#### [MODIFY] [MemberListPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/membership/admin/MemberListPage.tsx)
- Wrap existing `<table>` in `hidden md:block`.
- Add new Mobile/Tablet Card View (`md:hidden`).
- Map `filteredMembers` to styled cards.

- Map `filteredMembers` to styled cards.

### Restructure Reservation Admin Menu
**Goal**: Move implementation of dropdown menu items to the sidebar and remove the dropdown.

#### [NEW] [SettingsPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/SettingsPage.tsx)
- Create a new page component for "Global Settings".
- Move the specific settings (e.g., "Allow Staff Selection") from the modal in `ReservationDashboard` to here.

#### [MODIFY] [scripts/register-reservation-module.ts](file:///Users/andre/Repository/clicker-alinaday/scripts/register-reservation-module.ts)
- Create/Update this script to define the new menu structure:
    - **Reservation** (Dashboard)
    - **Calendar** (CalendarPage)
    - **Staff / Resources** (StaffPage)
    - **Settings** (SettingsPage)
    - *Note: I will also check where to put "Services". For now, I might add "Services" specific route or merge.* -> **Correction**: User didn't ask for Services. I'll check if "Resources" covers it.

#### [MODIFY] [ReservationDashboard (page.tsx)](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/page.tsx)
- Remove the "Menu" dropdown button and its logic.
- Remove the "Settings" modal logic.

#### [MODIFY] [ReservationDashboard (page.tsx)](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/page.tsx)
- Remove the "Menu" dropdown button and its logic.
- Remove the "Settings" modal logic.

### Merge Reservation Settings into Staff Page
**Goal**: Combine global settings (Staff Selection) into the Staff Management page to simplify navigation and fix 404.

#### [MODIFY] [AdminSidebar.tsx](file:///Users/andre/Repository/clicker-alinaday/app/admin/(dashboard)/AdminSidebar.tsx)
- Remove "Settings" link from Reservation hotfix.

#### [MODIFY] [StaffClient.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/staff/StaffClient.tsx)
- Add "Reservation Settings" section (Toggle for `allowStaffSelection`).
- Fetch and update settings using existing API.

#### [DELETE] [SettingsPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/SettingsPage.tsx)
- Remove unused file.

#### [DELETE] [SettingsPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/SettingsPage.tsx)
- Remove unused file.

### Optimize Inventory Mobile Layout
**Goal**: Implement responsive card view for Inventory list on mobile/tablet, similar to Membership page.

#### [MODIFY] [InventoryAdminPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/inventory/admin/InventoryAdminPage.tsx)
- Hide table on `xl` and below (`hidden xl:block`).
- Add Card Grid view for mobile/tablet (`block xl:hidden`).
- Card content: Name, SKU, Stock Level, Price.

- Card content: Name, SKU, Stock Level, Price.

### Verify Strict Modularity
**Goal**: Audit recent changes for cross-module dependency violations. Ensure that if a module is disabled (e.g. Membership, POS), the other modules (Reservation, Inventory) do not crash or show broken UI.

#### [AUDIT] [BookingDetailPanel.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/reservation/admin/components/BookingDetailPanel.tsx)
- Check `checkMembership` logic. It uses dynamic imports, which is correct. Ensure no top-level imports from `@/lib/modules/membership`.

#### [AUDIT] [InventoryAdminPage.tsx](file:///Users/andre/Repository/clicker-alinaday/lib/modules/inventory/admin/InventoryAdminPage.tsx)
- Check `fetchData` where it queries `modules/byod_pos/menu_items`. This is a direct Firestore query to another module's collection. While not strictly "code" coupling, we should ensure this doesn't break if POS is "disabled" (though Firestore collections always exist). Ideally, wrap this in a check or separate API.

#### [AUDIT] [AdminSidebar.tsx](file:///Users/andre/Repository/clicker-alinaday/app/admin/(dashboard)/AdminSidebar.tsx)
- Ensure hotfixes don't hardcode imports that might not exist if we were to remove a module folder (though that's unlikely in this monorepo structure). Focus on runtime "enabled" flags.

## Verification Plan

### Automated Tests
- None.

### Manual Verification
1.  **History Page Load**: Navigate to `/admin/pos/history`.
2.  **Performance**: Verify that the page loads faster and doesn't fetch "open" or "preparing" orders unnecessarily.
3.  **Pagination**: Scroll down to ensure "Load More" works correctly with the filtered query.
4.  **Empty State**: Verified that if no history exists, the empty state is shown correctly.
