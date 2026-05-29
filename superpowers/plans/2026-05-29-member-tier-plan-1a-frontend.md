# Member Dashboard — Plan 1a: Frontend (Mock Data)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Steps use checkbox (`- [ ]`).

**Goal:** Build the entire member dashboard UI — BMC-style, sidebar-only, Coral-default accent, login (branded split), Home (full + empty), Library surface (cover cards), accent picker — running in `pnpm dev` against **typed mock-data providers**. No Firebase, no auth, no Firestore. Pure visual build.

**Architecture:** Every piece of data the UI needs comes through a small **typed boundary** (`lib/account/mock/*` providers) whose function signatures EXACTLY match the real APIs that Plan 1b will supply. Wiring later = replace provider bodies, not touch components. Accent = CSS-var triple set on the shell root from a (mock) member's `accentPreset`.

**Tech Stack:** Next.js App Router, Tailwind v4 (`@theme` in `app/globals.css`), lucide-react, React state. Vitest only for the pure helper (accent resolution).

**Reference:** spec `superpowers/specs/2026-05-29-member-tier-dashboard-design.md` §3.2; mockups in `.superpowers/brainstorm/`. Style memory: BMC aesthetic.

**Precondition:** none. Builds standalone. **Does not** touch the existing buyer system.

> **CONVENTIONS:** Tailwind v4 — custom colors live as `--color-*` in `app/globals.css @theme`. Accent is NOT a Tailwind color; it's runtime CSS vars (`--member-accent` etc.) set inline on the shell root, referenced via `style`/arbitrary `[color:var(--member-accent)]`. Use `lucide-react` for icons. All member routes under `app/[tenant]/account/`.

---

## Data boundary (the contract Plan 1b will satisfy)

```ts
// lib/account/mock/types.ts — shapes mirror the real lib/account types
export type AccentPresetId = 'yellow' | 'green' | 'coral' | 'indigo';
export interface MockMember { uid: string; email: string; fullName?: string; accentPreset?: AccentPresetId; }
export interface MockSurfaceNavItem { id: string; label: string; href: string; }   // mirrors VisibleSurface→nav
export interface MockLibraryItem { id: string; title: string; kind: 'pdf' | 'youtube'; cover?: string; }
```

Providers (1a returns fakes; 1b swaps bodies for real APIs):
- `getMockMember(): MockMember`
- `getMockSurfaces(member): MockSurfaceNavItem[]`
- `getMockLibrary(member): MockLibraryItem[]`

---

## Task 1: Accent tokens + resolver

**Files:**
- Modify: `app/globals.css` (add neutral member-surface tokens to `@theme`)
- Create: `lib/account/accent.ts`
- Test: `lib/account/__tests__/accent.test.ts`

- [ ] **Step 1: Add accent preset map + resolver (failing test first)**

```ts
// lib/account/__tests__/accent.test.ts
import { describe, it, expect } from 'vitest';
import { resolveAccentVars, DEFAULT_ACCENT_PRESET } from '../accent';

describe('resolveAccentVars', () => {
  it('defaults to coral when unset', () => {
    expect(DEFAULT_ACCENT_PRESET).toBe('coral');
    expect(resolveAccentVars(undefined)['--member-accent']).toBe('#FF6B5E');
  });
  it('maps a chosen preset', () => {
    const v = resolveAccentVars('indigo');
    expect(v['--member-accent']).toBe('#6366F1');
    expect(v['--member-accent-fg']).toBe('#ffffff');
    expect(v['--member-accent-soft']).toBe('#EEF0FF');
  });
});
```

- [ ] **Step 2: Run — fails** (`pnpm test lib/account/__tests__/accent.test.ts`).

- [ ] **Step 3: Implement**

```ts
// lib/account/accent.ts
export type AccentPresetId = 'yellow' | 'green' | 'coral' | 'indigo';

export const ACCENT_PRESETS: Record<AccentPresetId, { accent: string; fg: string; soft: string }> = {
  yellow: { accent: '#FFD93D', fg: '#1a1a1a', soft: '#FFF7D6' },
  green:  { accent: '#22C55E', fg: '#ffffff', soft: '#DCFCE7' },
  coral:  { accent: '#FF6B5E', fg: '#ffffff', soft: '#FFE7E3' },
  indigo: { accent: '#6366F1', fg: '#ffffff', soft: '#EEF0FF' },
};
export const DEFAULT_ACCENT_PRESET: AccentPresetId = 'coral';

export function resolveAccentVars(preset: AccentPresetId | undefined): Record<string, string> {
  const p = ACCENT_PRESETS[preset ?? DEFAULT_ACCENT_PRESET];
  return { '--member-accent': p.accent, '--member-accent-fg': p.fg, '--member-accent-soft': p.soft };
}
```

- [ ] **Step 4: Run — passes.**

- [ ] **Step 5: Commit** — `git add lib/account/accent.ts lib/account/__tests__/accent.test.ts app/globals.css && git commit -m "feat(account): accent preset tokens + resolver"`

---

## Task 2: Mock data providers

**Files:** Create `lib/account/mock/types.ts`, `lib/account/mock/providers.ts`

- [ ] **Step 1:** write `types.ts` (shapes above) and:

```ts
// lib/account/mock/providers.ts
import type { MockMember, MockSurfaceNavItem, MockLibraryItem } from './types';

export function getMockMember(): MockMember {
  return { uid: 'mock-jane', email: 'jane@email.com', fullName: 'Jane', accentPreset: 'coral' };
}
export function getMockSurfaces(_m: MockMember): MockSurfaceNavItem[] {
  return [{ id: 'library', label: 'My Library', href: 'library' }];
}
export function getMockLibrary(_m: MockMember): MockLibraryItem[] {
  return [
    { id: '1', title: 'Bebas Utang 90 Hari', kind: 'pdf' },
    { id: '2', title: 'Investasi Pemula', kind: 'youtube' },
    { id: '3', title: 'Budgeting 101', kind: 'pdf' },
  ];
}
// Toggle to test empty Home: export an empty-surfaces variant during dev.
```

- [ ] **Step 2: Commit** — `git commit -m "feat(account): typed mock data providers (1a)"`

---

## Task 3: Sidebar + shell (sidebar-only, accent applied)

**Files:** Create `components/account/MemberSidebar.tsx`, `components/account/MemberShell.tsx`

- [ ] **Step 1: Sidebar** — brand top, soft-accent selected highlight (uses `var(--member-accent-soft)` bg + accent text), avatar bottom. Items from props.

```tsx
// components/account/MemberSidebar.tsx
'use client';
import Link from 'next/link';
import { Home } from 'lucide-react';
import type { MockSurfaceNavItem } from '@/lib/account/mock/types';

export function MemberSidebar({ tenant, brand, items, active, member }:{
  tenant:string; brand:string; items:MockSurfaceNavItem[]; active:string; member:{fullName?:string;email:string};
}) {
  const link = (href:string,label:string,key:string,Icon?:any) => {
    const on = active === key;
    return (
      <Link href={`/${tenant}/account/${href}`.replace(/\/$/,'')}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition"
        style={on ? { background:'var(--member-accent-soft)', color:'var(--member-accent)' } : { color:'#4b5563' }}>
        {Icon && <Icon size={16} />} {label}
      </Link>
    );
  };
  return (
    <aside className="w-[200px] shrink-0 bg-white border-r border-gray-100 p-4 flex flex-col">
      <div className="font-extrabold text-gray-900 text-base mb-5 px-1">{brand}</div>
      <nav className="space-y-1">
        {link('', 'Home', 'home', Home)}
        {items.map(it => link(it.href, it.label, it.id))}
      </nav>
      <div className="mt-auto flex items-center gap-2 border-t border-gray-100 pt-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
             style={{ background:'var(--member-accent)', color:'var(--member-accent-fg)' }}>
          {(member.fullName ?? member.email)[0]?.toUpperCase()}
        </div>
        <span className="text-sm text-gray-700 truncate">{member.fullName ?? member.email}</span>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Shell** — light canvas, applies accent vars on root, renders sidebar + top-right (bell + avatar), hosts the accent picker (Task 6). For 1a it reads `getMockMember()`; uses `usePathname()` to compute `active` and to render auth routes full-bleed.

```tsx
// components/account/MemberShell.tsx
'use client';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Bell } from 'lucide-react';
import { getMockMember } from '@/lib/account/mock/providers';
import { getMockSurfaces } from '@/lib/account/mock/providers';
import { resolveAccentVars, type AccentPresetId } from '@/lib/account/accent';
import { MemberSidebar } from './MemberSidebar';
import { AccentPicker } from './AccentPicker';

export function MemberShell({ tenant, children }:{ tenant:string; children:React.ReactNode }) {
  const pathname = usePathname() || '';
  const isAuth = pathname.includes('/account/login');
  const member = getMockMember();
  const [preset, setPreset] = useState<AccentPresetId>(member.accentPreset ?? 'coral');
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isAuth) return <>{children}</>;

  const items = getMockSurfaces(member);
  const seg = pathname.split('/account/')[1]?.split('/')[0] ?? '';
  const active = seg === '' ? 'home' : (items.find(i=>i.href===seg)?.id ?? 'home');

  return (
    <div className="min-h-screen flex bg-[#f4f4f6]" style={resolveAccentVars(preset) as React.CSSProperties}>
      <MemberSidebar tenant={tenant} brand="Acme ☕" items={items} active={active} member={member} />
      <main className="flex-1 px-7 py-6 relative">
        <div className="absolute right-7 top-6 flex gap-2">
          <button className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center"><Bell size={16} /></button>
          <button onClick={()=>setPickerOpen(o=>!o)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background:'var(--member-accent)', color:'var(--member-accent-fg)' }}>
            {(member.fullName ?? member.email)[0]?.toUpperCase()}
          </button>
        </div>
        {pickerOpen && <AccentPicker value={preset} onChange={setPreset} onClose={()=>setPickerOpen(false)} />}
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit** — `git commit -m "feat(account): member shell + sidebar (BMC style, accent vars)"`

---

## Task 4: Layout + Home (full + empty states)

**Files:** Create `app/[tenant]/account/layout.tsx`, `app/[tenant]/account/page.tsx`

- [ ] **Step 1: Layout** wraps children in `MemberShell`.

```tsx
// app/[tenant]/account/layout.tsx
import { MemberShell } from '@/components/account/MemberShell';
export const dynamic = 'force-dynamic';
export default async function AccountLayout({ children, params }:{ children:React.ReactNode; params:Promise<{tenant:string}> }) {
  const { tenant } = await params;
  return <MemberShell tenant={tenant}>{children}</MemberShell>;
}
```

- [ ] **Step 2: Home** — greeting + Library cover-cards (full state). Empty state (no surfaces) handled by checking `getMockSurfaces`/`getMockLibrary` length → friendly centered empty + CTA.

```tsx
// app/[tenant]/account/page.tsx
'use client';
import { ArrowRight, Play } from 'lucide-react';
import { getMockMember, getMockSurfaces, getMockLibrary } from '@/lib/account/mock/providers';

export default function AccountHome() {
  const member = getMockMember();
  const surfaces = getMockSurfaces(member);
  const library = getMockLibrary(member);

  if (surfaces.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="text-5xl mb-3">🪴</div>
        <div className="text-xl font-extrabold text-gray-900">Halo, {member.fullName} 👋</div>
        <p className="text-gray-500 mt-2 max-w-xs">Belum ada layanan di akun kamu. Jelajahi produk untuk mulai.</p>
        <button className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-bold"
          style={{ background:'var(--member-accent)', color:'var(--member-accent-fg)' }}>Lihat produk <ArrowRight size={16}/></button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Halo, {member.fullName} 👋</h1>
      <p className="text-gray-500 mt-0.5">Semua produk & layanan kamu, di satu tempat.</p>
      <h2 className="text-sm font-bold text-gray-900 mt-6 mb-3">My Library</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {library.map(it => (
          <div key={it.id} className="bg-white rounded-2xl overflow-hidden shadow-[0_2px_10px_rgba(0,0,0,0.05)]">
            <div className="h-[88px] relative" style={{ background:'linear-gradient(135deg,#fda4af,#fb7185)' }}>
              {it.kind==='youtube' && <span className="absolute inset-0 flex items-center justify-center text-white text-2xl"><Play/></span>}
            </div>
            <div className="p-3"><div className="font-bold text-gray-900">{it.title}</div>
              <div className="text-gray-400 text-xs mt-0.5">{it.kind.toUpperCase()}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Manual smoke** — `pnpm dev`, open `/<anytenant>/account` → styled Home with 3 cards. Temporarily make `getMockSurfaces` return `[]` → empty state renders. Revert.

- [ ] **Step 4: Commit** — `git commit -m "feat(account): home (full + empty) with library cover cards"`

---

## Task 5: Library surface page

**Files:** Create `app/[tenant]/account/library/page.tsx`

- [ ] **Step 1:** dedicated Library page — same cover-card grid as Home's section, full width, "My Library" heading; empty → "Belum ada produk di library kamu." Reuse the card markup (extract `LibraryCard` into `components/account/LibraryCard.tsx` to avoid duplication with Home).

- [ ] **Step 2: Manual smoke** — sidebar "My Library" → grid renders; selected nav shows soft-accent highlight.

- [ ] **Step 3: Commit** — `git commit -m "feat(account): library surface page + shared LibraryCard"`

---

## Task 6: Accent picker

**Files:** Create `components/account/AccentPicker.tsx`

- [ ] **Step 1:** popover with the 4 preset dots; current shows a ring; clicking calls `onChange` (1a: updates shell state → CSS vars change live; 1b: also persists to `accounts/{uid}.accentPreset`). Copy: "Warna tema" / "Pilihan kamu, tersimpan otomatis."

```tsx
// components/account/AccentPicker.tsx
'use client';
import { ACCENT_PRESETS, type AccentPresetId } from '@/lib/account/accent';
export function AccentPicker({ value, onChange, onClose }:{ value:AccentPresetId; onChange:(p:AccentPresetId)=>void; onClose:()=>void }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute right-7 top-[58px] z-40 bg-white rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.14)] p-3.5 w-[180px]">
        <div className="font-bold text-gray-900 mb-2.5">Warna tema</div>
        <div className="flex gap-2.5">
          {(Object.keys(ACCENT_PRESETS) as AccentPresetId[]).map(id => (
            <button key={id} onClick={()=>onChange(id)} aria-label={id}
              className="w-[30px] h-[30px] rounded-full box-border"
              style={{ background:ACCENT_PRESETS[id].accent, border: value===id ? '3px solid #111' : '3px solid transparent' }} />
          ))}
        </div>
        <div className="text-gray-400 mt-2.5 text-[10px]">Pilihan kamu, tersimpan otomatis.</div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Manual smoke** — click avatar → picker opens; pick Indigo → whole dashboard recolors live (sidebar highlight, avatar, buttons). Pick Coral → back.

- [ ] **Step 3: Commit** — `git commit -m "feat(account): live accent picker (1a in-memory)"`

---

## Task 7: Login (branded split) + verify placeholder

**Files:** Create `app/[tenant]/account/login/page.tsx`, `login/LoginClient.tsx`

- [ ] **Step 1:** branded split — left full-bleed accent panel (uses default Coral for the unauthenticated state, since no member preset yet) with brand + tagline + a faux social-proof footer; right white form with single email field + pill "Kirim link login" → swaps to "Cek email kamu" confirmation. 1a: submit just flips local state (no fetch). "Already have an account? Sign in" affordance top-right (cosmetic in 1a).

- [ ] **Step 2: Manual smoke** — `/<tenant>/account/login` → split layout, submit shows confirmation. Full-bleed accent panel left.

- [ ] **Step 3: Commit** — `git commit -m "feat(account): branded-split login (1a static)"`

---

## Plan 1a Done — Exit criteria

- `pnpm dev` → `/<tenant>/account` renders the full BMC-style dashboard: sidebar-only, Coral default, Home with cover cards, Library page, live accent picker (4 presets), branded-split login, empty-Home state.
- All data flows through `lib/account/mock/providers.ts` with signatures matching the real APIs.
- Accent strictly via CSS vars; no hard-coded accent in components.
- `pnpm test` (accent resolver) + `pnpm tsc --noEmit` green.

**Next: Plan 1b (wiring)** — the existing `2026-05-29-member-tier-plan-1-foundation.md` backend tasks (accounts API, magic-link route, session, surface composition, registry `memberSurface`, digital_goods Library data). Wiring = swap the 3 mock providers + login/verify/picker to call real APIs; components unchanged.
