# Implementation Plan: Multi-Branch POS

## Goal
Mendukung skenario **1 Tenant dengan banyak Cabang**, di mana setiap cabang memiliki POS terpisah (menu, order, dan settings sendiri).

---

## 🗄️ Firestore Structure (Complete)

### Site-Level Data (Global)
```
/sites/{siteId}/
├── content/                    # Profile, settings, branding
├── team/{userId}               # Site-level staff (Admin/Owner)
│   ├── email, name, role
│   └── permissions[]
├── modules/
│   ├── byod_pos/
│   │   └── categories/         # [GLOBAL] Kategori menu bersama
│   └── ...other modules
└── branches/{branchId}/        # Branch data
    ├── name, address, phone
    ├── isActive, order
    └── modules/
        └── byod_pos/           # [NEW] Branch-specific POS
            ├── menu_items/{itemId}
            ├── orders/{orderId}
            ├── settings/config
            └── staff/{userId}  # Branch-level staff
```

### Branch-Level POS Data (NEW)
```
/sites/{siteId}/branches/{branchId}/modules/byod_pos/

├── menu_items/{itemId}
│   ├── name: string
│   ├── price: number
│   ├── category: string
│   ├── description: string
│   ├── imageUrl: string
│   ├── images: string[]
│   ├── isActive: boolean
│   └── variants: ProductVariant[]
│
├── orders/{orderId}
│   ├── items: CartItem[]
│   ├── total: number
│   ├── status: 'open' | 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'
│   ├── customerName: string
│   ├── tableNumber: string
│   ├── orderType: 'dine-in' | 'takeaway' | 'delivery'
│   ├── createdAt: Timestamp
│   └── paymentStatus: 'unpaid' | 'pending_confirmation' | 'paid'
│
├── settings/config
│   ├── mode: 'open-bill' | 'fast-checkout'
│   ├── paymentMethods: { cash, card, qris }
│   ├── taxSettings: TaxSettings
│   ├── requireTableNumber: boolean
│   ├── businessName: string
│   └── businessAddress: string
│
└── staff/{userId}
    ├── userId: string
    ├── email: string
    ├── name: string
    ├── role: string           # Label (e.g., "Kasir", "Staff")
    └── assignedAt: Timestamp
```

---

## 📁 Storage Bucket Structure

### Current (Site-Level)
```
gs://project-id.appspot.com/
└── sites/{siteId}/
    ├── profile/               # Avatar, logo
    ├── products/              # Product images
    ├── media/                 # General uploads
    └── pos/
        └── menu_items/        # POS menu images
```

### After Multi-Branch (Branch-Level)
```
gs://project-id.appspot.com/
└── sites/{siteId}/
    ├── profile/               # Site-level branding
    ├── products/              # Global product images
    ├── media/                 # General uploads
    └── branches/{branchId}/   # [NEW] Branch-specific
        └── pos/
            ├── menu_items/    # Branch menu images
            └── receipts/      # Receipt/invoice files (optional)
```

### Storage Security Rules
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Site-level storage (existing)
    match /sites/{siteId}/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin(siteId);
    }
    
    // Branch-level storage (NEW)
    match /sites/{siteId}/branches/{branchId}/{allPaths=**} {
      allow read: if true;
      allow write: if isAdmin(siteId) || isBranchStaff(siteId, branchId);
    }
  }
}
```

---

## 👥 Staff Hierarchy

### Two-Level Staff System
```
┌─────────────────────────────────────────────────────┐
│  SITE-LEVEL STAFF (Admin/Owner)                     │
│  Path: /sites/{siteId}/team/{userId}                │
│  ────────────────────────────────────────────────   │
│  • Akses ke SEMUA cabang                            │
│  • Kelola menu, settings, laporan global            │
│  • Assign staff ke branch                           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  BRANCH-LEVEL STAFF (Kasir/Staff)                   │
│  Path: /sites/{siteId}/branches/{branchId}/         │
│        modules/byod_pos/staff/{userId}              │
│  ────────────────────────────────────────────────   │
│  • Akses HANYA ke cabang yang ditugaskan            │
│  • Handle order, update status                      │
│  • Tidak bisa kelola menu/settings                  │
└─────────────────────────────────────────────────────┘
```

### Access Matrix
| Staff Type | All Branches | Manage Menu | Manage Staff | View Reports |
|------------|--------------|-------------|--------------|--------------|
| Owner/Admin (Site) | ✅ | ✅ | ✅ | ✅ |
| Branch Staff | ❌ (assigned only) | ❌ | ❌ | ❌ |

### Auth Flow
```
Login via Auth Gateway (tidak berubah)
    ↓
Token: { siteId, role }
    ↓
Platform v2 cek staff level:
    ├── /sites/{siteId}/team/{userId}? → Site-level (semua akses)
    └── /branches/{branchId}/staff/{userId}? → Branch-level (terbatas)
```

> [!NOTE]
> Auth Gateway TIDAK perlu diubah. Pengecekan branch dilakukan di Platform v2.

---



## Proposed Changes

### API Layer (`lib/modules/byod_pos/api.ts`)

#### [MODIFY] [api.ts](file:///Users/mac/Documents/AI%20Project/Clicker/clicker-platform-multi-tenant/clicker-platform-v2/lib/modules/byod_pos/api.ts)

**Perubahan Utama:**
1. Tambah parameter `branchId` ke semua fungsi yang berinteraksi dengan data POS
2. Buat helper `getBranchPOSPath(siteId, branchId)` untuk konsistensi path
3. Update fungsi-fungsi berikut:
   - `getMenuItems(siteId, branchId, ...)` 
   - `getPOSSettings(siteId, branchId)`
   - `subscribeToRecentOrders(siteId, branchId, ...)`
   - `createOrder(siteId, branchId, ...)`
   - dll.

**Contoh Perubahan:**
```typescript
// Helper function
function getBranchPOSPath(siteId: string, branchId: string) {
  return `sites/${siteId}/branches/${branchId}/modules/byod_pos`;
}

// Before
export async function getMenuItems(siteId: string, ...) {
  const q = query(collection(db, 'sites', siteId, 'modules/byod_pos/menu_items'), ...);
}

// After
export async function getMenuItems(siteId: string, branchId: string, ...) {
  const basePath = getBranchPOSPath(siteId, branchId);
  const q = query(collection(db, basePath, 'menu_items'), ...);
}
```

---

### Routing Layer

#### [MODIFY] Public Order Page Routing

**Sebelumnya:**
```
/[tenant]/order → OrderPage.tsx
```

**Sesudahnya:**
```
/[tenant]/order/[branchId] → OrderPage.tsx (dengan branchId)
/[tenant]/order → BranchSelector.tsx (pilih cabang dulu)
```

#### [NEW] [app/[tenant]/order/[branchId]/page.tsx](file:///Users/mac/Documents/AI%20Project/Clicker/clicker-platform-multi-tenant/clicker-platform-v2/app/%5Btenant%5D/order/%5BbranchId%5D/page.tsx)
- Halaman order dengan parameter `branchId`
- Fetch menu items dan settings berdasarkan `branchId`

#### [MODIFY] [app/[tenant]/order/page.tsx](file:///Users/mac/Documents/AI%20Project/Clicker/clicker-platform-multi-tenant/clicker-platform-v2/app/%5Btenant%5D/order/page.tsx)
- Tampilkan daftar cabang yang tersedia
- User memilih cabang sebelum melihat menu

---

### Admin Dashboard

#### [MODIFY] Admin POS Settings

**Perubahan:**
1. Tambah branch selector di header halaman POS admin
2. Simpan `selectedBranchId` di state/context
3. Semua operasi CRUD menggunakan `branchId` yang dipilih

#### [NEW] Branch POS Management
- Menu admin untuk mengelola POS per cabang
- Opsi untuk "Copy Menu from Another Branch" (migrasi cepat)

---

### Context & State Management

#### [MODIFY] [lib/site-context.tsx](file:///Users/mac/Documents/AI%20Project/Clicker/clicker-platform-multi-tenant/clicker-platform-v2/lib/site-context.tsx)

**Tambah:**
```typescript
interface SiteContextValue {
  siteId: string;
  tenantSlug: string;
  // NEW
  activeBranchId?: string;
  setActiveBranchId?: (id: string) => void;
  branches?: Branch[];
}
```

---

## Migration Strategy

### Phase 1: Backward Compatible
1. Update API untuk menerima `branchId` opsional
2. Jika `branchId` tidak ada, gunakan path lama (site-level)
3. Ini memungkinkan gradual migration

### Phase 2: Data Migration Script
```typescript
async function migratePOSDataToBranch(siteId: string, branchId: string) {
  // 1. Copy menu_items dari site-level ke branch-level
  // 2. Copy settings
  // 3. Mark site-level data as "migrated" (jangan hapus dulu)
}
```

### Phase 3: Full Branch Mode
1. Update semua API calls untuk require `branchId`
2. Remove fallback ke site-level
3. Update Firestore rules

---

## Firestore Security Rules Update

```javascript
// Branch-level POS rules
match /sites/{siteId}/branches/{branchId}/modules/byod_pos/{document=**} {
  // Public read for menu items
  allow read: if resource.data.isActive == true || 
              request.path[5] == 'settings';
  
  // Admin write
  allow write: if isAdmin(siteId);
  
  // Public create for orders
  allow create: if request.path[5] == 'orders';
}
```

---

## UI/UX Flow

### Public Order Flow
```
User visits /{tenant}/order
    ↓
[Branch Selector Page]
  - List branches with names/addresses
  - User taps branch
    ↓
Redirects to /{tenant}/order/{branchId}
    ↓
[Menu Grid - Branch Specific]
  - Shows items for that branch
  - Orders saved under branch path
```

### Admin Flow
```
Admin opens /admin/pos
    ↓
[Branch Selector Dropdown in Header]
  - Default: First active branch
  - Can switch anytime
    ↓
[POS Dashboard - Branch Scoped]
  - Orders, Menu Items, Settings all branch-specific
```

---

## Verification Plan

### Automated Tests
- Unit tests for API dengan mock `branchId`
- Integration tests untuk order flow

### Manual Verification
1. Buat 2 cabang untuk tenant "quattro"
2. Tambah menu berbeda di setiap cabang
3. Akses `/quattro/order` → pilih cabang
4. Verifikasi menu sesuai cabang yang dipilih
5. Buat order, pastikan tersimpan di path branch yang benar

---

## Timeline Estimate

| Phase | Task | Waktu |
|-------|------|-------|
| 1 | API Updates (backward compatible) | 2-3 jam |
| 2 | Routing & Branch Selector UI | 2 jam |
| 3 | Admin Branch Selector | 1-2 jam |
| 4 | RBAC Staff Assignment | 2 jam |
| 5 | Migration Script | 1 jam |
| 6 | Testing & Verification | 1-2 jam |
| **Total** | | **9-12 jam** |

---

## 📱 Public Page Detail

### Branch Selector Page (`/{tenant}/order`)

```
┌─────────────────────────────────────┐
│  🏪 QUATTRO                         │
│  Pilih Cabang untuk Order           │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📍 Cabang Pusat            │    │
│  │  Jl. Sudirman No. 123       │    │
│  │  [ORDER SEKARANG →]         │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📍 Cabang BSD              │    │
│  │  Ruko BSD Blok A-15         │    │
│  │  [ORDER SEKARANG →]         │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  📍 Cabang PIK              │    │
│  │  Mall PIK Lt. 2 Unit 25     │    │
│  │  [ORDER SEKARANG →]         │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

### Order Page dengan Branch Context (`/{tenant}/order/{branchId}`)

```
┌─────────────────────────────────────┐
│  ← QUATTRO - Cabang BSD             │
│  Self Order                    [Q]  │
├─────────────────────────────────────┤
│  [All] [Makanan] [Minuman] [Snack]  │
├─────────────────────────────────────┤
│                                     │
│  ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ 🍕  │ │ 🍔  │ │ 🍟  │           │
│  │Pizza│ │Burger│ │Fries│           │
│  │ 50k │ │ 35k │ │ 15k │           │
│  └─────┘ └─────┘ └─────┘           │
│                                     │
│  Header menampilkan nama cabang     │
│  Menu items dari branch path        │
│  Order tersimpan di branch path     │
│                                     │
└─────────────────────────────────────┘
```

### [NEW] BranchSelector Component

#### [NEW] [lib/modules/byod_pos/public/BranchSelector.tsx](file:///Users/mac/Documents/AI%20Project/Clicker/clicker-platform-multi-tenant/clicker-platform-v2/lib/modules/byod_pos/public/BranchSelector.tsx)

```tsx
interface BranchSelectorProps {
  siteId: string;
  tenantSlug: string;
  branches: Branch[];
}

export function BranchSelector({ siteId, tenantSlug, branches }: BranchSelectorProps) {
  const router = useRouter();
  
  const activeBranches = branches.filter(b => b.isActive);
  
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <header className="text-center mb-8">
        <h1 className="text-2xl font-black">Pilih Cabang</h1>
        <p className="text-gray-500">Pilih lokasi untuk mulai order</p>
      </header>
      
      <div className="space-y-4 max-w-md mx-auto">
        {activeBranches.map(branch => (
          <button
            key={branch.id}
            onClick={() => router.push(`/${tenantSlug}/order/${branch.id}`)}
            className="w-full p-4 bg-white rounded-xl border-2 border-gray-200 
                       hover:border-brand-green transition-all text-left"
          >
            <div className="flex items-start gap-3">
              <MapPin className="text-brand-green mt-1" />
              <div>
                <h3 className="font-bold text-lg">{branch.name}</h3>
                <p className="text-gray-500 text-sm">{branch.address}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
```

---

## 🔐 Staff Access per Cabang (Simplified)

### Konsep

Menggunakan sistem **staff** yang sudah ada. Staff POS ditambahkan per-cabang, dengan permission akses yang sama seperti sekarang.

### Data Structure

```
/sites/{siteId}/branches/{branchId}/modules/byod_pos/staff/{staffId}
{
  userId: string;         // Firebase Auth UID
  email: string;
  name: string;
  role: string;           // Label saja (misal: "Kasir", "Staff")
  assignedAt: Timestamp;
}
```

### Firestore Security Rules (Simplified)

```javascript
// Branch POS Rules
match /sites/{siteId}/branches/{branchId}/modules/byod_pos {
  // Helper: Check if user is staff of this branch
  function isStaffOfBranch() {
    return exists(/databases/$(database)/documents/sites/$(siteId)/branches/$(branchId)/modules/byod_pos/staff/$(request.auth.uid));
  }
  
  // Orders - Staff can read/update, public can create
  match /orders/{orderId} {
    allow read, update: if isStaffOfBranch();
    allow create: if true;
  }
  
  // Menu Items - Public read, admin write
  match /menu_items/{itemId} {
    allow read: if true;
    allow write: if isAdmin(siteId);
  }
  
  // Settings - Public read, admin write  
  match /settings/{doc} {
    allow read: if true;
    allow write: if isAdmin(siteId);
  }
}
```

> [!NOTE]
> Sistem ini sama dengan yang sudah berjalan, hanya dipindah dari site-level ke branch-level.

---

## User Review Required

> [!WARNING]
> **Breaking Change**: Setelah migrasi penuh, data POS lama di level site tidak akan digunakan lagi.

**Pertanyaan terakhir:**
1. Apakah Anda ingin saya mulai implementasi sekarang?
2. Berapa cabang yang sudah ada untuk tenant yang akan diuji?


