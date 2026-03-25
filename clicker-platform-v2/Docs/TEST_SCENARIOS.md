# Integration Test Scenarios
## Reservation → Service Records → Member Portal

> No test runner is wired up yet. Install `vitest` + `@testing-library/react` + Firebase Emulator
> to execute these. Each scenario maps to one `describe` block.

---

## Suite 1 — Reservation Booking → Service Record Bridge (B1)

### Scenario 1.1 — Happy path: start service record from confirmed booking
```
GIVEN a booking with status='confirmed', customerPhone='+628123456789', totalPrice=500000
  AND service_records module is enabled
  AND no serviceRecordId is set on the booking
WHEN admin enters plate 'B1234XYZ' and clicks "Create Record"
THEN createServiceRecord() is called with:
     - vehiclePlate = 'B1234XYZ'
     - vehicleId   = 'B1234XYZ'
     - memberName  = booking.customerName
     - memberPhone = booking.customerPhone
     - serviceTypeId   = booking.serviceId
     - serviceTypeName = booking.serviceName
     - totalAmount = 500000
     - bookingId   = booking.id
     - bookingSource = 'reservation'
     - status      = 'DRAFT'  (default set by createServiceRecord)
  AND updateBookingDetails() is called with { serviceRecordId: <new SR id> }
  AND browser navigates to /admin/service-records/<new SR id>
```

### Scenario 1.2 — service_records module disabled
```
GIVEN a confirmed booking
  AND service_records module is NOT enabled
WHEN admin views BookingDetailPanel
THEN the "Start Service Record" button is NOT rendered
  AND "Mark Completed" button IS rendered (normal flow)
```

### Scenario 1.3 — booking already has a linked service record
```
GIVEN a booking with status='confirmed', serviceRecordId='sr_abc123'
  AND service_records module is enabled
WHEN admin views BookingDetailPanel
THEN "Start Service Record" button is NOT shown
  AND "Service in Progress" info card IS shown
  AND "Mark Completed" button is NOT shown
  AND "View Record" link points to /admin/service-records/sr_abc123
```

### Scenario 1.4 — plate input normalization
```
GIVEN admin enters plate 'b 1234 xyz' (lowercase with spaces)
WHEN Create Record is clicked
THEN createServiceRecord is called with vehiclePlate='B1234XYZ' (normalized)
```

### Scenario 1.5 — plate field is empty, Enter pressed
```
GIVEN plateInput is '' (empty string)
WHEN admin presses Enter
THEN handleStartServiceRecord() is NOT called (button is disabled)
```

### Scenario 1.6 — createServiceRecord fails (network error)
```
GIVEN createServiceRecord() throws an error
WHEN admin submits the plate modal
THEN an alert is shown: "Failed to create service record. Please try again."
  AND showPlateModal remains true (modal stays open)
  AND the booking is NOT updated (updateBookingDetails is NOT called)
```

---

## Suite 2 — Service Record Approval → Downstream integrations (approveRecord)

### Scenario 2.1 — Approve without warranty, no optional modules
```
GIVEN a service record with status='PENDING_APPROVAL', paymentStatus='PAID'
  AND hasWarranty=false
  AND no inventoryItemId
  AND no bookingId
  AND membership module disabled
  AND inventory module disabled
WHEN approveRecord() is called
THEN record status is updated to 'COMPLETED'
  AND no warrantyCard is created
  AND no reminder queue entries are written
  AND no points are awarded
  AND no booking is updated
```

### Scenario 2.2 — Approve WITH warranty card
```
GIVEN a service record with hasWarranty=true, warrantyMonths=12
  AND config.featuresEnabled.warrantyCards=true
WHEN approveRecord() is called
THEN a warrantyCard document is created with:
     - warrantyCode matching format {PREFIX}-{YEAR}-{4chars}
     - warrantyMonths=12
     - status='ACTIVE'
     - expiryDate ≈ now + 12 months
  AND record.warrantyCardId is set to the new card's id
```

### Scenario 2.3 — Approve with warranty, warranty code collision on first attempt
```
GIVEN generateWarrantyCode produces a code that already exists on attempt 1
  AND produces a unique code on attempt 2
WHEN approveRecord() is called
THEN it retries and the second unique code is used
```

### Scenario 2.4 — Approve: all 3 retry attempts produce duplicate codes
```
GIVEN generateWarrantyCode() always produces existing codes (all 3 attempts)
WHEN approveRecord() is called
THEN it throws 'Could not generate unique warranty code after retries'
  AND the batch is NOT committed (record stays PENDING_APPROVAL)
```

### Scenario 2.5 — Approve with linked booking → auto-complete
```
GIVEN a service record with bookingId='bk_001', bookingSource='reservation'
WHEN approveRecord() is called successfully
THEN updateBookingDetails(siteId, 'bk_001', { serviceRecordId: recordId }) is called
  AND updateBookingStatus(siteId, 'bk_001', 'completed') is called
```

### Scenario 2.6 — Approve with linked booking → booking auto-complete fails silently
```
GIVEN updateBookingStatus() throws a network error
WHEN approveRecord() is called
THEN the record still becomes 'COMPLETED' (batch already committed)
  AND error is console.error'd but not thrown
  AND the function resolves without throwing
```

### Scenario 2.7 — Approve with inventoryItemId → stock deduction
```
GIVEN record.inventoryItemId='inv_abc', record.inventoryDeducted=false (or undefined)
  AND inventory module is enabled
WHEN approveRecord() is called
THEN updateStock(siteId, 'inv_abc', -1, 'sale', recordId, serviceTypeName) is called
  AND record.inventoryDeducted is set to true
```

### Scenario 2.8 — Approve with inventoryItemId already deducted (idempotency)
```
GIVEN record.inventoryDeducted=true
WHEN approveRecord() is called
THEN updateStock() is NOT called again
```

### Scenario 2.9 — Approve: inventory deduction fails silently
```
GIVEN updateStock() throws a network error
WHEN approveRecord() is called
THEN the record still becomes 'COMPLETED'
  AND error is console.error'd but not thrown
  AND inventoryDeducted is NOT set (so it can be retried / reconciled manually)
```

### Scenario 2.10 — Approve with membership points: member exists
```
GIVEN record.memberId='member_001', totalAmount=500000
  AND membership module enabled, settings.enableLoyalty=true, settings.earningRatio=0.01
WHEN approveRecord() is called
THEN awardPointsWithSpend(siteId, 'member_001', 5000, 500000, 'SERVICE_RECORDS', recordId) is called
  AND record.loyaltyPointsAwarded = 5000
```

### Scenario 2.11 — Approve with membership points: loyalty disabled
```
GIVEN record.memberId='member_001'
  AND settings.enableLoyalty=false
WHEN approveRecord() is called
THEN awardPointsWithSpend() is NOT called (awardPointsWithSpend early-returns on enableLoyalty=false)
  AND record.loyaltyPointsAwarded is NOT set
```

### Scenario 2.12 — Approve with membership points: points calc rounds down
```
GIVEN totalAmount=99, earningRatio=0.1
THEN points awarded = Math.floor(99 * 0.1) = 9 (not 9.9)
```

### Scenario 2.13 — Approve record that is NOT in PENDING_APPROVAL state
```
GIVEN record.status='IN_PROGRESS'
WHEN approveRecord() is called
THEN it throws 'Only PENDING_APPROVAL records can be approved'
  AND no database writes occur
```

### Scenario 2.14 — Approve record with paymentStatus NOT 'PAID'
```
GIVEN record.status='PENDING_APPROVAL', record.paymentStatus='PARTIAL'
WHEN approveRecord() is called
THEN it throws 'Payment must be PAID before approval'
```

---

## Suite 3 — Double Points Guard (A3)

### Scenario 3.1 — Complete booking WITH service record: skip points
```
GIVEN booking.serviceRecordId='sr_001' (has linked service record)
  AND service_records module is enabled
  AND membership module is enabled
WHEN updateBookingStatus(siteId, bookingId, 'completed') is called
THEN findMemberByPhone() is NOT called
  AND awardPointsWithSpend() is NOT called
  AND log message: "Skipping points for booking ... — handled by Service Records approval"
```

### Scenario 3.2 — Complete booking WITHOUT service record: award points normally
```
GIVEN booking.serviceRecordId is undefined/null
  AND service_records module is enabled
  AND membership module is enabled
  AND booking.customerPhone matches a member
WHEN updateBookingStatus(siteId, bookingId, 'completed') is called
THEN awardPointsWithSpend() IS called with source='RESERVATION'
```

### Scenario 3.3 — Complete booking: service_records disabled, membership enabled
```
GIVEN service_records module NOT enabled
  AND membership module enabled
WHEN updateBookingStatus() → 'completed'
THEN points ARE awarded (normal path, guard is not triggered)
```

### Scenario 3.4 — Complete booking: both modules disabled
```
GIVEN both service_records and membership disabled
WHEN updateBookingStatus() → 'completed'
THEN no points logic runs
  AND function resolves successfully
```

### Scenario 3.5 — Complete booking: customer has no matching member record
```
GIVEN membership enabled, service_records disabled (no SR guard)
  AND findMemberByPhone() returns null
WHEN updateBookingStatus() → 'completed'
THEN awardPointsWithSpend() is NOT called (no member found)
```

### Scenario 3.6 — Re-completing an already-completed booking (idempotency)
```
GIVEN booking.status is already 'completed'
WHEN updateBookingStatus(siteId, bookingId, 'completed') is called again
THEN the first guard (status === 'completed' && booking.status !== 'completed') is FALSE
  AND awardPointsWithSpend() is NOT called again
```

---

## Suite 4 — Service Record Status State Machine

### Scenario 4.1 — Valid transitions
```
DRAFT          → IN_PROGRESS       ✓
DRAFT          → CANCELLED         ✓
IN_PROGRESS    → PENDING_APPROVAL  ✓ (only when paymentStatus='PAID')
IN_PROGRESS    → CANCELLED         ✓
PENDING_APPROVAL → IN_PROGRESS     ✓
PENDING_APPROVAL → COMPLETED       ✓ (approveRecord)
PENDING_APPROVAL → CANCELLED       ✓
COMPLETED      → (any)             ✗  throws: "COMPLETED records are immutable"
```

### Scenario 4.2 — submitForApproval: missing PAID payment
```
GIVEN record.status='IN_PROGRESS', record.paymentStatus='PARTIAL'
WHEN submitForApproval() is called
THEN throws 'Payment must be PAID before submitting for approval'
```

### Scenario 4.3 — cancelRecord: reason is empty string
```
GIVEN cancelReason=''
WHEN cancelRecord() is called
THEN throws 'Cancel reason is required'
```

### Scenario 4.4 — cancelRecord: reason is whitespace only
```
GIVEN cancelReason='   '
WHEN cancelRecord() is called
THEN throws 'Cancel reason is required' (trim check)
```

### Scenario 4.5 — updateServiceRecord on COMPLETED record
```
GIVEN record.status='COMPLETED'
WHEN updateServiceRecord() is called with any updates
THEN throws 'COMPLETED records are immutable...'
```

---

## Suite 5 — RecordFormPage: Inventory Picker (B6)

### Scenario 5.1 — Inventory enabled: shows dropdown with item stock
```
GIVEN inventory module is enabled
  AND getInventory() returns [{ id:'i1', name:'Nano Coat A', currentStock:5, unit:'bottle' }]
WHEN the form renders
THEN a <select> is shown with option "Nano Coat A (Stock: 5 bottle)"
  AND the free-text input is NOT shown (while no item selected)
```

### Scenario 5.2 — Select inventory item: sets productUsed automatically
```
GIVEN the dropdown shows 'Nano Coat A' (id='i1')
WHEN user selects 'i1'
THEN productUsed state = 'Nano Coat A'
  AND inventoryItemId state = 'i1'
  AND "1 unit will be deducted from inventory on approval." message is shown
```

### Scenario 5.3 — Clear inventory item: free-text input reappears
```
GIVEN user selected item 'i1' from dropdown
WHEN user selects the blank "— Select from inventory —" option
THEN inventoryItemId = null
  AND free-text input reappears
  AND productUsed = '' (cleared since it was set from item name)
```

### Scenario 5.4 — Inventory disabled: shows free-text input only
```
GIVEN inventory module is NOT enabled
WHEN the form renders
THEN no dropdown is shown
  AND free-text input with placeholder "e.g. Ceramic Pro Gold 9H" is shown
```

### Scenario 5.5 — Inventory enabled but no items exist: shows free-text
```
GIVEN inventory module enabled
  AND getInventory() returns [] (empty list)
WHEN the form renders
THEN no dropdown is shown (inventoryItems.length === 0 guard)
  AND free-text input is shown
```

### Scenario 5.6 — inventoryItemId persists in edit mode
```
GIVEN editing an existing record with inventoryItemId='i1', productUsed='Nano Coat A'
WHEN the form loads
THEN inventoryItemId state = 'i1'
  AND the dropdown shows 'i1' as selected
```

### Scenario 5.7 — Save: inventoryItemId included in record data
```
GIVEN user selected inventoryItemId='i1'
WHEN handleSave() is called
THEN createServiceRecord() / updateServiceRecord() receives inventoryItemId='i1'
```

---

## Suite 6 — staffLabel Dynamic Terminology (B7)

### Scenario 6.1 — Default terminology (no setting)
```
GIVEN staffLabel is not set in ReservationSettings (defaults to 'Staff')
WHEN booking wizard step 2 renders
THEN step header is "Select Staff"
  AND "Any Available Staff" option is shown
```

### Scenario 6.2 — Custom label: 'Technician'
```
GIVEN settings.staffLabel='Technician'
WHEN StaffStep renders
THEN "Any Available Technician" is shown
WHEN BookingForm step 2 header renders
THEN "Select Technician" is shown
WHEN StaffClient header renders
THEN "Technician / Resources" is shown
  AND toggle label reads "Allow Technician Selection"
  AND toggle description reads "...choose a specific technician during booking."
```

### Scenario 6.3 — Empty staffLabel falls back to 'Staff'
```
GIVEN settings.staffLabel='' (empty string)
WHEN any component uses staffLabel || 'Staff'
THEN fallback to 'Staff' applies correctly
```

### Scenario 6.4 — ReservationSettingsPage: save staffLabel
```
GIVEN user types 'Therapist' in the staffLabel input
WHEN Save Settings is clicked
THEN updateReservationSettings(siteId, { allowStaffSelection: ..., staffLabel: 'Therapist' }) is called
  AND success toast appears: "Settings saved"
```

### Scenario 6.5 — ReservationSettingsPage: live preview updates as you type
```
GIVEN user types 'Stylist' in the staffLabel input
THEN preview text shows: `"Any Available Stylist"` and `"Select a Stylist"` immediately
```

---

## Suite 7 — Member Dashboard Widgets (B3 + B4)

### Scenario 7.1 — MemberWarrantyWidget: shows active warranties
```
GIVEN memberPhone='+628123456789'
  AND warrantyCards collection has 1 ACTIVE card for this phone:
      { warrantyCode:'MRB-2026-AB12', serviceTypeName:'Nano Coating', vehiclePlate:'B1234XYZ', expiryDate: 6 months from now }
WHEN MemberWarrantyWidget renders
THEN the card is shown with warranty code, service type, vehicle plate, and days remaining
  AND a link to /warranty/MRB-2026-AB12 is rendered
```

### Scenario 7.2 — MemberWarrantyWidget: no active warranties → renders nothing
```
GIVEN no ACTIVE warrantyCards for this phone
WHEN MemberWarrantyWidget renders
THEN component returns null (nothing rendered)
```

### Scenario 7.3 — MemberWarrantyWidget: VOIDED card not shown
```
GIVEN a warrantyCard with status='VOIDED'
WHEN MemberWarrantyWidget renders
THEN that card is NOT shown (query filters on status='ACTIVE')
```

### Scenario 7.4 — MemberWarrantyWidget: no memberPhone and no memberId → renders nothing
```
GIVEN memberPhone=undefined, memberId=undefined
WHEN MemberWarrantyWidget renders
THEN setLoading(false) is called immediately
  AND no Firestore query is made
  AND component returns null
```

### Scenario 7.5 — MemberServiceHistoryWidget: shows history list
```
GIVEN memberId='m001'
  AND serviceRecords has 3 records for this member, ordered by updatedAt desc
WHEN MemberServiceHistoryWidget renders
THEN all 3 records are shown with serviceName, vehiclePlate, status badge, date
```

### Scenario 7.6 — MemberServiceHistoryWidget: CANCELLED record shows red badge
```
GIVEN a service record with status='CANCELLED'
WHEN the widget renders
THEN a red "Cancelled" badge is shown
```

### Scenario 7.7 — MemberServiceHistoryWidget: falls back to memberPhone when no memberId
```
GIVEN memberId=undefined, memberPhone='081234567890'
WHEN MemberServiceHistoryWidget renders
THEN Firestore query uses where('memberPhone', '==', '081234567890')
  AND results are shown
```

---

## Suite 8 — RecordDetailPage: Booking Source Card (B5)

### Scenario 8.1 — SR from booking: shows source card
```
GIVEN record.bookingId='bk_001', record.bookingSource='reservation'
WHEN RecordDetailPage renders
THEN a blue info card is shown: "Created from Reservation Booking"
  AND a "View Booking" link points to /admin/reservations/bookings?id=bk_001
```

### Scenario 8.2 — SR created manually (no bookingId): source card not shown
```
GIVEN record.bookingId=undefined
WHEN RecordDetailPage renders
THEN the blue source card is NOT rendered
```

### Scenario 8.3 — SR has bookingId but bookingSource is not 'reservation'
```
GIVEN record.bookingId='bk_001', record.bookingSource=undefined
WHEN RecordDetailPage renders
THEN the blue source card is NOT rendered (both conditions must be true)
```

---

## Suite 9 — Edge Cases & Error Boundaries

### Scenario 9.1 — handleStartServiceRecord: siteId is null/undefined
```
GIVEN siteId is null (context not loaded yet)
WHEN handleStartServiceRecord() is called
THEN the function returns early without calling createServiceRecord
```

### Scenario 9.2 — Booking with no customerPhone: SR creation still works
```
GIVEN booking.customerPhone='' (empty)
WHEN Start Service Record is clicked
THEN createServiceRecord is called with memberPhone=''
  AND no crash occurs
```

### Scenario 9.3 — Booking with no totalPrice (0)
```
GIVEN booking.totalPrice=0 or undefined
WHEN Start Service Record is clicked
THEN createServiceRecord is called with totalAmount=0
  AND no crash occurs
```

### Scenario 9.4 — approveRecord: memberId is null, award skipped
```
GIVEN record.memberId=undefined/null
  AND membership module enabled
WHEN approveRecord() is called
THEN awardPointsWithSpend() is NOT called (guard: if membershipEnabled && record.memberId)
```

### Scenario 9.5 — Phone number normalization in findMemberByPhone
```
GIVEN member stored with phoneNumber='081234567890'
WHEN findMemberByPhone is called with '+6281234567890'
  AND when called with '6281234567890'
THEN both return the same member (normalization converts to consistent format)
```

### Scenario 9.6 — updateStock: item does not exist
```
GIVEN inventoryItemId references a deleted/non-existent item
WHEN updateStock() is called from approveRecord
THEN throws "Item does not exist!"
  AND error is caught by the non-blocking wrapper in approveRecord
  AND record still becomes COMPLETED
```

### Scenario 9.7 — Warranty card creation: warrantyMonths=0 fallback
```
GIVEN record.hasWarranty=true, record.warrantyMonths=0
WHEN approveRecord() is called
THEN warrantyMonths defaults to 12 (line: const warrantyMonths = record2.warrantyMonths || 12)
```

### Scenario 9.8 — awardPointsWithSpend: earningRatio=0 produces 0 points
```
GIVEN settings.earningRatio=0
THEN points = Math.floor(totalAmount * 0) = 0
  AND awardPointsWithSpend is NOT called (guard: if points > 0)
```

### Scenario 9.9 — getReservationSettings: missing staffLabel defaults to 'Staff'
```
GIVEN Firestore settings document has no staffLabel field
WHEN getReservationSettings() is called
THEN returned settings.staffLabel='Staff' (from defaults object)
```

### Scenario 9.10 — Concurrent plate lookup: multiple booking panels open
```
GIVEN two separate booking panels are open simultaneously
WHEN each admin enters a different plate and clicks Create
THEN each creates an independent service record without interference
```

---

## Test Setup Notes

```typescript
// Recommended stack (not yet installed):
// vitest + @testing-library/react + msw (mock firebase) OR firebase emulator

// For firebase-backed tests, use:
// firebase emulators:start --only firestore,auth

// Mock pattern for module registry:
vi.mock('@/lib/modules/registry', () => ({
    isModuleEnabled: vi.fn().mockImplementation((moduleId) => {
        return Promise.resolve(['membership', 'service_records', 'inventory'].includes(moduleId));
    })
}));

// Booking fixture:
const mockBooking = {
    id: 'bk_001', serviceId: 'svc_001', serviceName: 'Nano Coating',
    customerName: 'Budi Santoso', customerEmail: 'budi@test.com',
    customerPhone: '081234567890', status: 'confirmed',
    totalPrice: 500_000, startAt: Timestamp.now(), endAt: Timestamp.now(),
};

// Service record fixture:
const mockRecord = {
    id: 'sr_001', vehicleId: 'B1234XYZ', vehiclePlate: 'B1234XYZ',
    serviceTypeId: 'svc_001', serviceTypeName: 'Nano Coating',
    hasWarranty: true, warrantyMonths: 12,
    status: 'PENDING_APPROVAL', paymentStatus: 'PAID',
    totalAmount: 500_000, amountPaid: 500_000,
    bookingId: 'bk_001', bookingSource: 'reservation',
    inventoryItemId: 'inv_001', inventoryDeducted: false,
    memberId: 'member_001', memberName: 'Budi Santoso',
    createdBy: 'admin@test.com', outletId: 'site_001',
    createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
};
```
