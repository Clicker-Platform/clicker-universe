# Backyard Expansion Plan 1 — Core Infrastructure + Tenant Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah shared layout components + 3 halaman baru (Module Control, Slug & Domain, Seed Tools) + update Sidebar ke 12 items di Backyard superadmin dashboard.

**Architecture:** Semua halaman baru di `backyard/app/` menggunakan `PageShell` wrapper untuk shared layout. Sidebar di-refactor jadi flat list dengan divider tanpa section label. Semua data via Cloud Functions callable yang sudah ada — tidak ada backend baru di Plan 1. Theme tidak berubah (brand-dark, brand-green, border-[2px], shadow-sticker).

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Firebase (Firestore + Functions callable), Lucide icons, Sonner toast

**Worktree:** Buat worktree baru `dev-backyard` dari branch `dev` sebelum mulai implementasi:
```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev"
git worktree add .worktrees/dev-backyard -b dev-backyard
```

---

## File Map

| File | Action |
|------|--------|
| `backyard/components/Sidebar.tsx` | Modify — refactor ke 12 items flat list |
| `backyard/components/PageShell.tsx` | Create — shared layout wrapper |
| `backyard/components/StatsGrid.tsx` | Create — reusable stats card grid |
| `backyard/app/modules/page.tsx` | Create — Module Control page |
| `backyard/app/domains/page.tsx` | Create — Slug & Domain page |
| `backyard/app/seed/page.tsx` | Create — Seed Tools page (wrap SeedTool.tsx) |

---

## Task 1: Refactor Sidebar ke 12 Items Flat List

**Files:**
- Modify: `backyard/components/Sidebar.tsx`

**Context:** Sidebar sekarang punya 5 items dengan icon. Refactor ke flat list 12 items dengan divider tipis, tanpa section label, tanpa emoji icon. Item baru ditandai titik hijau kecil. Badge error count di Monitoring tetap ada. Sign Out tetap di footer.

- [ ] **Step 1: Baca file Sidebar saat ini**

```bash
cat backyard/components/Sidebar.tsx
```

- [ ] **Step 2: Replace seluruh isi Sidebar.tsx**

Ganti isi `backyard/components/Sidebar.tsx` dengan:

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { toast } from 'sonner';

interface NavItem {
    label: string;
    href: string;
    isNew?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { label: 'Overview', href: '/' },
    { label: '—' as any, href: '' }, // divider
    { label: 'Tenants', href: '/tenants' },
    { label: 'Module Control', href: '/modules', isNew: true },
    { label: 'Slug & Domain', href: '/domains', isNew: true },
    { label: '—' as any, href: '' }, // divider
    { label: 'Users', href: '/users' },
    { label: 'Claims & Roles', href: '/claims', isNew: true },
    { label: 'RBAC Settings', href: '/rbac', isNew: true },
    { label: '—' as any, href: '' }, // divider
    { label: 'Monitoring', href: '/monitoring' },
    { label: 'Sync Control', href: '/sync', isNew: true },
    { label: 'Seed Tools', href: '/seed', isNew: true },
    { label: '—' as any, href: '' }, // divider
    { label: 'WhatsApp', href: '/whatsapp', isNew: true },
    { label: 'Settings', href: '/settings' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const [unreadCount, setUnreadCount] = useState(0);
    const [lastSeenAt, setLastSeenAt] = useState<Date>(() => {
        if (typeof window === 'undefined') return new Date(0);
        const stored = localStorage.getItem('monitoring_last_seen');
        return stored ? new Date(stored) : new Date(0);
    });

    useEffect(() => {
        const col = collection(db, 'platform_logs');
        const q = query(col, where('level', '==', 'error'), orderBy('ts', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            const newCount = snap.docs.filter((d) => {
                const ts = d.data().ts?.toDate?.();
                return ts && ts > lastSeenAt;
            }).length;
            setUnreadCount(newCount);
        }, (err) => {
            if (err.code === 'failed-precondition') return;
        });
        return unsub;
    }, [lastSeenAt]);

    const handleMonitoringClick = () => {
        const now = new Date();
        localStorage.setItem('monitoring_last_seen', now.toISOString());
        setLastSeenAt(now);
        setUnreadCount(0);
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            toast.success('Logged Out Successfully');
            router.push('/');
        } catch (error: any) {
            console.error('[backyard] logout.failed', { error: error instanceof Error ? error.message : String(error) });
            toast.error('Logout Failed', { description: error.message });
        }
    };

    return (
        <aside className="w-64 bg-white border-r border-gray-200 fixed inset-y-0 flex flex-col z-50">
            {/* Header */}
            <div className="h-20 flex items-center px-6 border-b border-slate-200">
                <div className="flex flex-col gap-1">
                    <span className="font-black text-brand-dark tracking-tight text-lg">Backyard</span>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-brand-green text-brand-dark px-2 py-0.5 rounded-full w-fit">God Mode</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 py-3 overflow-y-auto">
                {NAV_ITEMS.map((item, i) => {
                    if (item.label === '—') {
                        return <div key={i} className="h-px bg-gray-100 mx-4 my-1.5" />;
                    }
                    const isActive = item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                    const isMonitoring = item.href === '/monitoring';

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            onClick={isMonitoring ? handleMonitoringClick : undefined}
                            className={`flex items-center justify-between px-6 py-2.5 text-sm font-semibold transition-all border-l-[3px] ${
                                isActive
                                    ? 'border-brand-green bg-brand-green/5 text-brand-dark font-black'
                                    : 'border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                            <span>{item.label}</span>
                            <span className="flex items-center gap-1.5">
                                {isMonitoring && unreadCount > 0 && (
                                    <span className="bg-red-500 text-white text-[10px] font-black rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                                        {unreadCount > 99 ? '99+' : unreadCount}
                                    </span>
                                )}
                                {item.isNew && !isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-green" />
                                )}
                            </span>
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-3 text-red-500 hover:bg-red-50 rounded-lg transition-colors font-semibold text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
```

- [ ] **Step 3: Verify tidak ada TypeScript error**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard"
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: tidak ada error baru.

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add backyard/components/Sidebar.tsx
git commit -m "feat(backyard): refactor Sidebar to flat 12-item nav with dividers"
```

---

## Task 2: Buat `PageShell` Shared Layout Component

**Files:**
- Create: `backyard/components/PageShell.tsx`

**Context:** Setiap halaman Backyard saat ini punya boilerplate yang sama: `<div className="min-h-screen bg-gray-50/50 flex font-sans"><Sidebar /><div className="flex-1 ml-64 p-8">`. `PageShell` menggantikan boilerplate ini sehingga setiap page cukup pakai `<PageShell title="..." subtitle="...">`.

- [ ] **Step 1: Buat file `backyard/components/PageShell.tsx`**

```tsx
import Sidebar from '@/components/Sidebar';

interface PageShellProps {
    title: string;
    subtitle?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

export default function PageShell({ title, subtitle, action, children }: PageShellProps) {
    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <div className="max-w-6xl mx-auto">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-black text-brand-dark">{title}</h1>
                            {subtitle && <p className="text-sm text-gray-400 font-medium mt-0.5">{subtitle}</p>}
                        </div>
                        {action && <div>{action}</div>}
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add backyard/components/PageShell.tsx
git commit -m "feat(backyard): add PageShell shared layout component"
```

---

## Task 3: Buat `StatsGrid` Reusable Component

**Files:**
- Create: `backyard/components/StatsGrid.tsx`

**Context:** Stats card grid dipakai di Overview, Sync Control, WhatsApp Manager. Komponen ini menerima array stat items dan render grid card.

- [ ] **Step 1: Buat file `backyard/components/StatsGrid.tsx`**

```tsx
interface StatItem {
    label: string;
    value: string | number;
    variant?: 'default' | 'red' | 'green' | 'amber';
}

interface StatsGridProps {
    items: StatItem[];
    cols?: 2 | 3 | 4;
}

const variantClass: Record<string, string> = {
    default: 'text-brand-dark',
    red: 'text-red-600',
    green: 'text-green-600',
    amber: 'text-amber-600',
};

export default function StatsGrid({ items, cols = 3 }: StatsGridProps) {
    const gridClass = {
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
    }[cols];

    return (
        <div className={`grid ${gridClass} gap-4 mb-6`}>
            {items.map((item, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{item.label}</p>
                    <p className={`text-2xl font-black ${variantClass[item.variant ?? 'default']}`}>{item.value}</p>
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add backyard/components/StatsGrid.tsx
git commit -m "feat(backyard): add StatsGrid reusable component"
```

---

## Task 4: Buat Module Control Page

**Files:**
- Create: `backyard/app/modules/page.tsx`

**Context:** Halaman ini menampilkan tabel matrix tenant × modul. Setiap cell adalah toggle yang langsung call `updateTenantModules`. Data tenant diambil dari `getTenants`. `SYSTEM_MODULES` dari `@/lib/modules/definitions` sudah ada dan berisi semua modul yang tersedia.

- [ ] **Step 1: Buat `backyard/app/modules/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
import PageShell from '@/components/PageShell';

interface Tenant {
    id: string;
    name: string;
    modules: Record<string, boolean>;
}

export default function ModulesPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<string | null>(null); // `${tenantId}:${moduleId}`

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch {
                toast.error('Failed to load tenants');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const handleToggle = async (tenant: Tenant, moduleId: string, current: boolean) => {
        const key = `${tenant.id}:${moduleId}`;
        if (updating === key) return;

        // Optimistic update
        setTenants(prev => prev.map(t =>
            t.id === tenant.id
                ? { ...t, modules: { ...t.modules, [moduleId]: !current } }
                : t
        ));
        setUpdating(key);

        try {
            const fn = httpsCallable(functions, 'updateTenantModules');
            await fn({ siteId: tenant.id, modules: { ...tenant.modules, [moduleId]: !current } });
            toast.success(`${moduleId} ${!current ? 'enabled' : 'disabled'} for ${tenant.name}`);
        } catch (err: any) {
            // Revert on error
            setTenants(prev => prev.map(t =>
                t.id === tenant.id
                    ? { ...t, modules: { ...t.modules, [moduleId]: current } }
                    : t
            ));
            toast.error('Update failed', { description: err.message });
        } finally {
            setUpdating(null);
        }
    };

    return (
        <PageShell title="Module Control" subtitle="Toggle modules per tenant">
            {loading ? (
                <div className="text-center py-16 text-gray-400 font-medium">Loading tenants...</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-black text-brand-dark text-xs uppercase tracking-wider w-40">Tenant</th>
                                {SYSTEM_MODULES.map(mod => (
                                    <th key={mod.id} className="px-3 py-3 font-bold text-gray-400 text-xs uppercase tracking-wider text-center whitespace-nowrap">
                                        {mod.displayName}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => (
                                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-5 py-3 font-black text-brand-dark">{tenant.name}</td>
                                    {SYSTEM_MODULES.map(mod => {
                                        const enabled = tenant.modules?.[mod.id] ?? false;
                                        const key = `${tenant.id}:${mod.id}`;
                                        return (
                                            <td key={mod.id} className="px-3 py-3 text-center">
                                                <button
                                                    onClick={() => handleToggle(tenant, mod.id, enabled)}
                                                    disabled={updating === key}
                                                    className={`w-9 h-5 rounded-full transition-colors relative ${
                                                        enabled ? 'bg-brand-green' : 'bg-gray-200'
                                                    } ${updating === key ? 'opacity-50' : ''}`}
                                                >
                                                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                                                        enabled ? 'left-[18px]' : 'left-0.5'
                                                    }`} />
                                                </button>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tenants.length === 0 && (
                        <div className="text-center py-12 text-gray-400 font-medium">No tenants found</div>
                    )}
                </div>
            )}
        </PageShell>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard"
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: tidak ada error baru.

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add backyard/app/modules/page.tsx
git commit -m "feat(backyard): add Module Control page — tenant × module toggle matrix"
```

---

## Task 5: Buat Slug & Domain Page

**Files:**
- Create: `backyard/app/domains/page.tsx`

**Context:** Halaman ini menampilkan tabel tenant dengan slug dan URL preview. Edit slug inline — klik Edit, baris jadi editable, save call `updateTenantSlug`. URL preview adalah `{slug}.clicker.id`.

- [ ] **Step 1: Buat `backyard/app/domains/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Pencil, Check, X } from 'lucide-react';
import PageShell from '@/components/PageShell';

interface Tenant {
    id: string;
    name: string;
    slug: string;
}

export default function DomainsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                setTenants(res.data.list ?? []);
            } catch {
                toast.error('Failed to load tenants');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const startEdit = (tenant: Tenant) => {
        setEditingId(tenant.id);
        setEditValue(tenant.slug);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const saveSlug = async (tenant: Tenant) => {
        if (!editValue.trim() || editValue === tenant.slug) {
            cancelEdit();
            return;
        }
        setSaving(true);
        try {
            const fn = httpsCallable(functions, 'updateTenantSlug');
            await fn({ siteId: tenant.id, newSlug: editValue.trim() });
            setTenants(prev => prev.map(t =>
                t.id === tenant.id ? { ...t, slug: editValue.trim() } : t
            ));
            toast.success('Slug updated');
            cancelEdit();
        } catch (err: any) {
            toast.error('Update failed', { description: err.message });
        } finally {
            setSaving(false);
        }
    };

    return (
        <PageShell title="Slug & Domain" subtitle="Manage subdomain per tenant">
            {loading ? (
                <div className="text-center py-16 text-gray-400 font-medium">Loading...</div>
            ) : (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-gray-100">
                                <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-brand-dark">Tenant</th>
                                <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-brand-dark">Slug</th>
                                <th className="text-left px-5 py-3 font-black text-xs uppercase tracking-wider text-brand-dark">URL</th>
                                <th className="px-5 py-3" />
                            </tr>
                        </thead>
                        <tbody>
                            {tenants.map(tenant => (
                                <tr key={tenant.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-5 py-3 font-black text-brand-dark">{tenant.name}</td>
                                    <td className="px-5 py-3">
                                        {editingId === tenant.id ? (
                                            <input
                                                autoFocus
                                                value={editValue}
                                                onChange={e => setEditValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                                className="border-2 border-brand-dark rounded-lg px-2 py-1 text-sm font-mono w-40 outline-none"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') saveSlug(tenant);
                                                    if (e.key === 'Escape') cancelEdit();
                                                }}
                                            />
                                        ) : (
                                            <span className="font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded text-xs">{tenant.slug}</span>
                                        )}
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-400">
                                        {editingId === tenant.id
                                            ? `${editValue || tenant.slug}.clicker.id`
                                            : `${tenant.slug}.clicker.id`}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        {editingId === tenant.id ? (
                                            <div className="flex items-center gap-2 justify-end">
                                                <button
                                                    onClick={() => saveSlug(tenant)}
                                                    disabled={saving}
                                                    className="flex items-center gap-1 px-3 py-1.5 bg-brand-dark text-white rounded-lg text-xs font-bold"
                                                >
                                                    <Check className="w-3 h-3" /> Save
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-500"
                                                >
                                                    <X className="w-3 h-3" /> Cancel
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => startEdit(tenant)}
                                                className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 hover:border-brand-dark rounded-lg text-xs font-bold text-gray-600 transition-colors ml-auto"
                                            >
                                                <Pencil className="w-3 h-3" /> Edit
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {tenants.length === 0 && (
                        <div className="text-center py-12 text-gray-400 font-medium">No tenants found</div>
                    )}
                </div>
            )}
        </PageShell>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard"
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add backyard/app/domains/page.tsx
git commit -m "feat(backyard): add Slug & Domain page with inline edit"
```

---

## Task 6: Buat Seed Tools Page

**Files:**
- Create: `backyard/app/seed/page.tsx`

**Context:** `SeedTool.tsx` yang sudah ada hanya menerima input siteId manual. Halaman baru ini wrap `SeedTool` dengan tenant dropdown dari `getTenants` + seed history log di Firestore `platform_meta/seed_history`.

- [ ] **Step 1: Buat `backyard/app/seed/page.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import PageShell from '@/components/PageShell';
import { Loader2, Play } from 'lucide-react';

interface Tenant { id: string; name: string; }
interface SeedRecord { tenantId: string; tenantName: string; moduleId: string; ts: string; status: 'success' | 'error'; }

export default function SeedPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState('');
    const [selectedModule, setSelectedModule] = useState(SYSTEM_MODULES[0]?.id ?? '');
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [history, setHistory] = useState<SeedRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                const list = res.data.list ?? [];
                setTenants(list);
                if (list.length > 0) setSelectedTenant(list[0].id);
            } catch {
                toast.error('Failed to load tenants');
            }
        };

        const fetchHistory = async () => {
            try {
                const ref = doc(db, 'platform_meta', 'seed_history');
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const data = snap.data();
                    const entries: SeedRecord[] = (data.entries ?? []).slice(-20).reverse();
                    setHistory(entries);
                }
            } catch {
                // non-critical
            } finally {
                setHistoryLoading(false);
            }
        };

        fetchTenants();
        fetchHistory();
    }, []);

    const handleSeed = () => {
        if (!selectedTenant) {
            toast.warning('Select a tenant first');
            return;
        }
        setConfirmOpen(true);
    };

    const confirmSeed = async () => {
        setConfirmOpen(false);
        setLoading(true);
        const tenant = tenants.find(t => t.id === selectedTenant);
        const moduleLabel = SYSTEM_MODULES.find(m => m.id === selectedModule)?.displayName ?? selectedModule;

        try {
            const fn = httpsCallable(functions, 'seedSiteData');
            await fn({ siteId: selectedTenant });
            toast.success('Seed complete', { description: `${moduleLabel} data seeded for ${tenant?.name}` });

            // Save to history
            const record: SeedRecord = {
                tenantId: selectedTenant,
                tenantName: tenant?.name ?? selectedTenant,
                moduleId: selectedModule,
                ts: new Date().toISOString(),
                status: 'success',
            };
            await setDoc(doc(db, 'platform_meta', 'seed_history'), {
                entries: arrayUnion(record),
            }, { merge: true });
            setHistory(prev => [record, ...prev].slice(0, 20));
        } catch (err: any) {
            toast.error('Seed failed', { description: err.message });
            const record: SeedRecord = {
                tenantId: selectedTenant,
                tenantName: tenant?.name ?? selectedTenant,
                moduleId: selectedModule,
                ts: new Date().toISOString(),
                status: 'error',
            };
            setHistory(prev => [record, ...prev].slice(0, 20));
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageShell title="Seed Tools" subtitle="Seed sample data ke tenant">
            <div className="grid grid-cols-2 gap-4 mb-6 max-w-xl">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">1. Pilih Tenant</p>
                    <select
                        value={selectedTenant}
                        onChange={e => setSelectedTenant(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-brand-dark"
                    >
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">2. Pilih Modul</p>
                    <select
                        value={selectedModule}
                        onChange={e => setSelectedModule(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-brand-dark"
                    >
                        {SYSTEM_MODULES.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                    </select>
                </div>
            </div>

            <button
                onClick={handleSeed}
                disabled={loading || !selectedTenant}
                className="flex items-center gap-2 px-6 py-3 bg-brand-green text-brand-dark font-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 mb-8"
            >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {loading ? 'Seeding...' : 'Run Seed'}
            </button>

            <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Seed History</h2>
                {historyLoading ? (
                    <div className="text-sm text-gray-400">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="text-sm text-gray-400">No seed history yet.</div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden max-w-xl">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Tenant</th>
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Module</th>
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Time</th>
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((r, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="px-5 py-3 font-semibold text-gray-700">{r.tenantName}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-indigo-600">{r.moduleId}</td>
                                        <td className="px-5 py-3 text-gray-400 text-xs">{new Date(r.ts).toLocaleString('id-ID')}</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                r.status === 'success'
                                                    ? 'bg-green-50 text-green-700'
                                                    : 'bg-red-50 text-red-600'
                                            }`}>
                                                {r.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmationDialog
                open={confirmOpen}
                onClose={() => setConfirmOpen(false)}
                onConfirm={confirmSeed}
                title="Run Seed?"
                description={`Seed ${SYSTEM_MODULES.find(m => m.id === selectedModule)?.displayName ?? selectedModule} data ke tenant ${tenants.find(t => t.id === selectedTenant)?.name ?? selectedTenant}? Data lama mungkin akan ditimpa.`}
            />
        </PageShell>
    );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard"
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

- [ ] **Step 3: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add backyard/app/seed/page.tsx
git commit -m "feat(backyard): add Seed Tools page with tenant dropdown and history log"
```

---

## Task 7: Tambah Firestore Rules untuk `platform_meta`

**Files:**
- Modify: `clicker-platform-v2/firestore.rules`

**Context:** Seed Tools menulis ke `platform_meta/seed_history`. Plan 2 juga akan pakai `platform_meta/rbac_config` dan `platform_meta/sync_status`. Perlu tambah rule untuk collection ini sekarang agar semua Plan 1 bisa berjalan.

- [ ] **Step 1: Baca firestore.rules**

```bash
grep -n "platform_meta\|platform_logs\|isGlobalAdmin" clicker-platform-v2/firestore.rules | head -20
```

- [ ] **Step 2: Tambah rule `platform_meta`**

Buka `clicker-platform-v2/firestore.rules`. Cari rule `platform_logs` yang sudah ada. Tambahkan rule berikut tepat di bawahnya (sebelum default deny):

```
match /platform_meta/{docId} {
  allow read: if isGlobalAdmin();
  allow write: if isGlobalAdmin();
}
```

- [ ] **Step 3: Verify rules compile**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/clicker-platform-v2"
firebase rules:test 2>&1 | head -10 || echo "Run: firebase deploy --only firestore:rules --dry-run"
```

- [ ] **Step 4: Commit**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git add clicker-platform-v2/firestore.rules
git commit -m "fix(firestore): add platform_meta rules for seed history and future meta docs"
```

---

## Task 8: Final Verification Plan 1

- [ ] **Step 1: TypeScript check semua Backyard files**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard"
pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: tidak ada error.

- [ ] **Step 2: Verify semua route ada**

```bash
find "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard/app" -name "page.tsx" | sort
```

Expected: ada `modules/page.tsx`, `domains/page.tsx`, `seed/page.tsx`.

- [ ] **Step 3: Verify komponen baru ada**

```bash
ls "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard/components/"
```

Expected: ada `PageShell.tsx`, `StatsGrid.tsx`.

- [ ] **Step 4: Verify Sidebar punya 12 menu items**

```bash
grep -c "href:" "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard/backyard/components/Sidebar.tsx"
```

Expected: `12`

- [ ] **Step 5: Commit jika ada cleanup**

```bash
cd "/Users/mac/Documents/AI Project/clicker-platform/dev/.worktrees/dev-backyard"
git status
# Jika ada perubahan yang belum di-commit:
git add -A && git commit -m "fix(backyard): plan 1 final verification cleanup"
```
