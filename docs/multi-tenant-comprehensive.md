# Multi-Tenant Architecture Guide (Clicker Platform)

> **Version 2.0** - Revised based on actual codebase audit

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [How Multi-Tenancy Works](#2-how-multi-tenancy-works)
3. [Database Structure](#3-database-structure)
4. [Firestore Security Rules](#4-firestore-security-rules)
5. [Firestore Hooks](#5-firestore-hooks-recommended)
6. [Code Patterns](#6-code-patterns)
7. [Module System](#7-module-system)
8. [Migration Guide](#8-migration-guide)

---

## 1. Architecture Overview

### Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Middleware (siteId injection) | ✅ Done | `middleware.ts` |
| SiteProvider | ✅ Done | `lib/site-context.tsx` |
| Server-side fetching | ✅ Done | `lib/fetchDataServer.ts` |
| Module registry | ✅ Done | `lib/modules/registry.ts` |
| Public page routing | ✅ Done | `app/[...slug]/page.tsx` |
| **Firestore Hooks** | ✅ Done | `lib/hooks/useFirestore.ts` |
| **Site Membership** | ✅ Done | Auto-registered in `AdminGuard.tsx` |
| Admin client-side | ✅ Done | Dashboard, Products migrated |

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. User visits: quattro.clickerapps.web.app/admin              │
│                        │                                         │
│                        ▼                                         │
│  2. MIDDLEWARE extracts siteId from subdomain                   │
│     hostname: "quattro.clickerapps.web.app"                     │
│     → siteId: "quattro"                                         │
│     → Sets header: x-site-id: "quattro"                         │
│                        │                                         │
│                        ▼                                         │
│  3. ROOT LAYOUT reads x-site-id header                          │
│     → Wraps app with <SiteProvider siteId="quattro">            │
│                        │                                         │
│                        ▼                                         │
│  4. COMPONENTS use useSite() hook                               │
│     const { siteId } = useSite();                               │
│     → siteId = "quattro"                                        │
│                        │                                         │
│                        ▼                                         │
│  5. FIRESTORE queries use site-scoped paths                     │
│     collection(db, 'sites', 'quattro', 'products')              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. How Multi-Tenancy Works

### 2.1 Middleware (Site Resolution)

**File:** `middleware.ts`

```typescript
// Extracts siteId from hostname and injects to headers
const hostname = request.headers.get("x-forwarded-host") || request.headers.get("host");

// Subdomain logic
if (hostname.includes("localhost")) {
  siteId = "quattro"; // Default dev site
} else if (hostname.endsWith(`.${rootDomain}`)) {
  siteId = hostname.replace(`.${rootDomain}`, "");
}

// Inject to request headers
requestHeaders.set('x-site-id', siteId);
```

### 2.2 Site Provider

**File:** `lib/site-context.tsx`

```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';

interface SiteContextType {
    siteId: string;
}

const SiteContext = createContext<SiteContextType | undefined>(undefined);

export function SiteProvider({ siteId, children }: { siteId: string, children: ReactNode }) {
    return (
        <SiteContext.Provider value={{ siteId }}>
            {children}
        </SiteContext.Provider>
    );
}

export function useSite() {
    const context = useContext(SiteContext);
    if (context === undefined) {
        throw new Error('useSite must be used within a SiteProvider');
    }
    return context;
}
```

### 2.3 Root Layout Integration

**File:** `app/layout.tsx`

```typescript
import { headers } from "next/headers";
import { SiteProvider } from "@/lib/site-context";

export default async function RootLayout({ children }) {
  const headersList = await headers();
  const siteId = headersList.get('x-site-id') || 'default';

  return (
    <html lang="en">
      <body>
        <SiteProvider siteId={siteId}>
          {children}
        </SiteProvider>
      </body>
    </html>
  );
}
```

---

## 3. Database Structure

### 3.1 Firestore Hierarchy

```
/sites/{siteId}/                      # 🏢 Tenant Container
│
├── slug: "quattro"                   # Subdomain identifier
├── name: "Quattro Coffee"
├── ownerId: "user123"
│
├── /content/                         # Site settings & config
│   ├── profile                       # Business profile
│   ├── siteSettings                  # Theme, SEO, etc
│   ├── business                      # Business hours, contact
│   └── siteStats                     # Analytics
│
├── /products/{productId}/            # 🛍️ Products
├── /links/{linkId}/                  # 🔗 Short Links
├── /pages/{pageId}/                  # 📄 CMS Pages
├── /orders/{orderId}/                # 📦 Orders
├── /inbox/{messageId}/               # 📬 Form Submissions
├── /forms/{formId}/                  # 📝 Form Definitions
├── /branches/{branchId}/             # 📍 Multiple locations
├── /members/{memberId}/              # 👥 Site Members/Staff
│
└── /settings/                        # Site-level settings
    └── modules: { pos: true, ... }   # Enabled modules

/users/{userId}/                      # 👤 User Private Data
│
├── email, displayName
├── defaultSiteId
│
├── /business/
│   └── profile                       # User's business profile
│
└── /settings/
    └── preferences
```

### 3.2 Important: Data Paths

| Data Type | Path Pattern |
|-----------|--------------|
| Products | `/sites/{siteId}/products/{productId}` |
| Links | `/sites/{siteId}/links/{linkId}` |
| Pages | `/sites/{siteId}/pages/{pageId}` |
| Orders | `/sites/{siteId}/orders/{orderId}` |
| Inbox | `/sites/{siteId}/inbox/{messageId}` |
| Forms | `/sites/{siteId}/forms/{formId}` |
| Site Settings | `/sites/{siteId}/content/siteSettings` |
| User Profile | `/users/{userId}/business/profile` |

---

## 4. Firestore Security Rules

### 4.1 Helper Functions

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isGlobalAdmin() {
      return isAuthenticated() && (
        request.auth.token.role == 'superadmin' ||
        request.auth.token.email == 'clickerplatform@gmail.com' ||
        request.auth.uid == 'CrlADj8aKWXjP9oZGX7kZEWVoCD3'
      );
    }
    
    function isSiteMember(siteId) {
      return isAuthenticated() && (
        isGlobalAdmin() ||
        exists(/databases/$(database)/documents/sites/$(siteId)/members/$(request.auth.uid))
      );
    }
```

### 4.2 Site Rules

```javascript
    // User Private Data
    match /users/{userId}/{document=**} {
      allow read, write: if isAuthenticated() && 
        (request.auth.uid == userId || isGlobalAdmin());
    }

    // Site Data
    match /sites/{siteId} {
      allow get: if true;                    // Public site info
      allow list: if isGlobalAdmin();
      allow write: if isGlobalAdmin();

      // Public Collections
      match /products/{docId} {
        allow read: if true;
        allow write: if isSiteMember(siteId);
      }
      
      match /links/{docId} {
        allow read: if true;
        allow write: if isSiteMember(siteId);
      }
      
      match /pages/{docId} {
        allow read: if true;
        allow write: if isSiteMember(siteId);
      }

      // Semi-Public (Anyone can create)
      match /orders/{docId} {
        allow create: if true;
        allow read, update, delete: if isSiteMember(siteId);
      }
      
      match /inbox/{docId} {
        allow create: if true;
        allow read, update, delete: if isSiteMember(siteId);
      }

      // Private Collections
      match /members/{docId} {
        allow read, write: if isSiteMember(siteId);
      }
    }

    // Default Deny
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Firestore Hooks (Recommended)

The `lib/hooks/useFirestore.ts` module provides type-safe, reusable hooks for site-scoped Firestore operations.

### 5.1 Available Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useSiteCollection(name)` | Get collection ref under current site | `CollectionReference \| null` |
| `useSiteDoc(name, docId)` | Get document ref under current site | `DocumentReference \| null` |
| `useSiteContentDoc(name)` | Get content document ref | `DocumentReference \| null` |
| `useUserDoc(userId, path)` | Get user document ref | `DocumentReference \| null` |

### 5.2 Usage Examples

```typescript
import { 
    useSiteCollection, 
    useSiteDoc, 
    useSiteContentDoc,
    getSiteCollectionRef  // For callbacks
} from '@/lib/hooks';

// In a component
function ProductsList() {
    const productsRef = useSiteCollection('products');
    const [products, setProducts] = useState([]);
    
    useEffect(() => {
        if (!productsRef) return;
        
        const unsubscribe = onSnapshot(productsRef, (snap) => {
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        
        return () => unsubscribe();
    }, [productsRef]);
}

// Get a specific document
function ProductDetail({ productId }) {
    const productRef = useSiteDoc('products', productId);
    // ...
}

// Get site settings
function SiteSettings() {
    const settingsRef = useSiteContentDoc('siteSettings');
    // ...
}

// In callbacks (non-hook pattern)
async function handleCreate(data) {
    const { siteId } = useSite();
    const ref = getSiteCollectionRef(siteId, 'products');
    await addDoc(ref, data);
}
```

### 5.3 Type Definitions

```typescript
// Valid collection names (type-safe)
type SiteCollectionName = 
    | 'products' | 'links' | 'pages' | 'orders' 
    | 'inbox' | 'forms' | 'branches' | 'members'
    | 'content' | 'inventory' | 'bookings' | 'menuItems';

// Valid content documents
type SiteContentDocName = 
    | 'profile' | 'siteSettings' | 'business' 
    | 'siteStats' | 'featuredProduct' | 'productSettings';

// Valid user paths
type UserDocPath = 'business/profile' | 'settings/preferences';
```

### 5.4 Best Practices

1. **Prefer hooks in components** - Use `useSiteCollection` over manual path construction
2. **Use utility functions in callbacks** - Use `getSiteCollectionRef` in event handlers
3. **Always check for null** - Hooks return null if siteId is unavailable
4. **Add new collection types** - Update `SiteCollectionName` when adding new collections

---

## 6. Code Patterns

### 6.1 Client-Side Data Fetching

**✅ CORRECT Pattern:**

```typescript
'use client';

import { useSite } from '@/lib/site-context';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

export default function ProductsPage() {
    const { siteId } = useSite();
    const [products, setProducts] = useState([]);
    
    useEffect(() => {
        async function fetchProducts() {
            if (!siteId) return;
            
            // ✅ Site-scoped path
            const snap = await getDocs(
                collection(db, 'sites', siteId, 'products')
            );
            setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        fetchProducts();
    }, [siteId]);
    
    return (/* ... */);
}
```

**❌ WRONG Pattern:**

```typescript
// ❌ This accesses ROOT collection - WRONG!
const snap = await getDocs(collection(db, 'products'));
```

### 6.2 Server-Side Data Fetching

**File:** `lib/fetchDataServer.ts`

```typescript
import { getAdminDb } from "@/lib/firebase-admin";

export async function fetchPublicData(siteId: string) {
    // ✅ Site-scoped reference
    const siteRef = getAdminDb().collection("sites").doc(siteId);
    
    const [profileSnap, linksSnap, productsSnap] = await Promise.all([
        siteRef.collection("content").doc("profile").get(),
        siteRef.collection("links").get(),
        siteRef.collection("products").get(),
    ]);
    
    // ... process data
}
```

### 6.3 CRUD Operations

```typescript
const { siteId } = useSite();

// CREATE
await addDoc(collection(db, 'sites', siteId, 'products'), {
    name: 'New Product',
    price: 10000,
    // ...
});

// READ
const snap = await getDoc(doc(db, 'sites', siteId, 'products', productId));

// UPDATE
await updateDoc(doc(db, 'sites', siteId, 'products', productId), {
    name: 'Updated Name',
});

// DELETE
await deleteDoc(doc(db, 'sites', siteId, 'products', productId));

// QUERY
const q = query(
    collection(db, 'sites', siteId, 'products'),
    where('category', '==', 'Coffee'),
    orderBy('name')
);
const results = await getDocs(q);
```

---

## 7. Module System

### 7.1 Overview

Modules extend site functionality without modifying core code.

**Key Files:**
- `lib/modules/types.ts` - Type definitions
- `lib/modules/definitions.ts` - Available modules
- `lib/modules/registry.ts` - Module lookup functions
- `lib/modules/components.tsx` - Component registry

### 7.2 Module Definition

```typescript
// lib/modules/types.ts
export interface ModuleDefinition {
    id: string;
    displayName: string;
    description?: string;
    icon: string;
    version: string;
    enabled: boolean;  // Default state
    
    adminRoutes?: AdminRoute[];
    publicRoutes?: PublicRouteDefinition[];
    collections?: string[];
    blocks?: ModuleBlockDefinition[];
}

export interface AdminRoute {
    path: string;
    label: string;
    icon?: string;
    componentKey?: string;
}

export interface PublicRouteDefinition {
    path: string;
    componentKey: string;
}
```

### 7.3 Module Registration

```typescript
// lib/modules/definitions.ts
export const SYSTEM_MODULES: ModuleDefinition[] = [
    {
        id: 'byod_pos',
        displayName: 'POS & Self-Order',
        icon: 'utensils',
        version: '1.0.0',
        enabled: false,
        adminRoutes: [
            { path: '/admin/pos', label: 'POS', icon: 'store' },
            { path: '/admin/kds', label: 'Kitchen Display', icon: 'monitor-dot' },
        ],
        publicRoutes: [
            { path: '/order', componentKey: 'OrderPage' },
        ],
        collections: ['orders', 'menuItems'],
    },
    // ... more modules
];
```

### 7.4 Checking Module Enabled

```typescript
// In component
import { isModuleEnabled } from '@/lib/modules/registry';

const showPOS = await isModuleEnabled(siteId, 'byod_pos');
```

### 7.5 Module Data Storage

Module data is stored under the site:
```
/sites/{siteId}/modules/{moduleId}/{...data}
```

Or in dedicated collections:
```
/sites/{siteId}/orders/{orderId}       # POS module
/sites/{siteId}/bookings/{bookingId}   # Reservation module
/sites/{siteId}/inventory/{itemId}     # Inventory module
```

---

## 8. Migration Guide

### Files That Need Migration

These files still access ROOT collections and need to be updated:

| File | Current Path | Should Be |
|------|--------------|-----------|
| `admin/page.tsx` | `collection(db, 'products')` | `collection(db, 'sites', siteId, 'products')` |
| `products/page.tsx` | `collection(db, 'products')` | `collection(db, 'sites', siteId, 'products')` |
| `ProductsClient.tsx` | `collection(db, 'products')` | `collection(db, 'sites', siteId, 'products')` |
| `ProductsForm.tsx` | `collection(db, 'products')` | `collection(db, 'sites', siteId, 'products')` |

### Migration Steps

1. **Import useSite hook:**
   ```typescript
   import { useSite } from '@/lib/site-context';
   ```

2. **Get siteId in component:**
   ```typescript
   const { siteId } = useSite();
   ```

3. **Add siteId check:**
   ```typescript
   if (!siteId) return <LoadingState />;
   ```

4. **Update collection paths:**
   ```typescript
   // Before
   collection(db, 'products')
   
   // After
   collection(db, 'sites', siteId, 'products')
   ```

5. **Add siteId to dependencies:**
   ```typescript
   useEffect(() => {
       // ... fetch logic
   }, [siteId]); // Add siteId here
   ```

---

## Quick Reference

### Common Paths

```typescript
// Products
collection(db, 'sites', siteId, 'products')
doc(db, 'sites', siteId, 'products', productId)

// Links
collection(db, 'sites', siteId, 'links')

// Pages
collection(db, 'sites', siteId, 'pages')

// Orders
collection(db, 'sites', siteId, 'orders')

// Inbox
collection(db, 'sites', siteId, 'inbox')

// Site Settings
doc(db, 'sites', siteId, 'content', 'siteSettings')

// User Profile
doc(db, 'users', userId, 'business', 'profile')
```

### Environment Variables

```env
NEXT_PUBLIC_ROOT_DOMAIN=clickerapps.web.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=clicker-universe
NEXT_PUBLIC_AUTH_GATEWAY_URL=https://clicker-auth-gateway.web.app
```

---

*Last Updated: January 2026*
*Based on QA Audit of actual codebase*
