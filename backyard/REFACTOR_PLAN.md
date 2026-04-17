# Backyard Refactor Plan

**Target:** Cleanup dev artifacts, compact logic, improve UX to match Clicker Platform
**Scope:** `dev/backyard/` — 6 source files, 2216 lines total
**Critical file:** `app/tenants/page.tsx` — 1038 lines (monster file)

---

## PART A: CODE CLEANUP & LOGIC

### Sprint 1 — P0: Dev Cleanup (~30 min)

#### 1.1 Remove debug console.logs (5 hits — 3 leak tenant data)
**File:** `app/tenants/page.tsx`
- L169: `console.log('[openModuleDialog] tenant.id:', tenant.id)` — DELETE
- L170: `console.log('[openModuleDialog] tenant.modules:', JSON.stringify(tenant.modules))` — DELETE (DATA LEAK)
- L171: `console.log('[openModuleDialog] merged:', JSON.stringify(currentModules))` — DELETE (DATA LEAK)
- L277: `console.log("🔍 Fetching Firestore team for Site ID:", selectedTenant.id)` — DELETE
- L285: `console.log("🏁 Firestore Team Members:", members.length)` — DELETE

#### 1.2 Remove duplicate setSubdomain
**File:** `app/tenants/page.tsx:99-100`
```tsx
// BEFORE (duplicate)
setSubdomain('');
setSubdomain('');

// AFTER
setSubdomain('');
```

#### 1.3 Replace window.confirm → ConfirmationDialog (3 hits)
`ConfirmationDialog` already exists at `components/ui/confirmation-dialog.tsx` but is not used everywhere.

**File:** `app/tenants/page.tsx:140` — Seed data confirm
Add state:
```tsx
const [seedDialogOpen, setSeedDialogOpen] = useState(false);
const [seedTarget, setSeedTarget] = useState<any>(null);
```
Replace `if (!confirm(...)) return;` with:
```tsx
const handleSeed = (tenant: any) => {
    setSeedTarget(tenant);
    setSeedDialogOpen(true);
};
const confirmSeed = async () => {
    if (!seedTarget) return;
    setSeedDialogOpen(false);
    const toastId = toast.loading('Seeding data...', { description: `Target: ${seedTarget.name}` });
    try {
        const seedFn = httpsCallable(functions, 'seedSiteData');
        await seedFn({ siteId: seedTarget.id });
        toast.success('Seeding Complete', { id: toastId, description: `Data for ${seedTarget.name} has been reset.` });
    } catch (error: any) {
        toast.error('Seeding Failed', { id: toastId, description: error.message });
    }
};
```
Add `<ConfirmationDialog>` for seed with `variant="danger"`.

**File:** `app/tenants/page.tsx:342` — Remove member confirm
Same pattern: add `removeMemberDialogOpen` state + `ConfirmationDialog`.

**File:** `components/SeedTool.tsx:20` — Same pattern.

#### 1.4 Optimistic updates — remove redundant fetchTenants()

**File:** `app/tenants/page.tsx:221` — After hard delete:
```tsx
// BEFORE
fetchTenants();

// AFTER (optimistic)
setTenants(prev => prev.filter(t => t.id !== selectedTenant.id));
```

**File:** `app/tenants/page.tsx:251` — After slug update:
```tsx
// BEFORE
fetchTenants();

// AFTER (optimistic)
setTenants(prev => prev.map(t =>
    t.id === selectedTenant.id ? { ...t, slug: sanitized } : t
));
```

#### 1.5 Fix JSON.stringify dependency anti-pattern
**File:** `components/PermissionEditor.tsx:57`
```tsx
// BEFORE
}, [JSON.stringify(siteModules)]);

// AFTER — use a stable reference comparison
const siteModulesKey = Object.entries(siteModules || {})
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
    .join(',');

useEffect(() => {
    // ...existing logic...
}, [siteModulesKey]);
```

---

### Sprint 2 — P1: Component Extraction (~2-3 hours)

Break `tenants/page.tsx` (1038 lines) into focused components.
Each extracted component owns its own state + dialog logic.

#### 2.1 Extract TeamDialog (~200 lines)
**New file:** `components/dialogs/TeamDialog.tsx`
**Move:** L260-359 (state) + L836-1034 (JSX)
**Props:**
```tsx
interface TeamDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: Tenant;
}
```
Contains: member list, add member form, PermissionEditor, remove member, Firestore onSnapshot subscription.

#### 2.2 Extract TenantForgePanel (~140 lines)
**New file:** `components/TenantForgePanel.tsx`
**Move:** L20-109 (state + handlers) + L374-502 (JSX)
**Props:**
```tsx
interface TenantForgePanelProps {
    onCreated: () => void; // callback to refresh tenant list
    loading: boolean;
    onRefresh: () => void;
}
```
Contains: create form fields, module selector, hosting selector, submit handler.

#### 2.3 Extract ModuleDialog (~70 lines)
**New file:** `components/dialogs/ModuleDialog.tsx`
**Move:** L161-193 (state + handlers) + L651-719 (JSX)
**Props:**
```tsx
interface ModuleDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: Tenant;
    onSaved: (tenant: Tenant, modules: Record<string, boolean>) => void;
}
```

#### 2.4 Extract UpdateSlugDialog (~60 lines)
**New file:** `components/dialogs/UpdateSlugDialog.tsx`
**Move:** L230-257 (state + handlers) + L721-777 (JSX)
**Props:**
```tsx
interface UpdateSlugDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: Tenant;
    onUpdated: (tenant: Tenant, newSlug: string) => void;
}
```

#### 2.5 Extract DeleteTenantDialog (~55 lines)
**New file:** `components/dialogs/DeleteTenantDialog.tsx`
**Move:** L196-227 (state + handlers) + L779-833 (JSX)
**Props:**
```tsx
interface DeleteTenantDialogProps {
    isOpen: boolean;
    onClose: () => void;
    tenant: Tenant;
    onDeleted: (tenantId: string) => void;
}
```

#### 2.6 Extract TenantTable (~130 lines)
**New file:** `components/TenantTable.tsx`
**Move:** L504-635 (tenant list table + action buttons)
**Props:**
```tsx
interface TenantTableProps {
    tenants: Tenant[];
    loading: boolean;
    onTeam: (tenant: Tenant) => void;
    onModules: (tenant: Tenant) => void;
    onUpdateUrl: (tenant: Tenant) => void;
    onSeed: (tenant: Tenant) => void;
    onToggleStatus: (tenant: Tenant) => void;
    onDelete: (tenant: Tenant) => void;
}
```

#### 2.7 Result: tenants/page.tsx becomes ~250 line orchestrator
```tsx
export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

    // Dialog open/close state only
    const [activeDialog, setActiveDialog] = useState<
        'team' | 'modules' | 'slug' | 'delete' | 'seed' | 'status' | null
    >(null);

    // ... fetchTenants, auth listener, status handler ...

    return (
        <Layout>
            <TenantForgePanel onCreated={...} />
            <TenantTable tenants={tenants} on*={...} />

            {selectedTenant && activeDialog === 'team' && <TeamDialog ... />}
            {selectedTenant && activeDialog === 'modules' && <ModuleDialog ... />}
            {selectedTenant && activeDialog === 'slug' && <UpdateSlugDialog ... />}
            {selectedTenant && activeDialog === 'delete' && <DeleteTenantDialog ... />}
            <ConfirmationDialog ... /> {/* seed + status */}
        </Layout>
    );
}
```

**Target file structure after extraction:**
```
components/
  TenantForgePanel.tsx      ← ~150 lines (NEW)
  TenantTable.tsx           ← ~130 lines (NEW)
  PermissionEditor.tsx      ← ~330 lines (fixed dependency)
  Sidebar.tsx               ← 79 lines (unchanged)
  SeedTool.tsx              ← 84 lines (fix confirm)
  dialogs/
    TeamDialog.tsx           ← ~220 lines (NEW)
    ModuleDialog.tsx         ← ~70 lines (NEW)
    UpdateSlugDialog.tsx     ← ~60 lines (NEW)
    DeleteTenantDialog.tsx   ← ~55 lines (NEW)
  ui/
    confirmation-dialog.tsx  ← unchanged
```

---

## PART B: FRONTEND UX — Align with Clicker Platform

### Problem: Backyard doesn't feel like Clicker Platform

Current Backyard uses a **generic admin look** — wrong colors, wrong font, excessive jargon,
hardcoded stats, and inconsistent UI patterns. Meanwhile Clicker Platform has a strong identity:
brand-green (#B6FF2E), brand-dark (#0E3B2E), sticker shadows, Plus Jakarta Sans font.

**Root cause:** Backyard was built as a quick dev tool, not a polished admin panel.

---

### Sprint 3 — P1: Visual & Brand Alignment (~2-3 hours)

#### 3.1 Fix globals.css — brand colors + font + shadow
**File:** `app/globals.css`

**BEFORE:**
```css
@theme {
    --color-brand-dark: #222222;
    --color-brand-light: #f4f4f5;
    --font-sans: var(--font-geist-sans);
    --font-mono: var(--font-geist-mono);
}
body { font-family: Arial, Helvetica, sans-serif; }
```

**AFTER — match Clicker Platform (`clicker-platform-v2/app/globals.css`):**
```css
@theme {
    --color-brand-dark: #0E3B2E;
    --color-brand-green: #B6FF2E;
    --color-brand-light: #f0fdf4;
    --font-sans: var(--font-jakarta);
    --font-mono: var(--font-geist-mono);
    --shadow-sticker: 4px 4px 0px 0px #0E3B2E;
}
body { font-family: var(--font-jakarta), 'Plus Jakarta Sans', sans-serif; }
```

**Issues fixed:**
- `#222222` → `#0E3B2E` (Clicker forest green instead of generic gray)
- Added `--color-brand-green: #B6FF2E` (lime green accent — missing entirely)
- Added `--shadow-sticker` variable (currently hardcoded as `rgba(34,34,34,1)` across pages)
- `Arial` → `Plus Jakarta Sans` (brand font — already imported but overridden by globals.css)

#### 3.2 Fix layout.tsx — use Plus Jakarta Sans
**File:** `app/layout.tsx`

**BEFORE:**
```tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"] });
<body className={`${inter.className} antialiased`}>
```

**AFTER:**
```tsx
import { Plus_Jakarta_Sans } from "next/font/google";
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: '--font-jakarta' });
<body className={`${jakarta.variable} ${jakarta.className} antialiased`}>
```

#### 3.3 Fix hardcoded shadow colors across all pages
Replace all hardcoded `rgba(34,34,34,1)` shadows with CSS variable.

**File:** `app/page.tsx:67` (login card)
```tsx
// BEFORE
shadow-[8px_8px_0px_0px_rgba(34,34,34,1)]
// AFTER
shadow-sticker
```

**File:** `app/users/page.tsx:172` (user list panel)
```tsx
// BEFORE
shadow-[6px_6px_0px_0px_rgba(34,34,34,1)]
// AFTER
shadow-sticker
```

#### 3.4 Sidebar — Clicker identity + brand colors
**File:** `components/Sidebar.tsx`

**Current problems:**
- Blue "B" icon → should use Clicker logo or brand-dark/green
- Active state: `bg-blue-50 text-blue-700 border-blue-100` → should use brand colors
- Icon active: `text-blue-600` / inactive: `text-slate-400` → should use brand colors
- No user info in footer
- "Identities" label → "Users"

**Changes:**
```tsx
// Header — BEFORE
<div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-200">
    <span className="text-white font-bold text-lg">B</span>
</div>
<span className="font-bold text-slate-800">Backyard</span>

// Header — AFTER
<div className="w-8 h-8 bg-brand-dark rounded-lg flex items-center justify-center">
    <span className="text-brand-green font-bold text-lg">C</span>
</div>
<span className="font-bold text-brand-dark">Backyard</span>

// Active nav — BEFORE
'bg-blue-50 text-blue-700 border-blue-100'
// Active nav — AFTER
'bg-brand-green/10 text-brand-dark border-brand-dark/10'

// Icon active — BEFORE
'text-blue-600' : 'text-slate-400'
// Icon active — AFTER
'text-brand-dark' : 'text-slate-400'

// Menu label fix
{ name: 'Identities', ... } → { name: 'Users', ... }
```

---

### Sprint 4 — P1: Remove All Jargon (~1-2 hours)

Every page is filled with sci-fi/hacker jargon that makes the UI confusing. Replace with clear labels.

#### 4.1 Dashboard page (`app/page.tsx`)

| Line | Before | After |
|---|---|---|
| L69 | `ACCESS RELAY` | `Admin Login` |
| L73 | `Superadmin Authentication` | `Sign in to manage your platform` |
| L116 | `Authenticate` | `Sign In` |
| L121 | `Authorized Personnel Only. Access attempts are logged.` | `Clicker Platform Admin` |
| L41 | toast: `Welcome Back, Commander` | `Welcome back` |
| L41 | toast desc: `Access granted to God Mode.` | `Signed in successfully.` |
| L51 | toast: `Session Terminated` | `Signed out` |
| L51 | toast desc: `See you later.` | _(remove description)_ |
| L170 | `DASHBOARD OVERVIEW` | `Dashboard` |
| L174 | `Platform Health & Status` | `Platform overview` |
| L191 | `Active Tenants` label | keep as is (clear) |
| L203 | `Total Identities` | `Total Users` |
| L190 | `--` hardcoded tenant count | Fetch real count (see 4.5) |
| L202 | `--` hardcoded user count | Fetch real count (see 4.5) |
| L214 | `99.9%` fake uptime | Replace with "Active Modules" count or remove |

#### 4.2 Tenants page (`app/tenants/page.tsx`)

| Location | Before | After |
|---|---|---|
| Page header | `TENANT FORGE` | `Tenants` |
| Forge subtitle | `Deploy a new instance into the universe` | `Create & manage tenants` |
| Table title | `Active Contexts` | `Tenant List` |
| Table subtitle | `Manifested tenants currently in operation` | _(remove or keep empty)_ |
| Badge | `Manifestations: {n}` | `{n} tenants` |
| Loading | `Synchronizing Multiverse...` | `Loading tenants...` |
| Empty state | `No tenants manifested in this sector.` | `No tenants yet.` |
| Column: `Context Identity` | → `Tenant` |
| Column: `Originator` | → `Owner` |
| Column: `Vital Status` | → `Status` |
| Column: `Manipulation` | → `Actions` |
| Submit button | `Forge Instance` | `Create Tenant` |
| Delete toast | `Tenant Obliterated` | `Tenant Deleted` |
| Delete desc | `...permanently deleted` | `{name} has been removed.` |

#### 4.3 Users page (`app/users/page.tsx`)

| Location | Before | After |
|---|---|---|
| Header | `USER CONTROL` | `Users` |
| Subtitle | `Global Identity & Access Management (RBAC)` | `Manage users & roles` |
| Panel title | `Subjects Database` | `Users` |
| Badge | `{n} Found` | `{n} users` |
| Button title | `Register New Identity` | `Create User` |
| Loading | `Fetching Identity Db...` | `Loading users...` |
| Empty | `No subjects found matching query.` | `No users found.` |
| Detail header | `Unnamed Subject` | `No Name` |
| Section | `Current Clearance (Claims)` | `Current Roles` |
| Section | `Grant Privileges` | `Assign Role` |
| Empty claims | `No special privileges assigned (Standard User).` | `No roles assigned.` |
| Button | `Create Identity` | `Create User` |
| Dialog title | `Register New Identity` | `Create User` |
| Confirm title | `Confirm Clearance Grant` | `Confirm Role Assignment` |
| Confirm desc | `...powerful permission allows them to modify tenant data.` | `Grant {role} access for {site} to this user?` |
| Lock title | `Immutable Subject` | `Protected Account` |
| Lock desc | `Root Superadmin...Master Control Program` | `Root admin account. Privileges cannot be modified.` |
| Revoke toast | `User has been stripped of all platform privileges.` | `All roles removed.` |

#### 4.4 Tenant Forge form improvements
**File:** `app/tenants/page.tsx`

Current form label "Target Hosting (Tenant)" is unclear. Rename:
- `Target Hosting (Tenant)` → `Hosting Platform`
- `Active Modules & Provisions` → `Modules`

Also add helpful placeholder text:
- Subdomain placeholder: `cafe-quattro` → `my-business (lowercase, dashes only)`

#### 4.5 Dashboard — fetch real data
**File:** `app/page.tsx`

Add to dashboard component (after auth check):
```tsx
const [stats, setStats] = useState({ tenants: 0, users: 0 });

useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
        try {
            const [tenantsRes, usersRes] = await Promise.all([
                httpsCallable(functions, 'getTenants')(),
                httpsCallable(functions, 'listUsers')()
            ]);
            setStats({
                tenants: (tenantsRes.data as any)?.list?.length || 0,
                users: (usersRes.data as any)?.users?.length || 0
            });
        } catch {}
    };
    fetchStats();
}, [user]);
```

Replace hardcoded `--` with `stats.tenants` and `stats.users`.
Replace fake `99.9%` uptime card with **Active Modules** count or **Recent Activity**.

---

### Sprint 5 — P2: UX Polish (~1-2 hours)

#### 5.1 Add search/filter to tenant list
Currently no search. With 10+ tenants, the table is hard to scan.

```tsx
const [searchQuery, setSearchQuery] = useState('');
const filteredTenants = useMemo(() =>
    tenants.filter(t =>
        t.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.ownerEmail?.toLowerCase().includes(searchQuery.toLowerCase())
    ), [tenants, searchQuery]
);
```

Add search input above the table, same pattern as users page already has.

#### 5.2 Consistent button border-radius
| Current | Fix |
|---|---|
| `rounded-[20px]` (forge button) | → `rounded-xl` |
| `rounded-[32px]` (list panel) | → `rounded-2xl` |
| `rounded-3xl` (other cards) | → `rounded-2xl` |
| `rounded-lg` (dialog buttons) | keep for secondary |
| `rounded-xl` (some buttons) | keep for primary |

**Rule:** `rounded-2xl` for cards/panels, `rounded-xl` for primary buttons, `rounded-lg` for secondary/inputs.

#### 5.3 Consistent sticker shadow
Replace all hardcoded shadows:
```tsx
// BEFORE (3 different patterns)
shadow-[8px_8px_0px_0px_rgba(34,34,34,1)]  // login
shadow-[6px_6px_0px_0px_rgba(34,34,34,1)]  // users
shadow-xl                                    // various

// AFTER (use theme variable)
shadow-sticker  // defined in globals.css as 4px 4px 0px 0px #0E3B2E
```

#### 5.4 Add empty states with CTA
When no tenants exist, show a helpful empty state:
```tsx
<div className="p-12 text-center">
    <Store className="w-12 h-12 mx-auto mb-4 text-gray-300" />
    <h3 className="font-bold text-gray-600 mb-2">No tenants yet</h3>
    <p className="text-sm text-gray-400">Create your first tenant using the form above.</p>
</div>
```

#### 5.5 Dev-only Bootstrap button — extract handler
**File:** `app/page.tsx:124-152`
Currently 28 lines of inline handler. Extract to a named function:
```tsx
const handleBootstrap = async () => {
    if (!loginEmail || !loginPassword) {
        toast.warning('Input Required', { description: 'Enter email and password.' });
        return;
    }
    setActionLoading(true);
    try {
        const createUser = httpsCallable(functions, 'createUser');
        await createUser({ email: loginEmail, password: loginPassword, displayName: 'Super Admin', role: 'superadmin' });
        toast.success('System Initialized', { description: 'Superadmin account created.' });
    } catch (error: any) {
        toast.error('Bootstrap Failed', { description: error.message });
    } finally {
        setActionLoading(false);
    }
};
```

---

## Summary — Effort & Impact

| Sprint | Focus | Effort | Impact |
|---|---|---|---|
| **Sprint 1** | Dev cleanup (console.log, confirm, optimistic updates) | S (~30 min) | Security + performance |
| **Sprint 2** | Component extraction (1038 → ~250 lines) | L (~2-3 hrs) | Maintainability |
| **Sprint 3** | Visual & brand alignment (colors, font, sidebar, shadows) | M (~1-2 hrs) | Visual identity |
| **Sprint 4** | Remove all jargon + fetch real dashboard data | M (~1-2 hrs) | User experience |
| **Sprint 5** | UX polish (search, empty states, button consistency) | M (~1-2 hrs) | User friendliness |

### Recommended Order
1. **Sprint 3 first** — brand alignment is the fastest UX win (just CSS + a few strings)
2. **Sprint 4 next** — jargon removal is find-and-replace, big readability impact
3. **Sprint 1** — dev cleanup (security)
4. **Sprint 5** — UX polish
5. **Sprint 2 last** — component extraction is the biggest effort, best done after UX is settled

## Expected File Sizes After All Sprints

| File | Before | After |
|---|---|---|
| `app/tenants/page.tsx` | 1038 | ~250 |
| `app/page.tsx` | 225 | ~210 (live stats, cleanup bootstrap, relabel) |
| `app/users/page.tsx` | 460 | ~440 (relabel jargon) |
| `app/layout.tsx` | 29 | ~29 (font swap) |
| `app/globals.css` | 26 | ~30 (brand colors + shadow + font) |
| `components/Sidebar.tsx` | 79 | ~85 (brand colors + relabel) |
| `components/TenantForgePanel.tsx` | N/A | ~150 (NEW) |
| `components/TenantTable.tsx` | N/A | ~130 (NEW) |
| `components/dialogs/TeamDialog.tsx` | N/A | ~220 (NEW) |
| `components/dialogs/ModuleDialog.tsx` | N/A | ~70 (NEW) |
| `components/dialogs/UpdateSlugDialog.tsx` | N/A | ~60 (NEW) |
| `components/dialogs/DeleteTenantDialog.tsx` | N/A | ~55 (NEW) |
| `components/PermissionEditor.tsx` | 330 | ~325 (fixed) |

## Full Jargon Replacement Reference

For quick find-and-replace during implementation:

```
ACCESS RELAY → Admin Login
Superadmin Authentication → Sign in to manage your platform
Authenticate → Sign In
Authorized Personnel Only → Clicker Platform Admin
Welcome Back, Commander → Welcome back
Access granted to God Mode → Signed in successfully
Session Terminated → Signed out
DASHBOARD OVERVIEW → Dashboard
Platform Health & Status → Platform overview
Total Identities → Total Users
TENANT FORGE → Tenants
Deploy a new instance into the universe → Create & manage tenants
Active Contexts → Tenant List
Manifested tenants currently in operation → (remove)
Manifestations: → tenants (prefix with count)
Synchronizing Multiverse... → Loading tenants...
No tenants manifested in this sector. → No tenants yet.
Context Identity → Tenant
Originator → Owner
Vital Status → Status
Manipulation → Actions
Forge Instance → Create Tenant
Tenant Obliterated → Tenant Deleted
USER CONTROL → Users
Global Identity & Access Management (RBAC) → Manage users & roles
Subjects Database → Users
Register New Identity → Create User
Fetching Identity Db... → Loading users...
No subjects found matching query. → No users found.
Unnamed Subject → No Name
Current Clearance (Claims) → Current Roles
Grant Privileges → Assign Role
Confirm Clearance Grant → Confirm Role Assignment
Immutable Subject → Protected Account
Root Superadmin...Master Control Program → Root admin. Cannot be modified.
Create Identity → Create User
```
