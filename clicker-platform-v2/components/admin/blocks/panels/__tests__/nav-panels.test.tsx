/**
 * Regression tests for the production data-loss bug in HeaderNavPanel and
 * ChromeBottomNavProperties where the auto-save effect could fire with
 * empty default state and wipe nav links / CTA / FAB from Firestore.
 *
 * Bugs covered:
 *   1. Auto-save firing before Firestore hydration completes
 *   2. Auto-save firing for the wrong site after siteId change
 *   3. Cross-panel clobber (HeaderNav writing back stale bottomNav, etc.)
 *   4. Lost edits when panel unmounts during the debounce window
 *   5. No-op writes after hydration (idempotent re-write of just-loaded data)
 */

import React from 'react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import * as firestore from 'firebase/firestore';

// ─── Module mocks ─────────────────────────────────────────────────────────────

let currentSiteId = 'site-A';

vi.mock('@/lib/firebase', () => ({ db: {} }));

vi.mock('@/lib/site-context', () => ({
    useSite: () => ({ siteId: currentSiteId }),
}));

vi.mock('@/components/admin/IconSelector', () => ({
    InlinePanelIconPicker: ({ onBack }: any) => (
        <button data-testid="icon-picker-back" onClick={onBack}>back</button>
    ),
}));

vi.mock('@/data/icons', () => ({
    ICON_MAP: { Link: () => null, PlusCircle: () => null, Coffee: () => null },
}));

// dnd-kit pulls in ResizeObserver / DOMRect — replace with passthroughs.
vi.mock('@dnd-kit/core', () => ({
    DndContext: ({ children }: any) => <>{children}</>,
    closestCenter: vi.fn(),
    KeyboardSensor: vi.fn(),
    PointerSensor: vi.fn(),
    useSensor: vi.fn(),
    useSensors: () => [],
}));
vi.mock('@dnd-kit/sortable', () => ({
    SortableContext: ({ children }: any) => <>{children}</>,
    arrayMove: <T,>(arr: T[], from: number, to: number) => {
        const next = arr.slice();
        next.splice(to, 0, next.splice(from, 1)[0]);
        return next;
    },
    sortableKeyboardCoordinates: vi.fn(),
    verticalListSortingStrategy: vi.fn(),
    useSortable: () => ({
        attributes: {}, listeners: {}, setNodeRef: vi.fn(),
        transform: null, transition: null,
    }),
}));
vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => '' } } }));

// ─── Now import the components under test ─────────────────────────────────────

import { HeaderNavPanel } from '../HeaderNavPanel';
import { ChromeBottomNavProperties } from '../ChromeBottomNavProperties';

// ─── Firestore mock helpers ───────────────────────────────────────────────────

type SettingsBySite = Record<string, any>;
let storedSettings: SettingsBySite;
let setDocCalls: Array<{ path: string; siteId: string; data: any; options: any }>;

function mockDoc(siteId: string) {
    return { __siteId: siteId, __path: `sites/${siteId}/content/siteSettings` };
}

beforeEach(() => {
    currentSiteId = 'site-A';
    storedSettings = {};
    setDocCalls = [];
    vi.useFakeTimers();
    vi.clearAllMocks();

    (firestore.doc as any).mockImplementation((...args: any[]) => {
        const [, , siteId, segment, name] = args;
        if (segment === 'content' && name === 'siteSettings') {
            return mockDoc(siteId);
        }
        return { __other: true };
    });

    (firestore.collection as any).mockImplementation((...args: any[]) => {
        const [, , siteId, name] = args;
        return { __collection: name, __siteId: siteId };
    });

    (firestore.getDocs as any).mockImplementation(async () => ({ docs: [] }));

    (firestore.getDoc as any).mockImplementation(async (ref: any) => {
        const data = storedSettings[ref.__siteId];
        return data === undefined
            ? { exists: () => false, data: () => undefined }
            : { exists: () => true, data: () => data };
    });

    (firestore.setDoc as any).mockImplementation(async (ref: any, data: any, options: any) => {
        setDocCalls.push({ path: ref.__path || 'unknown', siteId: ref.__siteId, data, options });
        if (options?.merge) {
            const existing = storedSettings[ref.__siteId] || {};
            storedSettings[ref.__siteId] = deepMerge(existing, data);
        } else {
            storedSettings[ref.__siteId] = data;
        }
    });
});

afterEach(() => {
    vi.useRealTimers();
});

function deepMerge(a: any, b: any): any {
    if (Array.isArray(b)) return b;
    if (b && typeof b === 'object') {
        const out = { ...(a || {}) };
        for (const k of Object.keys(b)) out[k] = deepMerge(a?.[k], b[k]);
        return out;
    }
    return b;
}

function navWritesFor(siteId: string) {
    return setDocCalls.filter(c => c.siteId === siteId);
}

/**
 * Drain pending microtasks (resolved promises queued by async fetchers) under
 * fake timers. Without this, `await getDoc(...)` continuations never run.
 */
async function flushMicrotasks(times = 5) {
    for (let i = 0; i < times; i++) {
        await act(async () => { await Promise.resolve(); });
    }
}

async function flushDebounce() {
    await act(async () => { vi.advanceTimersByTime(700); });
    await flushMicrotasks();
}

async function hydrate() {
    await flushMicrotasks();
}

// ─── HeaderNavPanel tests ─────────────────────────────────────────────────────

describe('HeaderNavPanel — data-loss regression', () => {

    it('does not write to Firestore before hydration completes', async () => {
        // Make the read hang so hydration never resolves.
        let resolveGetDoc: (v: any) => void;
        (firestore.getDoc as any).mockImplementation(
            () => new Promise(r => { resolveGetDoc = r; })
        );

        render(<HeaderNavPanel />);

        // Advance well past the 600ms debounce window.
        await act(async () => { vi.advanceTimersByTime(5000); });
        await flushMicrotasks();

        expect(setDocCalls.length).toBe(0);

        resolveGetDoc!({ exists: () => false, data: () => undefined });
    });

    it('does not auto-save the just-loaded value (no idempotent re-write)', async () => {
        storedSettings['site-A'] = {
            navigation: {
                topNav: [{ id: '1', label: 'Home', type: 'page', value: '/' }],
                topNavActions: { cta: { enabled: true, label: 'Order Now' } },
                headerStyle: {},
            },
        };

        render(<HeaderNavPanel />);

        await hydrate();
        await flushDebounce();

        expect(navWritesFor('site-A').length).toBe(0);
        // Existing data is intact.
        expect(storedSettings['site-A'].navigation.topNav).toHaveLength(1);
        expect(storedSettings['site-A'].navigation.topNavActions.cta.enabled).toBe(true);
    });

    it('saves only the keys this panel owns (does not overwrite bottomNav / fab)', async () => {
        storedSettings['site-A'] = {
            navigation: {
                topNav: [{ id: 'a', label: 'About', type: 'page', value: '/about' }],
                topNavActions: {},
                headerStyle: {},
                bottomNav: [{ id: 'b', label: 'Cart', type: 'page', value: '/cart' }],
                fab: { id: 'fab', enabled: true, type: 'url', value: '#', icon: 'PlusCircle' },
            },
        };

        render(<HeaderNavPanel />);
        await hydrate();

        // The "Add" button in Nav Links section.
        const addBtn = screen.getByRole('button', { name: /add/i });
        fireEvent.click(addBtn);

        await flushDebounce();

        const writes = navWritesFor('site-A');
        expect(writes.length).toBeGreaterThan(0);

        const lastWrite = writes[writes.length - 1];
        // The write payload must NOT contain bottomNav / fab.
        expect(lastWrite.data.navigation).toBeDefined();
        expect(lastWrite.data.navigation.bottomNav).toBeUndefined();
        expect(lastWrite.data.navigation.fab).toBeUndefined();
        expect(lastWrite.options).toEqual({ merge: true });

        // After applying the recursive merge, bottomNav and fab survive.
        expect(storedSettings['site-A'].navigation.bottomNav).toHaveLength(1);
        expect(storedSettings['site-A'].navigation.fab.enabled).toBe(true);
        expect(storedSettings['site-A'].navigation.fab.icon).toBe('PlusCircle');
        // And the new top-nav entry is appended.
        expect(storedSettings['site-A'].navigation.topNav.length).toBe(2);
    });

    it('does not save to a site after siteId changes (no cross-site bleed)', async () => {
        storedSettings['site-A'] = {
            navigation: { topNav: [{ id: 'a', label: 'Home', type: 'page', value: '/' }], topNavActions: {}, headerStyle: {} },
        };
        storedSettings['site-B'] = {
            navigation: { topNav: [{ id: 'b', label: 'Shop', type: 'page', value: '/shop' }], topNavActions: {}, headerStyle: {} },
        };

        const { rerender } = render(<HeaderNavPanel />);
        await hydrate();

        // Switch site mid-session.
        currentSiteId = 'site-B';
        rerender(<HeaderNavPanel />);
        await hydrate();

        await flushDebounce();

        // Neither site should have been auto-saved (user has not edited).
        expect(navWritesFor('site-A').length).toBe(0);
        expect(navWritesFor('site-B').length).toBe(0);

        expect(storedSettings['site-A'].navigation.topNav[0].label).toBe('Home');
        expect(storedSettings['site-B'].navigation.topNav[0].label).toBe('Shop');
    });

    it('flushes a pending save when the panel unmounts mid-debounce', async () => {
        storedSettings['site-A'] = {
            navigation: { topNav: [], topNavActions: {}, headerStyle: {} },
        };

        const { unmount } = render(<HeaderNavPanel />);
        await hydrate();

        // Trigger an edit.
        const addBtn = screen.getByRole('button', { name: /add/i });
        fireEvent.click(addBtn);

        // Unmount BEFORE the 600ms debounce fires.
        await act(async () => { vi.advanceTimersByTime(100); });
        unmount();
        await flushMicrotasks();

        const writes = navWritesFor('site-A');
        expect(writes.length).toBeGreaterThan(0);
        expect(writes[writes.length - 1].data.navigation.topNav.length).toBe(1);
    });

    it('handles a missing siteSettings document by writing only after edit', async () => {
        // No stored data → snap.exists() returns false on read.
        render(<HeaderNavPanel />);

        await hydrate();
        await flushDebounce();

        // No edit → no save.
        expect(setDocCalls.length).toBe(0);

        // Now edit.
        const addBtn = screen.getByRole('button', { name: /add/i });
        fireEvent.click(addBtn);
        await flushDebounce();

        const writes = navWritesFor('site-A');
        expect(writes.length).toBe(1);
        expect(writes[0].data.navigation.topNav.length).toBe(1);
    });
});

// ─── ChromeBottomNavProperties tests ──────────────────────────────────────────

describe('ChromeBottomNavProperties — data-loss regression', () => {

    it('does not write before hydration', async () => {
        let resolveGetDoc: (v: any) => void;
        (firestore.getDoc as any).mockImplementation(
            () => new Promise(r => { resolveGetDoc = r; })
        );

        render(<ChromeBottomNavProperties />);
        await act(async () => { vi.advanceTimersByTime(5000); });
        await flushMicrotasks();
        expect(setDocCalls.length).toBe(0);
        resolveGetDoc!({ exists: () => false, data: () => undefined });
    });

    it('does not auto-save the just-loaded value', async () => {
        storedSettings['site-A'] = {
            navigation: {
                bottomNav: [{ id: 'b', label: 'Cart', type: 'page', value: '/cart' }],
                fab: { id: 'fab', enabled: true, type: 'url', value: '#', icon: 'PlusCircle' },
                bottomNavStyle: {},
            },
        };

        render(<ChromeBottomNavProperties />);
        await hydrate();
        await flushDebounce();

        expect(navWritesFor('site-A').length).toBe(0);
        expect(storedSettings['site-A'].navigation.bottomNav).toHaveLength(1);
        expect(storedSettings['site-A'].navigation.fab.enabled).toBe(true);
    });

    it('saves only bottomNav / fab / bottomNavStyle (does not overwrite topNav)', async () => {
        storedSettings['site-A'] = {
            navigation: {
                topNav: [{ id: 'a', label: 'About', type: 'page', value: '/about' }],
                topNavActions: { cta: { enabled: true } },
                headerStyle: { bgColor: '#ffffff' },
                bottomNav: [],
                bottomNavStyle: {},
            },
        };

        render(<ChromeBottomNavProperties />);
        await hydrate();

        const addBtn = screen.getByRole('button', { name: /add/i });
        fireEvent.click(addBtn);
        await flushDebounce();

        const writes = navWritesFor('site-A');
        expect(writes.length).toBeGreaterThan(0);
        const lastWrite = writes[writes.length - 1].data;

        expect(lastWrite.navigation.topNav).toBeUndefined();
        expect(lastWrite.navigation.topNavActions).toBeUndefined();
        expect(lastWrite.navigation.headerStyle).toBeUndefined();

        // After merge: topNav, CTA, headerStyle still intact.
        expect(storedSettings['site-A'].navigation.topNav).toHaveLength(1);
        expect(storedSettings['site-A'].navigation.topNavActions.cta.enabled).toBe(true);
        expect(storedSettings['site-A'].navigation.headerStyle.bgColor).toBe('#ffffff');
        // BottomNav was added.
        expect(storedSettings['site-A'].navigation.bottomNav.length).toBe(1);
    });

    it('preserves FAB config when toggling enabled off then on', async () => {
        storedSettings['site-A'] = {
            navigation: {
                bottomNav: [],
                fab: { id: 'fab', enabled: true, type: 'page', pageId: 'p1', value: '/menu', icon: 'Coffee' },
                bottomNavStyle: {},
            },
        };

        render(<ChromeBottomNavProperties />);
        await hydrate();

        // Find the FAB toggle: it is the only checked checkbox initially
        // ("Show Border Top" defaults to off; FAB enabled is true).
        const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
        const fabToggle = checkboxes.find(c => c.checked);
        expect(fabToggle).toBeDefined();

        // Toggle off
        fireEvent.click(fabToggle!);
        await flushDebounce();

        // Toggle on
        fireEvent.click(fabToggle!);
        await flushDebounce();

        const fab = storedSettings['site-A'].navigation.fab;
        expect(fab.enabled).toBe(true);
        // Crucially, the existing FAB config (pageId, value, icon) was NOT wiped
        // by the disable→enable cycle. The toggle handler must not reset to defaults.
        expect(fab.pageId).toBe('p1');
        expect(fab.value).toBe('/menu');
        expect(fab.icon).toBe('Coffee');
    });
});
