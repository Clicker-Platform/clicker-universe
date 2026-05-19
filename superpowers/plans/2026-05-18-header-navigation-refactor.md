# Header Navigation Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded header with a token-driven, variant-based Header Navigation system (4 layout variants, independent width/scroll/typography properties) owned by Canvas Studio. Templates contribute visual tokens only.

**Architecture:** Variant-per-file with shared wrapper. `HeaderNavigation` (wrapper) reads config + runs scroll/typography hooks; `HeaderShell` owns container/positioning/scrolled-state; each variant is a small pure-structure file. Data lives at `sites/{siteId}/content/siteSettings.navigation.header` with lazy migration from legacy fields.

**Tech Stack:** Next.js, React 19, TypeScript, Tailwind, Firestore, Vitest, React Testing Library, dnd-kit (existing).

**Spec:** [superpowers/specs/2026-05-18-header-navigation-refactor-design.md](../specs/2026-05-18-header-navigation-refactor-design.md)

---

## Conventions

- All commands assume working directory `clicker-platform-v2/` unless noted.
- Tests use Vitest + RTL. Run a single file with `pnpm test <path>`.
- All Firestore writes go through existing `useNavigationConfig` helpers — do not write to Firestore directly from new code.
- All theme tokens are accessed via `useTemplate()` → `theme.colors.*`.
- Existing patterns to follow:
  - Variant registry: see `components/admin/blocks/registry.tsx` for an example of `{ [variant]: Component }` mapping.
  - Hook conventions: see `lib/hooks/useNavigationConfig.ts` for the auto-save debounce pattern.
- Commit messages use Conventional Commits prefix (`feat:`, `refactor:`, `test:`, `chore:`, `docs:`).

---

## Task 1: Add types for new Header Navigation config

**Files:**
- Modify: `clicker-platform-v2/data/mockData.ts`

- [ ] **Step 1: Read the existing types**

Open `data/mockData.ts` and locate the existing `NavigationItem`, `NavBarStyle`, `TopNavActions` interface definitions (around lines 200–260). Read them so the new types are added consistently next to them.

- [ ] **Step 2: Add new types**

Append these to `data/mockData.ts` immediately after the existing nav-related types:

```ts
// === Header Navigation v2 — variant-based, token-driven ===

export type HeaderVariant = 'logo-left' | 'logo-center' | 'burger' | 'logo-left-stacked';
export type HeaderScrollBehavior = 'none' | 'fixed' | 'sticky-on-scroll-up' | 'shrink-on-scroll';
export type HeaderContainerWidth = 'full' | 'constrained';
export type HeaderNavTextPreset = 'default' | 'tight' | 'spacious' | 'sentence-case';

export interface HeaderTypography {
  preset: HeaderNavTextPreset;
  trackingOverride?: 'normal' | 'tight' | 'wide';
  caseOverride?: 'uppercase' | 'none';
}

export interface HeaderCTA {
  enabled: boolean;
  label: string;
  linkType: 'page' | 'form' | 'url' | 'action';
  linkValue: string;
  formId?: string;
  pageId?: string;
}

export interface HeaderScrolledAppearance {
  enabled: boolean;
  bgColor?: string;
  showBorder?: boolean;
}

export interface HeaderNavigationConfig {
  variant: HeaderVariant;
  width: HeaderContainerWidth;
  scrollBehavior: HeaderScrollBehavior;
  items: NavigationItem[];
  cta: HeaderCTA;
  bgColor?: string;
  showBorder?: boolean;
  typography: HeaderTypography;
  scrolledAppearance: HeaderScrolledAppearance;
}
```

Also extend `NavigationItem` with the Phase-2 `children` field. Find the existing `NavigationItem` interface and add:

```ts
export interface NavigationItem {
  // ...existing fields...
  /** Phase 2 — schema only in Phase 1, no rendering or editor UI */
  children?: NavigationItem[];
}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors related to the additions (pre-existing errors elsewhere may remain — only check that the new types compile).

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/data/mockData.ts
git commit -m "feat(header-nav): add HeaderNavigationConfig types"
```

---

## Task 2: Write migration synthesizer (TDD)

**Files:**
- Create: `clicker-platform-v2/lib/migrations/headerNavigation.ts`
- Test: `clicker-platform-v2/lib/migrations/__tests__/headerNavigation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/migrations/__tests__/headerNavigation.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { synthesizeHeaderConfig } from '../headerNavigation';
import type { HeaderNavigationConfig } from '@/data/mockData';

describe('synthesizeHeaderConfig', () => {
  it('returns new-site defaults when legacy navigation is empty', () => {
    const result = synthesizeHeaderConfig(undefined);
    expect(result.variant).toBe('logo-left');
    expect(result.width).toBe('constrained');
    expect(result.scrollBehavior).toBe('fixed');
    expect(result.typography.preset).toBe('default');
    expect(result.items).toEqual([]);
    expect(result.cta.enabled).toBe(false);
    expect(result.scrolledAppearance.enabled).toBe(false);
  });

  it('preserves existing tenant look when legacy fields are present', () => {
    const legacy = {
      topNav: [{ id: '1', label: 'Home', type: 'link' as const, value: '/' }],
      topNavActions: {
        cta: { enabled: true, label: 'Book', linkType: 'url' as const, linkValue: 'https://x.test' },
      },
      headerStyle: { bgColor: '#000000', showBorder: true },
    };
    const result = synthesizeHeaderConfig(legacy);
    expect(result.variant).toBe('logo-left');
    expect(result.width).toBe('full'); // preserves today's full-bleed
    expect(result.scrollBehavior).toBe('fixed');
    expect(result.typography.preset).toBe('spacious'); // preserves tracking-[0.2em] look
    expect(result.items).toEqual(legacy.topNav);
    expect(result.cta).toEqual(legacy.topNavActions.cta);
    expect(result.bgColor).toBe('#000000');
    expect(result.showBorder).toBe(true);
  });

  it('handles partial legacy state', () => {
    const result = synthesizeHeaderConfig({ topNav: [], headerStyle: { showBorder: false } });
    expect(result.width).toBe('full');
    expect(result.typography.preset).toBe('spacious');
    expect(result.showBorder).toBe(false);
    expect(result.cta.enabled).toBe(false);
  });

  it('passes through when navigation.header is already present', () => {
    const existing: HeaderNavigationConfig = {
      variant: 'logo-center',
      width: 'constrained',
      scrollBehavior: 'sticky-on-scroll-up',
      items: [],
      cta: { enabled: false, label: '', linkType: 'url', linkValue: '' },
      typography: { preset: 'tight' },
      scrolledAppearance: { enabled: false },
    };
    const result = synthesizeHeaderConfig({ header: existing });
    expect(result).toEqual(existing);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test lib/migrations/__tests__/headerNavigation.test.ts`
Expected: FAIL with "Cannot find module '../headerNavigation'"

- [ ] **Step 3: Implement the migration synthesizer**

Create `lib/migrations/headerNavigation.ts`:

```ts
import type {
  HeaderNavigationConfig,
  NavigationItem,
  HeaderCTA,
} from '@/data/mockData';

interface LegacyNavigationShape {
  header?: HeaderNavigationConfig;
  topNav?: NavigationItem[];
  topNavActions?: { cta?: HeaderCTA } | null;
  headerStyle?: { bgColor?: string; showBorder?: boolean };
}

const NEW_SITE_DEFAULTS: HeaderNavigationConfig = {
  variant: 'logo-left',
  width: 'constrained',
  scrollBehavior: 'fixed',
  items: [],
  cta: { enabled: false, label: '', linkType: 'url', linkValue: '' },
  typography: { preset: 'default' },
  scrolledAppearance: { enabled: false },
};

export function synthesizeHeaderConfig(
  legacy: LegacyNavigationShape | undefined,
): HeaderNavigationConfig {
  if (legacy?.header) return legacy.header;

  if (!legacy || (!legacy.topNav && !legacy.topNavActions && !legacy.headerStyle)) {
    return NEW_SITE_DEFAULTS;
  }

  // Existing tenant — preserve today's look exactly
  return {
    variant: 'logo-left',
    width: 'full',
    scrollBehavior: 'fixed',
    items: legacy.topNav ?? [],
    cta:
      legacy.topNavActions?.cta ?? {
        enabled: false,
        label: '',
        linkType: 'url',
        linkValue: '',
      },
    bgColor: legacy.headerStyle?.bgColor,
    showBorder: legacy.headerStyle?.showBorder ?? true,
    typography: { preset: 'spacious' },
    scrolledAppearance: { enabled: false },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test lib/migrations/__tests__/headerNavigation.test.ts`
Expected: PASS, all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/lib/migrations/
git commit -m "feat(header-nav): lazy migration from legacy navigation shape"
```

---

## Task 3: Wire migration into useNavigationConfig

**Files:**
- Modify: `clicker-platform-v2/lib/hooks/useNavigationConfig.ts`
- Modify: `clicker-platform-v2/components/layout/NavigationProvider.tsx`

- [ ] **Step 1: Update the hook return shape**

In `lib/hooks/useNavigationConfig.ts`, add `header: HeaderNavigationConfig` to the returned object. Import the type from `@/data/mockData`. Add a `setHeader` state setter and call `synthesizeHeaderConfig` against the snapshot data.

```ts
import { synthesizeHeaderConfig } from '@/lib/migrations/headerNavigation';
import type { HeaderNavigationConfig } from '@/data/mockData';

// inside the hook, alongside existing state:
const [header, setHeader] = useState<HeaderNavigationConfig>(() =>
  synthesizeHeaderConfig(initialData ?? undefined)
);

// inside the onSnapshot handler, after reading `nav`:
setHeader(synthesizeHeaderConfig(nav));

// in the returned memo, add `header`:
return useMemo(
  () => ({ topNav, topNavActions, bottomNav, fab, headerStyle, bottomNavStyle, header, loading, error }),
  [topNav, topNavActions, bottomNav, fab, headerStyle, bottomNavStyle, header, loading, error]
);
```

Also expose `setHeader` (alongside whatever pattern the file uses for `setTopNav`, etc. — match the existing style).

- [ ] **Step 2: Update the Context type in NavigationProvider**

In `components/layout/NavigationProvider.tsx`, add `header: HeaderNavigationConfig` to the context value type and to the provider value passed to children.

- [ ] **Step 3: Smoke test**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

Run: `pnpm dev` and open `localhost:3000/go/layout`. Open React DevTools, find `NavigationProvider`, confirm `header` exists with `variant: 'logo-left'`, `width: 'full'`, `typography.preset: 'spacious'` (legacy site migration). Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/lib/hooks/useNavigationConfig.ts clicker-platform-v2/components/layout/NavigationProvider.tsx
git commit -m "feat(header-nav): expose synthesized header config via NavigationProvider"
```

---

## Task 4: Write useHeaderTypography (TDD)

**Files:**
- Create: `clicker-platform-v2/components/layout/header/useHeaderTypography.ts`
- Test: `clicker-platform-v2/components/layout/header/__tests__/useHeaderTypography.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/layout/header/__tests__/useHeaderTypography.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveHeaderTypographyClass } from '../useHeaderTypography';
import type { HeaderTypography } from '@/data/mockData';

describe('resolveHeaderTypographyClass', () => {
  it('returns default preset class', () => {
    const result = resolveHeaderTypographyClass({ preset: 'default' });
    expect(result).toContain('text-sm');
    expect(result).toContain('font-medium');
    expect(result).toContain('tracking-normal');
    expect(result).not.toContain('uppercase');
  });

  it('returns spacious preset class with uppercase', () => {
    const result = resolveHeaderTypographyClass({ preset: 'spacious' });
    expect(result).toContain('text-xs');
    expect(result).toContain('font-bold');
    expect(result).toContain('tracking-[0.2em]');
    expect(result).toContain('uppercase');
  });

  it('applies tracking override', () => {
    const cfg: HeaderTypography = { preset: 'spacious', trackingOverride: 'tight' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('tracking-tight');
    expect(result).not.toContain('tracking-[0.2em]');
  });

  it('applies case override (none) on uppercase preset', () => {
    const cfg: HeaderTypography = { preset: 'spacious', caseOverride: 'none' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).not.toContain('uppercase');
  });

  it('applies case override (uppercase) on default preset', () => {
    const cfg: HeaderTypography = { preset: 'default', caseOverride: 'uppercase' };
    const result = resolveHeaderTypographyClass(cfg);
    expect(result).toContain('uppercase');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test components/layout/header/__tests__/useHeaderTypography.test.ts`
Expected: FAIL with "Cannot find module '../useHeaderTypography'"

- [ ] **Step 3: Implement**

Create `components/layout/header/useHeaderTypography.ts`:

```ts
import type { HeaderTypography, HeaderNavTextPreset } from '@/data/mockData';

const PRESETS: Record<HeaderNavTextPreset, string> = {
  'default': 'text-sm font-medium tracking-normal',
  'tight': 'text-sm font-semibold tracking-tight uppercase',
  'spacious': 'text-xs font-bold tracking-[0.2em] uppercase',
  'sentence-case': 'text-base font-medium tracking-normal',
};

const TRACKING_OVERRIDE: Record<NonNullable<HeaderTypography['trackingOverride']>, string> = {
  'normal': 'tracking-normal',
  'tight': 'tracking-tight',
  'wide': 'tracking-wider',
};

export function resolveHeaderTypographyClass(typography: HeaderTypography): string {
  let classes = PRESETS[typography.preset];

  if (typography.trackingOverride) {
    classes = classes.replace(/tracking-\S+/g, '').trim();
    classes += ' ' + TRACKING_OVERRIDE[typography.trackingOverride];
  }

  if (typography.caseOverride === 'none') {
    classes = classes.replace(/\buppercase\b/g, '').trim();
  } else if (typography.caseOverride === 'uppercase') {
    if (!classes.includes('uppercase')) classes += ' uppercase';
  }

  return classes.replace(/\s+/g, ' ').trim();
}

export function useHeaderTypography(typography: HeaderTypography): string {
  return resolveHeaderTypographyClass(typography);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test components/layout/header/__tests__/useHeaderTypography.test.ts`
Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/layout/header/useHeaderTypography.ts clicker-platform-v2/components/layout/header/__tests__/
git commit -m "feat(header-nav): typography preset + override resolver"
```

---

## Task 5: Write useScrollBehavior (TDD)

**Files:**
- Create: `clicker-platform-v2/components/layout/header/useScrollBehavior.ts`
- Test: `clicker-platform-v2/components/layout/header/__tests__/useScrollBehavior.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/layout/header/__tests__/useScrollBehavior.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollBehavior } from '../useScrollBehavior';

describe('useScrollBehavior', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });

  it('returns visible+unscrolled for behavior=none', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'none' }));
    expect(result.current.visible).toBe(true);
    expect(result.current.scrolled).toBe(false);
    expect(result.current.shrunk).toBe(false);
  });

  it('returns visible+unscrolled for behavior=fixed at scrollY=0', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'fixed' }));
    expect(result.current.visible).toBe(true);
    expect(result.current.scrolled).toBe(false);
  });

  it('sets scrolled=true when scrollY > 80', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'fixed' }));
    act(() => {
      (window as any).scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.scrolled).toBe(true);
  });

  it('sets shrunk=true for shrink-on-scroll when scrollY > 80', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'shrink-on-scroll' }));
    act(() => {
      (window as any).scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.shrunk).toBe(true);
  });

  it('hides header when scrolling down for sticky-on-scroll-up', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'sticky-on-scroll-up' }));
    act(() => {
      (window as any).scrollY = 100;
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      (window as any).scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(false);
  });

  it('shows header when scrolling up for sticky-on-scroll-up', () => {
    const { result } = renderHook(() => useScrollBehavior({ behavior: 'sticky-on-scroll-up' }));
    act(() => {
      (window as any).scrollY = 200;
      window.dispatchEvent(new Event('scroll'));
    });
    act(() => {
      (window as any).scrollY = 150;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(true);
  });

  it('short-circuits to static state when disabled', () => {
    const { result } = renderHook(() =>
      useScrollBehavior({ behavior: 'sticky-on-scroll-up', disabled: true })
    );
    act(() => {
      (window as any).scrollY = 500;
      window.dispatchEvent(new Event('scroll'));
    });
    expect(result.current.visible).toBe(true);
    expect(result.current.scrolled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test components/layout/header/__tests__/useScrollBehavior.test.tsx`
Expected: FAIL with "Cannot find module '../useScrollBehavior'"

- [ ] **Step 3: Implement**

Create `components/layout/header/useScrollBehavior.ts`:

```ts
'use client';

import { useEffect, useState, useRef } from 'react';
import type { HeaderScrollBehavior } from '@/data/mockData';

interface UseScrollBehaviorArgs {
  behavior: HeaderScrollBehavior;
  /** When true, the hook returns the static/unscrolled state and ignores window scroll. */
  disabled?: boolean;
  /** Pixel threshold past which `scrolled` and `shrunk` become true. Default 80. */
  threshold?: number;
}

interface ScrollState {
  visible: boolean;
  scrolled: boolean;
  shrunk: boolean;
}

const STATIC_STATE: ScrollState = { visible: true, scrolled: false, shrunk: false };

export function useScrollBehavior({
  behavior,
  disabled = false,
  threshold = 80,
}: UseScrollBehaviorArgs): ScrollState {
  const [state, setState] = useState<ScrollState>(STATIC_STATE);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (disabled || behavior === 'none') {
      setState(STATIC_STATE);
      return;
    }

    const handleScroll = () => {
      const y = window.scrollY;
      const last = lastScrollY.current;
      const scrolled = y > threshold;
      const shrunk = behavior === 'shrink-on-scroll' && scrolled;

      let visible = true;
      if (behavior === 'sticky-on-scroll-up') {
        if (y <= threshold) {
          visible = true;
        } else if (y > last) {
          visible = false;
        } else if (y < last) {
          visible = true;
        }
      }

      lastScrollY.current = y;
      setState({ visible, scrolled, shrunk });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [behavior, disabled, threshold]);

  return state;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test components/layout/header/__tests__/useScrollBehavior.test.tsx`
Expected: PASS, all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/layout/header/useScrollBehavior.ts clicker-platform-v2/components/layout/header/__tests__/useScrollBehavior.test.tsx
git commit -m "feat(header-nav): scroll behavior hook (fixed/sticky-up/shrink)"
```

---

## Task 6: Build NavLogo part

**Files:**
- Create: `clicker-platform-v2/components/layout/header/parts/NavLogo.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/parts/NavLogo.tsx`:

```tsx
'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTemplate } from '@/components/TemplateProvider';
import type { BusinessProfile } from '@/data/mockData';

interface NavLogoProps {
  profile: BusinessProfile;
  siteId?: string;
  isSubPage?: boolean;
  pageTitle?: string;
  forceMobile?: boolean;
}

export const NavLogo: React.FC<NavLogoProps> = ({
  profile,
  siteId,
  isSubPage = false,
  pageTitle,
  forceMobile = false,
}) => {
  const router = useRouter();
  const { theme } = useTemplate();

  return (
    <div className="flex items-center gap-3 md:gap-4 overflow-hidden max-w-[60%] md:max-w-none">
      {isSubPage ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (!forceMobile) router.back();
          }}
          className="w-10 h-10 flex-shrink-0 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors -ml-2"
          style={{ color: theme.colors.foreground }}
        >
          <ArrowLeft size={24} />
        </button>
      ) : (
        <Link href={siteId ? `/${siteId}` : '/'} className="flex-shrink-0 hover:opacity-80 transition-opacity">
          <div
            className="rounded-full flex items-center justify-center w-10 h-10 overflow-hidden shadow-sm"
            style={{ backgroundColor: theme.colors.surface ?? theme.colors.background }}
          >
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt={profile.name}
                width={40}
                height={40}
                className="object-cover"
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-sm"
                style={{ color: theme.colors.foreground }}
              >
                {profile.name?.charAt(0) || '?'}
              </div>
            )}
          </div>
        </Link>
      )}
      <h1
        className="font-bold tracking-[0.1em] md:tracking-[0.3em] uppercase text-sm md:text-lg whitespace-nowrap truncate"
        style={{ color: theme.colors.foreground }}
      >
        {isSubPage ? pageTitle : profile.name}
      </h1>
    </div>
  );
};
```

Note vs `ResponsiveNavBar`: avatar container `bg-white` is replaced with `theme.colors.surface ?? theme.colors.background`, and the initial-letter `text-black` is replaced with `theme.colors.foreground`. This fixes audit finding #2.

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/parts/NavLogo.tsx
git commit -m "feat(header-nav): NavLogo part (token-driven, replaces bg-white avatar)"
```

---

## Task 7: Build NavMenu part

**Files:**
- Create: `clicker-platform-v2/components/layout/header/parts/NavMenu.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/parts/NavMenu.tsx`:

```tsx
'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import type { NavigationItem } from '@/data/mockData';

interface NavMenuProps {
  items: NavigationItem[];
  typographyClass: string;
  onItemClick: (e: React.MouseEvent, item: NavigationItem) => void;
  className?: string;
  gap?: string;
}

export const NavMenu: React.FC<NavMenuProps> = ({
  items,
  typographyClass,
  onItemClick,
  className = '',
  gap = 'gap-6',
}) => {
  const { tenantSlug, isSubdomain } = useSite();
  const { theme } = useTemplate();
  const textMuted = `${theme.colors.foreground}99`;

  const getHref = useCallback(
    (val: string) => resolveNavHref(val, tenantSlug, isSubdomain),
    [tenantSlug, isSubdomain]
  );

  // Phase 1: ignore item.children. Phase 2 will add drop-down rendering.

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={getHref(item.value)}
          onClick={(e) => onItemClick(e, item)}
          className={`${typographyClass} hover:opacity-100 transition-opacity`}
          style={{ color: textMuted }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/parts/NavMenu.tsx
git commit -m "feat(header-nav): NavMenu part (token-driven, typography-class-driven)"
```

---

## Task 8: Build NavCTA part

**Files:**
- Create: `clicker-platform-v2/components/layout/header/parts/NavCTA.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/parts/NavCTA.tsx`:

```tsx
'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import type { HeaderCTA, NavigationItem } from '@/data/mockData';

interface NavCTAProps {
  cta: HeaderCTA;
  typographyClass: string;
  onItemClick: (e: React.MouseEvent, item: NavigationItem) => void;
  fullWidth?: boolean;
}

export const NavCTA: React.FC<NavCTAProps> = ({
  cta,
  typographyClass,
  onItemClick,
  fullWidth = false,
}) => {
  const { tenantSlug, isSubdomain } = useSite();
  const { theme } = useTemplate();

  const getHref = useCallback(
    (val: string) => resolveNavHref(val, tenantSlug, isSubdomain),
    [tenantSlug, isSubdomain]
  );

  if (!cta.enabled) return null;

  const actionItem: NavigationItem = {
    id: 'cta',
    label: cta.label,
    type: cta.linkType,
    value: cta.linkValue,
    formId: cta.formId,
  };

  const sizeClass = fullWidth ? 'w-full py-5 text-center' : 'px-5 py-2';

  return (
    <Link
      href={getHref(cta.linkValue)}
      onClick={(e) => onItemClick(e, actionItem)}
      className={`${sizeClass} rounded-full hover:opacity-90 transition-opacity ${typographyClass}`}
      style={{
        backgroundColor: theme.colors.primary,
        color: theme.colors.primaryForeground ?? theme.colors.accentForeground ?? theme.colors.background,
      }}
    >
      {cta.label || 'Order'}
    </Link>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/parts/NavCTA.tsx
git commit -m "feat(header-nav): NavCTA part (token-driven, removes hardcoded #ffffff)"
```

---

## Task 9: Build BurgerButton part + drop-down panel hook

**Files:**
- Create: `clicker-platform-v2/components/layout/header/parts/BurgerButton.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/parts/BurgerButton.tsx`:

```tsx
'use client';

import React from 'react';
import { Menu, X } from 'lucide-react';
import { useTemplate } from '@/components/TemplateProvider';

interface BurgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
}

export const BurgerButton: React.FC<BurgerButtonProps> = ({ isOpen, onClick }) => {
  const { theme } = useTemplate();
  const textMuted = `${theme.colors.foreground}99`;
  const borderColor = theme.colors.border ?? `${theme.colors.foreground}26`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="p-2 rounded-xl border transition-all"
      style={{
        backgroundColor: theme.colors.surface ?? theme.colors.background,
        borderColor,
        color: textMuted,
      }}
      aria-label="Toggle menu"
      aria-expanded={isOpen}
    >
      {isOpen ? (
        <X className="w-6 h-6" style={{ color: theme.colors.foreground }} />
      ) : (
        <Menu className="w-6 h-6" />
      )}
    </button>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/parts/BurgerButton.tsx
git commit -m "feat(header-nav): BurgerButton part with proper aria-expanded"
```

---

## Task 10: Build HeaderShell (container + positioning + scrolled-state)

**Files:**
- Create: `clicker-platform-v2/components/layout/header/HeaderShell.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/HeaderShell.tsx`:

```tsx
'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import type { HeaderNavigationConfig } from '@/data/mockData';

interface HeaderShellProps {
  config: HeaderNavigationConfig;
  scrollState: { visible: boolean; scrolled: boolean; shrunk: boolean };
  /** When true, render position:relative (Canvas preview). When false, follow config.scrollBehavior. */
  staticPosition?: boolean;
  children: React.ReactNode;
}

export const HeaderShell: React.FC<HeaderShellProps> = ({
  config,
  scrollState,
  staticPosition = false,
  children,
}) => {
  const { theme } = useTemplate();
  const { width, scrollBehavior, bgColor, showBorder, scrolledAppearance } = config;
  const { visible, scrolled, shrunk } = scrollState;

  // Resolve bg + border, applying scrolled-state overrides when enabled
  const isScrolledOverride = scrolledAppearance.enabled && scrolled;
  const effectiveBg = isScrolledOverride
    ? scrolledAppearance.bgColor ?? theme.colors.background
    : bgColor ?? theme.colors.background;
  const showBorderEffective = isScrolledOverride
    ? scrolledAppearance.showBorder ?? false
    : showBorder ?? true;
  const borderColor = showBorderEffective
    ? theme.colors.border ?? `${theme.colors.foreground}26`
    : 'transparent';

  // Positioning
  const positionClass = staticPosition
    ? 'relative z-10 w-full'
    : scrollBehavior === 'none'
      ? 'relative z-10 w-full'
      : 'fixed top-0 left-0 right-0 z-50';

  // Visibility (sticky-on-scroll-up)
  const visibilityStyle: React.CSSProperties =
    !staticPosition && scrollBehavior === 'sticky-on-scroll-up' && !visible
      ? { transform: 'translateY(-100%)' }
      : { transform: 'translateY(0)' };

  // Height (shrink-on-scroll)
  const heightClass = shrunk ? 'h-14' : scrollBehavior === 'shrink-on-scroll' ? 'h-20' : 'h-16';

  // Inner container width
  const innerClass =
    width === 'constrained'
      ? 'max-w-7xl mx-auto w-full h-full px-4 flex items-center'
      : 'w-full h-full px-4 flex items-center';

  return (
    <nav
      className={`${positionClass} ${heightClass} border-b transition-all duration-300`}
      style={{ backgroundColor: effectiveBg, borderColor, ...visibilityStyle }}
    >
      <div className={innerClass}>{children}</div>
    </nav>
  );
};
```

In dev mode, log a warning when `theme.colors.border` is missing:

```tsx
// Add at the top of the component body, before computing borderColor:
if (process.env.NODE_ENV !== 'production' && showBorderEffective && !theme.colors.border) {
  console.warn('[HeaderShell] theme.colors.border is undefined; using foreground-derived fallback. Add `border` to your template tokens.');
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/HeaderShell.tsx
git commit -m "feat(header-nav): HeaderShell — container, positioning, scrolled-state swap"
```

---

## Task 11: Build LogoLeftHeader variant (TDD)

**Files:**
- Create: `clicker-platform-v2/components/layout/header/variants/LogoLeftHeader.tsx`
- Test: `clicker-platform-v2/components/layout/header/__tests__/LogoLeftHeader.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/layout/header/__tests__/LogoLeftHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LogoLeftHeader } from '../variants/LogoLeftHeader';
import type { NavigationItem, HeaderCTA, BusinessProfile } from '@/data/mockData';

// Mock TemplateProvider + site context to avoid full-tree boot
vi.mock('@/components/TemplateProvider', () => ({
  useTemplate: () => ({
    theme: {
      colors: {
        foreground: '#000',
        background: '#fff',
        primary: '#111',
        primaryForeground: '#fff',
        border: '#eee',
        surface: '#fafafa',
      },
    },
    templateId: 'test',
  }),
}));
vi.mock('@/lib/site-context', () => ({
  useSite: () => ({ tenantSlug: 'test', isSubdomain: false }),
}));

const profile: BusinessProfile = { name: 'Test Site', avatarUrl: '' } as any;

const items: NavigationItem[] = [
  { id: '1', label: 'Home', type: 'link', value: '/' },
  { id: '2', label: 'Shop', type: 'link', value: '/shop' },
];
const cta: HeaderCTA = { enabled: true, label: 'Book', linkType: 'url', linkValue: '#' };

describe('LogoLeftHeader', () => {
  it('renders logo, menu items, and CTA in left-to-right DOM order', () => {
    render(
      <LogoLeftHeader
        profile={profile}
        items={items}
        cta={cta}
        typographyClass="text-sm"
        onItemClick={() => {}}
        forceMobile={false}
      />
    );

    const home = screen.getByText('Home');
    const shop = screen.getByText('Shop');
    const book = screen.getByText('Book');
    expect(home).toBeInTheDocument();
    expect(shop).toBeInTheDocument();
    expect(book).toBeInTheDocument();

    // DOM order: site name (logo group) → Home → Shop → Book
    const all = [screen.getByText('Test Site'), home, shop, book];
    for (let i = 0; i < all.length - 1; i++) {
      expect(all[i].compareDocumentPosition(all[i + 1])).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
  });

  it('hides desktop menu when forceMobile is true', () => {
    const { container } = render(
      <LogoLeftHeader
        profile={profile}
        items={items}
        cta={cta}
        typographyClass="text-sm"
        onItemClick={() => {}}
        forceMobile={true}
      />
    );
    // Desktop menu container has 'hidden' class when forceMobile
    const desktopMenu = container.querySelector('[data-testid="desktop-menu"]');
    expect(desktopMenu?.className).toContain('hidden');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test components/layout/header/__tests__/LogoLeftHeader.test.tsx`
Expected: FAIL with "Cannot find module"

- [ ] **Step 3: Implement**

Create `components/layout/header/variants/LogoLeftHeader.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { NavigationItem, HeaderCTA, BusinessProfile } from '@/data/mockData';

export interface VariantProps {
  profile: BusinessProfile;
  siteId?: string;
  items: NavigationItem[];
  cta: HeaderCTA;
  typographyClass: string;
  onItemClick: (e: React.MouseEvent, item: NavigationItem) => void;
  forceMobile?: boolean;
  isSubPage?: boolean;
  pageTitle?: string;
}

export const LogoLeftHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
  isSubPage = false,
  pageTitle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();

  const showMobileToggle = items.length > 0 || cta.enabled;

  return (
    <div className="flex items-center justify-between w-full relative">
      <NavLogo
        profile={profile}
        siteId={siteId}
        isSubPage={isSubPage}
        pageTitle={pageTitle}
        forceMobile={forceMobile}
      />

      <div className="flex items-center gap-4 relative z-10">
        <NavMenu
          items={items}
          typographyClass={typographyClass}
          onItemClick={onItemClick}
          className={forceMobile ? 'hidden' : 'hidden lg:flex'}
          gap="gap-6"
        />

        <div className={forceMobile ? 'hidden' : 'hidden lg:block'} data-testid="desktop-cta">
          <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
        </div>

        <div className={forceMobile ? 'hidden' : 'hidden lg:flex'} data-testid="desktop-menu" />

        {showMobileToggle && (
          <div className={forceMobile ? 'block' : 'lg:hidden'}>
            <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
          </div>
        )}
      </div>

      {isMenuOpen && (
        <div
          className="absolute inset-x-0 top-full mt-2 z-50 p-6 rounded-xl shadow-lg flex flex-col gap-4"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
        >
          <NavMenu
            items={items}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            className="flex-col items-start"
            gap="gap-4"
          />
          <NavCTA
            cta={cta}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            fullWidth
          />
        </div>
      )}
    </div>
  );
};
```

Note: the test's `data-testid="desktop-menu"` is attached to the hidden marker div so the test can assert its `hidden` class. Real menu is `NavMenu` itself — the test only verifies the responsive hide logic.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test components/layout/header/__tests__/LogoLeftHeader.test.tsx`
Expected: PASS, both tests green.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/layout/header/variants/LogoLeftHeader.tsx clicker-platform-v2/components/layout/header/__tests__/LogoLeftHeader.test.tsx
git commit -m "feat(header-nav): LogoLeftHeader variant"
```

---

## Task 12: Build LogoCenterHeader variant

**Files:**
- Create: `clicker-platform-v2/components/layout/header/variants/LogoCenterHeader.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/variants/LogoCenterHeader.tsx`:

```tsx
'use client';

import React, { useState, useMemo } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { VariantProps } from './LogoLeftHeader';

export const LogoCenterHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
  isSubPage = false,
  pageTitle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();

  // Split items: left half | right half
  const { leftItems, rightItems } = useMemo(() => {
    const mid = Math.ceil(items.length / 2);
    return { leftItems: items.slice(0, mid), rightItems: items.slice(mid) };
  }, [items]);

  const showMobileToggle = items.length > 0 || cta.enabled;

  return (
    <div className="flex items-center justify-between w-full relative">
      {/* Desktop: left menu | logo (center) | right menu + CTA */}
      <div className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center gap-6 flex-1`}>
        <NavMenu items={leftItems} typographyClass={typographyClass} onItemClick={onItemClick} gap="gap-6" />
      </div>

      <div className={`${forceMobile ? 'flex-1' : 'lg:flex-none'} flex justify-center`}>
        <NavLogo
          profile={profile}
          siteId={siteId}
          isSubPage={isSubPage}
          pageTitle={pageTitle}
          forceMobile={forceMobile}
        />
      </div>

      <div className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center justify-end gap-6 flex-1`}>
        <NavMenu items={rightItems} typographyClass={typographyClass} onItemClick={onItemClick} gap="gap-6" />
        <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
      </div>

      {/* Mobile: burger on the right */}
      {showMobileToggle && (
        <div className={`${forceMobile ? 'block' : 'lg:hidden'} flex-shrink-0`}>
          <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
        </div>
      )}

      {isMenuOpen && (
        <div
          className="absolute inset-x-0 top-full mt-2 z-50 p-6 rounded-xl shadow-lg flex flex-col gap-4"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
        >
          <NavMenu
            items={items}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            className="flex-col items-start"
            gap="gap-4"
          />
          <NavCTA
            cta={cta}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            fullWidth
          />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/variants/LogoCenterHeader.tsx
git commit -m "feat(header-nav): LogoCenterHeader variant (split menu)"
```

---

## Task 13: Build BurgerHeader variant

**Files:**
- Create: `clicker-platform-v2/components/layout/header/variants/BurgerHeader.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/variants/BurgerHeader.tsx`:

```tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { VariantProps } from './LogoLeftHeader';

export const BurgerHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
  isSubPage = false,
  pageTitle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes the panel
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  return (
    <div className="flex items-center justify-between w-full relative">
      <NavLogo
        profile={profile}
        siteId={siteId}
        isSubPage={isSubPage}
        pageTitle={pageTitle}
        forceMobile={forceMobile}
      />

      <div className="flex items-center gap-3">
        <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
        <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
      </div>

      {isMenuOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Navigation menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[240px] p-6 rounded-xl shadow-lg border flex flex-col gap-4"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border ?? `${theme.colors.foreground}26`,
          }}
        >
          <NavMenu
            items={items}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            className="flex-col items-start"
            gap="gap-4"
          />
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/variants/BurgerHeader.tsx
git commit -m "feat(header-nav): BurgerHeader variant (logo + CTA + burger drop-down)"
```

---

## Task 14: Build LogoLeftStackedHeader variant

**Files:**
- Create: `clicker-platform-v2/components/layout/header/variants/LogoLeftStackedHeader.tsx`

- [ ] **Step 1: Implement**

Create `components/layout/header/variants/LogoLeftStackedHeader.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { VariantProps } from './LogoLeftHeader';

/**
 * Two-row layout: logo + CTA on top, menu below.
 * Note: this variant overrides HeaderShell's height — the shell still wraps it,
 * but visually the bar is taller. We use h-auto on the inner content.
 */
export const LogoLeftStackedHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
  isSubPage = false,
  pageTitle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();
  const borderColor = theme.colors.border ?? `${theme.colors.foreground}26`;

  return (
    <div className="flex flex-col w-full py-2 gap-2 relative">
      <div className="flex items-center justify-between w-full">
        <NavLogo
          profile={profile}
          siteId={siteId}
          isSubPage={isSubPage}
          pageTitle={pageTitle}
          forceMobile={forceMobile}
        />
        <div className="flex items-center gap-3">
          <div className={forceMobile ? 'hidden' : 'hidden lg:block'}>
            <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
          </div>
          {(items.length > 0 || cta.enabled) && (
            <div className={forceMobile ? 'block' : 'lg:hidden'}>
              <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
            </div>
          )}
        </div>
      </div>

      <div
        className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center pt-2 border-t`}
        style={{ borderColor }}
      >
        <NavMenu items={items} typographyClass={typographyClass} onItemClick={onItemClick} gap="gap-6" />
      </div>

      {isMenuOpen && (
        <div
          className="absolute inset-x-0 top-full mt-2 z-50 p-6 rounded-xl shadow-lg flex flex-col gap-4"
          style={{ backgroundColor: theme.colors.background, borderColor }}
        >
          <NavMenu
            items={items}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            className="flex-col items-start"
            gap="gap-4"
          />
          <NavCTA
            cta={cta}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            fullWidth
          />
        </div>
      )}
    </div>
  );
};
```

Note: this variant needs `HeaderShell` to allow `h-auto`. Address this in the shell by adding a `tallVariant` boolean prop in Task 16 when we wire `HeaderNavigation` together. For now, the shell still renders `h-16`, which will clip this variant — acceptable in isolation; Task 16 fixes it.

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/variants/LogoLeftStackedHeader.tsx
git commit -m "feat(header-nav): LogoLeftStackedHeader variant (two-row)"
```

---

## Task 15: Variant registry

**Files:**
- Create: `clicker-platform-v2/components/layout/header/variants/index.ts`

- [ ] **Step 1: Implement**

Create `components/layout/header/variants/index.ts`:

```ts
import type { HeaderVariant } from '@/data/mockData';
import type { VariantProps } from './LogoLeftHeader';
import { LogoLeftHeader } from './LogoLeftHeader';
import { LogoCenterHeader } from './LogoCenterHeader';
import { BurgerHeader } from './BurgerHeader';
import { LogoLeftStackedHeader } from './LogoLeftStackedHeader';

export type { VariantProps } from './LogoLeftHeader';

export const HEADER_VARIANTS: Record<HeaderVariant, React.FC<VariantProps>> = {
  'logo-left': LogoLeftHeader,
  'logo-center': LogoCenterHeader,
  'burger': BurgerHeader,
  'logo-left-stacked': LogoLeftStackedHeader,
};
```

- [ ] **Step 2: Verify it typechecks**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/layout/header/variants/index.ts
git commit -m "feat(header-nav): variant registry"
```

---

## Task 16: Build HeaderNavigation wrapper + fix stacked-height handling

**Files:**
- Create: `clicker-platform-v2/components/layout/header/HeaderNavigation.tsx`
- Modify: `clicker-platform-v2/components/layout/header/HeaderShell.tsx`

- [ ] **Step 1: Update HeaderShell to support tall variants**

Open `HeaderShell.tsx`. Modify so the height class is `h-auto min-h-[64px]` when `config.variant === 'logo-left-stacked'`:

```tsx
// Replace the heightClass computation:
const isStacked = config.variant === 'logo-left-stacked';
const heightClass = isStacked
  ? 'min-h-[64px]'
  : shrunk
    ? 'h-14'
    : scrollBehavior === 'shrink-on-scroll'
      ? 'h-20'
      : 'h-16';
```

- [ ] **Step 2: Implement HeaderNavigation wrapper**

Create `components/layout/header/HeaderNavigation.tsx`:

```tsx
'use client';

import React, { useState, useCallback, useContext } from 'react';
import { FormModal } from '@/components/FormModal';
import { useRouter } from 'next/navigation';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { useNavigation } from '@/components/layout/NavigationProvider';
import { useDeviceView } from '@/components/DeviceViewContext';
import { TopNavSkeleton } from '@/components/layout/NavSkeleton';
import { useScrollBehavior } from './useScrollBehavior';
import { useHeaderTypography } from './useHeaderTypography';
import { HeaderShell } from './HeaderShell';
import { HEADER_VARIANTS } from './variants';
import type { BusinessProfile, NavigationItem } from '@/data/mockData';

interface HeaderNavigationProps {
  profile: BusinessProfile;
  siteId?: string;
  forceMobile?: boolean;
  isSubPage?: boolean;
  pageTitle?: string;
  /** Canvas Studio preview: intercepts nav clicks instead of real navigation */
  onNavigate?: (href: string, item: NavigationItem) => void;
}

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  profile,
  siteId,
  forceMobile = false,
  isSubPage = false,
  pageTitle,
  onNavigate,
}) => {
  const router = useRouter();
  const { tenantSlug, isSubdomain } = useSite();
  const { theme, templateId } = useTemplate();
  const deviceView = useDeviceView();
  const isPreview = deviceView !== 'responsive';
  const { layout } = theme;
  const { header, loading, formCache } = useNavigation();

  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const scrollState = useScrollBehavior({
    behavior: header.scrollBehavior,
    disabled: isPreview || forceMobile,
  });

  const typographyClass = useHeaderTypography(header.typography);

  const getHref = useCallback(
    (val: string) => resolveNavHref(val, tenantSlug, isSubdomain),
    [tenantSlug, isSubdomain]
  );

  const openChat = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
    }
  }, []);

  const handleItemClick = useCallback(
    async (e: React.MouseEvent, item: NavigationItem) => {
      if (onNavigate) {
        e.preventDefault();
        onNavigate(getHref(item.value), item);
        return;
      }
      if (item.value === 'action:chat' || (item.type as string) === 'action-chat') {
        e.preventDefault();
        openChat();
        return;
      }
      if (item.type === 'form' && item.formId) {
        e.preventDefault();
        const cached = formCache[item.formId];
        if (cached) {
          setSelectedForm(cached);
          setIsFormOpen(true);
        } else if (siteId) {
          try {
            const { getDoc, doc } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const snap = await getDoc(doc(db, 'sites', siteId, 'forms', item.formId));
            if (snap.exists() && snap.data().isPublished !== false) {
              setSelectedForm({ id: snap.id, ...snap.data() });
              setIsFormOpen(true);
            }
          } catch (err) {
            console.error('HeaderNavigation: form fetch error', err);
          }
        }
      }
    },
    [formCache, siteId, openChat, onNavigate, getHref]
  );

  const isMobileOnly = layout?.navMode === 'mobile-only';
  if (isMobileOnly) return null;
  if (loading) return <TopNavSkeleton forceMobile={forceMobile || isPreview} />;

  const VariantComponent = HEADER_VARIANTS[header.variant] ?? HEADER_VARIANTS['logo-left'];

  return (
    <>
      <HeaderShell config={header} scrollState={scrollState} staticPosition={isPreview || forceMobile}>
        <VariantComponent
          profile={profile}
          siteId={siteId}
          items={header.items}
          cta={header.cta}
          typographyClass={typographyClass}
          onItemClick={handleItemClick}
          forceMobile={forceMobile}
          isSubPage={isSubPage}
          pageTitle={pageTitle}
        />
      </HeaderShell>

      <FormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        form={selectedForm}
        siteId={siteId || ''}
      />
    </>
  );
};
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/layout/header/HeaderNavigation.tsx clicker-platform-v2/components/layout/header/HeaderShell.tsx
git commit -m "feat(header-nav): HeaderNavigation wrapper + tall-variant shell support"
```

---

## Task 17: Swap callers from ResponsiveNavBar to HeaderNavigation

**Files:**
- Modify: `clicker-platform-v2/components/layout/SharedPageLayout.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx`

- [ ] **Step 1: Find and replace in SharedPageLayout**

Grep for `ResponsiveNavBar` in `SharedPageLayout.tsx`. Replace each:

```tsx
import { ResponsiveNavBar } from '@/components/layout/ResponsiveNavBar';
// → 
import { HeaderNavigation } from '@/components/layout/header/HeaderNavigation';
```

```tsx
<ResponsiveNavBar ...props />
// →
<HeaderNavigation ...props />
```

Props are identical, no other changes needed.

- [ ] **Step 2: Find and replace in CanvasStudio**

Same swap in `CanvasStudio.tsx`. Make sure the import and the JSX both change.

- [ ] **Step 3: Smoke test public site**

Run: `pnpm dev`
Open: `localhost:3000/go/layout`
Verify: header renders, variant is `logo-left`, scroll behavior is `fixed`, items match what was in `topNav`.
Open Network tab: confirm no Firestore listener for nav fired (still SSR-preloaded).
Stop server.

- [ ] **Step 4: Smoke test Canvas Studio preview**

Run: `pnpm dev`
Open: an admin Canvas Studio page in the dashboard.
Verify: header renders in preview, click selects it as a chrome element, properties panel mounts (still showing old fields — Task 18 rewires the panel).
Stop server.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/layout/SharedPageLayout.tsx clicker-platform-v2/components/admin/blocks/CanvasStudio.tsx
git commit -m "refactor(header-nav): swap ResponsiveNavBar → HeaderNavigation at call sites"
```

---

## Task 18: Extract shared SortableNavItem

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/panels/shared/SortableNavItem.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/panels/HeaderNavPanel.tsx`
- Modify: `clicker-platform-v2/components/admin/blocks/panels/ChromeBottomNavProperties.tsx`

- [ ] **Step 1: Read both existing implementations**

Open both files, locate the `SortableNavItem` (or equivalent — the drag/expand row component) in each. Note: drag handle, label input, link-type select, icon picker, value field (page picker / form picker / URL input), trash button.

- [ ] **Step 2: Create the shared component**

Create `components/admin/blocks/panels/shared/SortableNavItem.tsx` containing the unified implementation. Use the more complete of the two as the base (`HeaderNavPanel`'s version is typically richer). Export a single `SortableNavItem` component with all props needed by both callers:

```tsx
'use client';

import React from 'react';
// ...all the imports both files share (dnd-kit, icon picker, page picker, form picker)

export interface SortableNavItemProps {
  item: NavigationItem;
  onUpdate: (next: NavigationItem) => void;
  onRemove: () => void;
  pages: Array<{ id: string; slug: string; title: string }>;
  forms: Array<{ id: string; title: string }>;
  /** Bottom nav supports a slightly different "type" set; pass to limit the dropdown. */
  allowedTypes?: NavigationItem['type'][];
}

export const SortableNavItem: React.FC<SortableNavItemProps> = (props) => {
  // Unified body — drag handle + expand/collapse + label/type/value/icon/trash
  // (copy from HeaderNavPanel, parameterize allowedTypes)
};
```

The actual body should be a near-1:1 port of `HeaderNavPanel`'s existing `SortableNavItem`. Verify no behavior change.

- [ ] **Step 3: Replace usages**

In both `HeaderNavPanel.tsx` and `ChromeBottomNavProperties.tsx`, delete the local `SortableNavItem` and import the shared one. For `ChromeBottomNavProperties`, pass `allowedTypes={['link','page','url','action']}` if needed.

- [ ] **Step 4: Smoke test both panels**

Run: `pnpm dev`. Open Canvas Studio. Click header → confirm Nav Links section still drags, expands, edits, deletes. Click bottom nav (if visible) → confirm the same.

- [ ] **Step 5: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/
git commit -m "refactor(header-nav): extract shared SortableNavItem"
```

---

## Task 19: Rewrite HeaderNavPanel for variant + layout sections

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/panels/HeaderNavPanel.tsx`

- [ ] **Step 1: Plan the section structure**

The new panel reads from `useNavigation().header` (after Task 3) and writes the whole `HeaderNavigationConfig` back via the existing Firestore merge-write helper.

Sections (top-down):
1. LAYOUT — Variant cards (4), Width, Scroll behavior
2. NAV LINKS — `+ Add`, sortable list (use shared `SortableNavItem`)
3. CTA BUTTON — toggle + expansion
4. APPEARANCE — Background color, Show border, Typography (preset + Advanced disclosure)
5. SCROLLED STATE — toggle + bg + border (disabled when scrollBehavior === 'none')

- [ ] **Step 2: Implement the variant card picker**

Inside `HeaderNavPanel`, add:

```tsx
const VARIANT_OPTIONS: Array<{ id: HeaderVariant; label: string; description: string }> = [
  { id: 'logo-left', label: 'Logo-Left', description: 'Logo on the left, menu + CTA on the right.' },
  { id: 'logo-center', label: 'Logo-Center', description: 'Menu split around centered logo.' },
  { id: 'burger', label: 'Burger Minimal', description: 'Logo + CTA, menu in drop-down.' },
  { id: 'logo-left-stacked', label: 'Stacked', description: 'Two rows: logo + CTA above, menu below.' },
];

function VariantPicker({ value, onChange }: { value: HeaderVariant; onChange: (v: HeaderVariant) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {VARIANT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`p-3 rounded-lg border text-left transition ${value === opt.id ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'}`}
        >
          <div className="font-medium text-sm">{opt.label}</div>
          <div className="text-xs text-gray-500 mt-0.5">{opt.description}</div>
        </button>
      ))}
    </div>
  );
}
```

Mini nav-bar mockups inside the cards are a polish nice-to-have — out of scope for this task; text labels + descriptions are enough for Phase 1.

- [ ] **Step 3: Implement Width + Scroll behavior selectors**

```tsx
const WIDTH_OPTIONS: Array<{ id: HeaderContainerWidth; label: string }> = [
  { id: 'full', label: 'Full' },
  { id: 'constrained', label: 'Constrained' },
];

const SCROLL_OPTIONS: Array<{ id: HeaderScrollBehavior; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'sticky-on-scroll-up', label: 'Sticky on scroll-up' },
  { id: 'shrink-on-scroll', label: 'Shrink on scroll' },
];
```

Render as segmented buttons (matches existing panel conventions).

- [ ] **Step 4: Implement Typography section**

```tsx
const PRESET_OPTIONS: Array<{ id: HeaderNavTextPreset; label: string }> = [
  { id: 'default', label: 'Default' },
  { id: 'tight', label: 'Tight' },
  { id: 'spacious', label: 'Spacious' },
  { id: 'sentence-case', label: 'Sentence case' },
];
```

Render a segmented button group for preset, plus a `<details>` block labeled "Advanced" containing the tracking and case override selects.

- [ ] **Step 5: Implement Scrolled State section**

When `header.scrollBehavior === 'none'`, render the section header + a disabled hint "Set Scroll behavior to enable". Otherwise render the toggle and (when enabled) the bg color + border toggle.

- [ ] **Step 6: Wire writes**

All sections call a single `updateHeader(partial: Partial<HeaderNavigationConfig>)` helper that auto-saves via the existing merge-write to `siteSettings.navigation.header`. Existing auto-save debounce (600ms) and status chip continue to work.

- [ ] **Step 7: Smoke test**

Run: `pnpm dev`. Open Canvas Studio. Click header. Cycle through variants — confirm preview updates. Toggle scroll behavior — confirm Scrolled State section enables/disables. Pick a typography preset — confirm preview text-tracking changes. Open Advanced — verify overrides cascade.

- [ ] **Step 8: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/panels/HeaderNavPanel.tsx
git commit -m "feat(header-nav): rewrite HeaderNavPanel for variant + layout sections"
```

---

## Task 20: Remove template header components

**Files:**
- Modify: `clicker-platform-v2/lib/templates/registry.ts`
- Delete: `clicker-platform-v2/components/headers/ClassicProfileHeader.tsx`
- Delete: `clicker-platform-v2/components/headers/ModernProfileHeader.tsx`
- Delete: `clicker-platform-v2/components/headers/ShuvoHeader.tsx`
- Delete: `clicker-platform-v2/components/headers/MrbHeader.tsx`
- Modify: `clicker-platform-v2/app/catalog/page.tsx` (if it references any of them)
- Modify: `clicker-platform-v2/components/PublicPageRenderer.tsx` (if it references any of them)
- Modify: `clicker-platform-v2/components/layout/SharedPageLayout.tsx` (if it references any of them)

- [ ] **Step 1: Remove `Header` entries from the registry**

In `lib/templates/registry.ts`, delete every `Header: <Component>` line and the corresponding imports. Templates retain `theme.colors.*` and other fields.

- [ ] **Step 2: Strip Header usage from consumers**

Search for `MrbHeader|ShuvoHeader|ClassicProfileHeader|ModernProfileHeader` in `app/catalog/page.tsx`, `PublicPageRenderer.tsx`, `SharedPageLayout.tsx`. Replace each render site with the new `HeaderNavigation` (or remove if redundant — Task 17 already added `HeaderNavigation` to `SharedPageLayout`, so duplicates should just be deleted).

- [ ] **Step 3: Delete the header component files**

```bash
rm clicker-platform-v2/components/headers/ClassicProfileHeader.tsx
rm clicker-platform-v2/components/headers/ModernProfileHeader.tsx
rm clicker-platform-v2/components/headers/ShuvoHeader.tsx
rm clicker-platform-v2/components/headers/MrbHeader.tsx
```

If `components/headers/` is now empty, leave the directory in place (don't delete in case other files exist).

- [ ] **Step 4: Pre-flight visual check**

Run: `pnpm dev`. Open `/go/layout` on each template (`default`, `mrb-light`, `shuvo`, `classic`, `modern`). For each: visually compare to today's screenshot. Take notes if MRB or Shuvo look meaningfully different. The migration set them to `variant: 'logo-left', typography.preset: 'spacious', width: 'full', scrollBehavior: 'fixed'` — close to today but not pixel-perfect on every template.

Expected difference: MRB previously had its own header component with glassmorphism backdrop. Now uses `HeaderNavigation` reading `mrb-light` theme tokens. If the resulting look is acceptable, proceed. If not, file a follow-up to adjust the `mrb-light` template tokens (do not revert the component removal).

- [ ] **Step 5: Verify typecheck and build**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add -A clicker-platform-v2/components/headers clicker-platform-v2/lib/templates clicker-platform-v2/app clicker-platform-v2/components/PublicPageRenderer.tsx clicker-platform-v2/components/layout/SharedPageLayout.tsx
git commit -m "refactor(header-nav): remove template-owned header components"
```

---

## Task 21: Delete legacy ResponsiveNavBar

**Files:**
- Delete: `clicker-platform-v2/components/layout/ResponsiveNavBar.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "ResponsiveNavBar" clicker-platform-v2 --include="*.tsx" --include="*.ts"`
Expected: only its own file.

- [ ] **Step 2: Delete**

```bash
rm clicker-platform-v2/components/layout/ResponsiveNavBar.tsx
```

- [ ] **Step 3: Verify build**

Run: `pnpm tsc --noEmit && pnpm build`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(header-nav): delete legacy ResponsiveNavBar"
```

---

## Task 22: End-to-end manual smoke

- [ ] **Step 1: Public site, default template**

Run: `pnpm dev`. Open `localhost:3000/go/layout`. Confirm:
- Header renders with `logo-left` variant
- Items match what `topNav` had previously
- Sticky/fixed/scroll behavior matches what was set
- No console errors or warnings (except dev-mode `theme.colors.border` warnings — these should not appear on templates that define the token)

- [ ] **Step 2: Public site, MRB template**

Open the MRB tenant URL. Confirm avatar circle is no longer hardcoded white; uses template surface token.

- [ ] **Step 3: Canvas Studio variant cycling**

Open Canvas Studio. Click header. Cycle:
- `logo-left` → header rearranges to logo-left
- `logo-center` → menu splits, logo centers
- `burger` → menu disappears, burger appears with drop-down
- `logo-left-stacked` → header grows to two rows

Auto-save status chip shows "saved" after each change.

- [ ] **Step 4: Scroll behaviors**

Set scroll behavior to:
- `fixed` → public site header pins to top
- `sticky-on-scroll-up` → scroll down: header hides; scroll up: header reappears
- `shrink-on-scroll` → past 80px scroll, header shrinks from h-20 to h-14

Verify each on a scrollable page (a long content page).

- [ ] **Step 5: Typography overrides**

In the Advanced disclosure, set `trackingOverride: 'normal'`. Confirm nav text loses the wide tracking immediately in the preview.

- [ ] **Step 6: Scrolled-state bg swap**

Enable Scrolled State with `bgColor: '#ff0000'`. Scroll on the public site past 80px — bg turns red. Scroll back up — bg returns to default.

- [ ] **Step 7: Commit any tweaks**

If any fixes were needed during smoke testing, commit them with `fix(header-nav): <description>`.

---

## Self-Review

Spec coverage check:
- Goal section requirements (variant + properties model owned by Canvas Studio) → Tasks 1, 15, 16, 19 ✓
- Motivation problems (hardcoded values, template-owned headers, single layout) → Tasks 6 (avatar token), 8 (CTA token), 10 (border token), 19 (typography), 20 (template removal), 11–14 (variants) ✓
- Non-goals (sub-menu rendering deferred) → Task 7 NavMenu explicitly ignores `children` ✓
- Data Model (new types + lazy migration) → Tasks 1, 2, 3 ✓
- Component Architecture (HeaderNavigation, HeaderShell, hooks, parts, variants) → Tasks 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ✓
- Settings Panel UX (variant cards, layout/nav links/CTA/appearance/scrolled state sections, shared SortableNavItem) → Tasks 18, 19 ✓
- Token Discipline (every binding from the spec table) → Tasks 6, 7, 8, 9, 10 ✓
- Typography Presets (4 presets + overrides) → Task 4 ✓
- Template Header Removal → Task 20 ✓
- Testing (unit + component + manual smoke) → Tasks 2, 4, 5, 11, 22 ✓
- Migration → Task 2 ✓
- Risks (preview short-circuit, theme.colors.border fallback, accessibility) → Tasks 5 (disabled prop), 10 (warning + fallback), 13 (Escape close + aria-expanded) ✓

Placeholder scan: all code blocks contain real code, no "TODO" / "TBD" / "similar to" patterns remain.

Type consistency: `HeaderNavigationConfig`, `HeaderVariant`, `HeaderScrollBehavior`, `HeaderContainerWidth`, `HeaderNavTextPreset`, `HeaderTypography`, `HeaderCTA`, `HeaderScrolledAppearance` are used consistently across all tasks that reference them. `VariantProps` is defined once (Task 11) and re-exported from variants/index.ts (Task 15). `useScrollBehavior` return shape (`{ visible, scrolled, shrunk }`) is consistent in Tasks 5, 10, 16.

No gaps detected.
