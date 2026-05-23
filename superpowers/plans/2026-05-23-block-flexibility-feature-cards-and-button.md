# Block Flexibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FeatureCards render single-card full-width, and let Button block optionally show a primary + secondary CTA pair.

**Architecture:** Two independent, file-local changes. Finding 1 is a render-branch in `DefaultFeatureCardsBlock.tsx`. Finding 2 extracts the trigger-rendering into a helper, refactors form-state to key-by-button, adds an optional `secondary` field, and adds a collapsible form section. No schema changes, no migrations, no new block types.

**Tech Stack:** Next.js 15, React, Tailwind v4 (native container queries), TypeScript, Vitest (not used for these blocks — manual canvas smoke tests).

**Spec:** [superpowers/specs/2026-05-23-block-flexibility-feature-cards-and-button.md](../specs/2026-05-23-block-flexibility-feature-cards-and-button.md)

---

## Task 1: FeatureCards — single-card full-width

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx`

### Step 1: Read current file to confirm structure

- [ ] Open `clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx` and review lines 127–139 (containerClass) and 159–164 (cardWrapperBase). The change is a branch on `cards.length === 1`.

### Step 2: Add `isSingle` branch for container and wrapper classes

- [ ] In the `DefaultFeatureCardsBlock` component body, after `const cards = data.cards || [];` (around line 129), add:

```tsx
const isSingle = cards.length === 1;
```

- [ ] Replace the existing `containerClass` block (lines 135–139) with:

```tsx
const containerClass = isSingle
    ? 'flex justify-center px-4 md:px-4 md:max-w-6xl md:mx-auto'
    : dv(
        deviceView,
        `flex items-stretch gap-3 overflow-x-auto overflow-y-visible px-4 pb-2 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${adminTopPad}`,
        `md:grid ${desktopCols} md:gap-4 md:items-stretch md:px-4 md:max-w-6xl md:mx-auto md:overflow-visible md:pb-0`
    );
```

- [ ] Inside the `cards.map(...)` callback (currently lines 159–164), replace the `cardWrapperBase` definition with:

```tsx
const cardWrapperBase = isSingle
    ? 'w-full flex flex-col'
    : dv(
        deviceView,
        'snap-start shrink-0 w-[72vw] max-w-[280px] flex flex-col',
        'md:w-auto md:max-w-none flex flex-col'
    );
```

### Step 3: Manual verification in Canvas Studio

- [ ] Run `cd clicker-platform-v2 && pnpm dev`
- [ ] In Canvas Studio, drop a Feature Cards block. Delete cards until only 1 remains. Confirm the card stretches to fill the row (capped by `max-w-6xl`).
- [ ] Add a second card. Confirm the layout reverts to the existing grid (`md:grid-cols-3` by default).
- [ ] Switch device preview to mobile. Single card should fill the viewport with `px-4` padding. Multi-card should still horizontal-scroll.
- [ ] Switch `columns` to 2 and 4. Multi-card layout should respect the setting; single-card layout should ignore it and remain full-width.

### Step 4: Commit

- [ ] Run:

```bash
git add clicker-platform-v2/components/blocks/public/DefaultFeatureCardsBlock.tsx
git commit -m "feat(blocks): feature-cards single-card renders full-width"
```

---

## Task 2: Button — extract `renderTrigger` helper (no behavior change)

This task is a pure refactor that prepares the file for the dual-CTA change. It must leave the rendered output identical to before.

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`

### Step 1: Define the trigger config shape and extract the helper

- [ ] Open `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`.
- [ ] Below the imports, above the `DefaultButtonBlock` component, add a local type:

```tsx
interface TriggerConfig {
    label: string;
    variant?: 'primary' | 'secondary' | 'outline';
    linkType?: 'url' | 'page' | 'form';
    url?: string;
    formId?: string;
    openInNewTab?: boolean;
}
```

- [ ] Inside `DefaultButtonBlock`, after `const buttonStyle = ...` (around line 65), extract a `renderTrigger` callback that takes the button config and the form-state handlers it needs. Replace the existing trigger-building block (lines 66–156) with:

```tsx
const buildTrigger = (
    cfg: TriggerConfig,
    key: 'primary' | 'secondary',
    formState: {
        isLoadingForm: boolean;
        onFormClick: (e: React.MouseEvent) => void;
    }
): React.ReactNode => {
    const label = cfg.label || 'Click Here';
    const linkType = cfg.linkType || 'url';
    const isFormLink = linkType === 'form' && !!cfg.formId;

    const rawUrl = typeof cfg.url === 'string' ? cfg.url.trim() : '';
    const resolvedHref = linkType === 'page'
        ? resolveNavHref(rawUrl, tenantSlug, isSubdomain)
        : rawUrl;

    const safe = isSafeHref(resolvedHref);
    const external = safe && isExternalProtocol(resolvedHref);
    const openInNewTab = external || cfg.openInNewTab === true;

    const variantClass = getVariantClass(cfg.variant);
    const className = `inline-block py-3 px-6 ${BUTTON_TEXT(d)} transition-all transform ${isClean ? 'shadow-sm hover:-translate-y-0.5' : isGlass ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'hover:-translate-y-1 hover:shadow-lg'} ${variantClass} ${data.align === 'full' ? 'w-full block' : ''}`;

    if (previewMode || (!isFormLink && !safe)) {
        return <span key={key} className={className} style={buttonStyle}>{label}</span>;
    }
    if (isFormLink) {
        return (
            <button
                key={key}
                type="button"
                onClick={formState.onFormClick}
                className={className}
                style={buttonStyle}
                disabled={formState.isLoadingForm}
            >
                {formState.isLoadingForm ? 'Loading…' : label}
            </button>
        );
    }
    if (external) {
        return (
            <a
                key={key}
                href={resolvedHref}
                className={className}
                style={buttonStyle}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? 'noopener noreferrer' : undefined}
            >
                {label}
            </a>
        );
    }
    return (
        <Link
            key={key}
            href={resolvedHref}
            className={className}
            style={buttonStyle}
            target={openInNewTab ? '_blank' : undefined}
            rel={openInNewTab ? 'noopener noreferrer' : undefined}
        >
            {label}
        </Link>
    );
};
```

- [ ] Refactor the existing `getVariantClass` (lines 41–61) to accept a `variant` arg instead of reading `data.variant`:

```tsx
const getVariantClass = (variant?: string) => {
    if (isGlass) {
        switch (variant) {
            case 'secondary': return 'bg-white/10 border border-white/20 text-white hover:bg-white/20';
            case 'outline': return 'bg-transparent border border-white/30 text-white hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
            default: return 'bg-[var(--theme-primary)] text-[var(--theme-background)] hover:opacity-90';
        }
    }
    if (isClean) {
        switch (variant) {
            case 'secondary': return 'bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-[var(--theme-foreground)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
            case 'outline': return 'bg-transparent border-2 border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
            default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:bg-[var(--theme-primary)] hover:shadow-lg';
        }
    }
    switch (variant) {
        case 'secondary': return 'bg-[var(--theme-primary)] text-[var(--theme-foreground)] hover:opacity-80';
        case 'outline': return 'bg-transparent border-[3px] border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
        default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:opacity-80';
    }
};
```

- [ ] Replace the JSX that uses `trigger` (the final `return` block, lines 158–180) with a call that builds the primary trigger inline. Keep the surrounding `wrapperClass`, `formError`, and `FormModal` exactly as-is:

```tsx
const primaryTrigger = buildTrigger(
    { label: data.label, variant: data.variant, linkType: data.linkType, url: data.url, formId: data.formId, openInNewTab: data.openInNewTab },
    'primary',
    { isLoadingForm, onFormClick: handleFormClick }
);

return (
    <>
        <div className={wrapperClass}>
            {primaryTrigger}
            {formError && (
                <div
                    role="alert"
                    className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--theme-error-bg)',
                        color: 'var(--theme-error)',
                        borderColor: 'var(--theme-error-bg)',
                    }}
                >
                    {formError}
                </div>
            )}
        </div>
        {isFormLink && isModalOpen && formData && (
            <FormModal form={formData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} siteId={siteId} />
        )}
    </>
);
```

- [ ] **Note:** the `isFormLink` reference in the final `FormModal` guard is currently a top-level const built from `data.linkType === 'form' && !!data.formId` (line 68). Keep that line as-is at the top of the component so the modal-guard still resolves. The `linkType`-derived locals (`resolvedHref`, `safe`, `external`, `openInNewTab`, `label`, `className`) that were at the top level should be **deleted** — they now live inside `buildTrigger`.

- [ ] Delete the now-unused old `trigger` variable and its branches.

### Step 2: Manual verification (regression check — no visible change)

- [ ] Run `cd clicker-platform-v2 && pnpm dev` (or keep it running).
- [ ] In Canvas Studio, drop a Button block. Set linkType to URL with `https://example.com`. Confirm it renders as an `<a>` opening in a new tab.
- [ ] Set linkType to Page, pick a page. Confirm it renders as `<Link>` to the resolved slug.
- [ ] Set linkType to Form, pick a form. Confirm clicking opens the FormModal.
- [ ] Try variant `primary`, `secondary`, `outline` — each should look identical to before this task.
- [ ] Try align `left`, `center`, `right`, `full` — each should look identical to before this task.
- [ ] Verify on both `clean` and `glass` cardStyle templates.

### Step 3: Type check and commit

- [ ] Run:

```bash
cd clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -i "DefaultButtonBlock" || echo "no errors in DefaultButtonBlock"
```

Expected: "no errors in DefaultButtonBlock"

- [ ] Commit:

```bash
git add clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx
git commit -m "refactor(blocks): extract buildTrigger helper in DefaultButtonBlock"
```

---

## Task 3: Button — refactor form-state to key by button

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`

This task introduces a per-button form-state model so a future secondary form-link button does not collide with the primary's modal state. Still no visible change.

### Step 1: Replace single-instance form state with a keyed map

- [ ] Inside `DefaultButtonBlock`, replace the four `useState` calls (lines 29–32):

```tsx
const [isModalOpen, setIsModalOpen] = useState(false);
const [formData, setFormData] = useState<any>(null);
const [isLoadingForm, setIsLoadingForm] = useState(false);
const [formError, setFormError] = useState<string | null>(null);
```

with:

```tsx
type ButtonKey = 'primary' | 'secondary';
const [modalOpenFor, setModalOpenFor] = useState<ButtonKey | null>(null);
const [formDataByKey, setFormDataByKey] = useState<Partial<Record<ButtonKey, any>>>({});
const [loadingFor, setLoadingFor] = useState<ButtonKey | null>(null);
const [errorByKey, setErrorByKey] = useState<Partial<Record<ButtonKey, string>>>({});
```

### Step 2: Refactor `handleFormClick` to take a key + config

- [ ] Replace the existing `handleFormClick` (lines 83–106) with:

```tsx
const handleFormClick = (key: ButtonKey, cfg: TriggerConfig) => async (e: React.MouseEvent) => {
    e.preventDefault();
    if (previewMode || !siteId) return;
    setErrorByKey(prev => ({ ...prev, [key]: undefined }));
    if (!formDataByKey[key]) {
        setLoadingFor(key);
        try {
            const res = await fetch(`/api/forms?id=${cfg.formId}&siteId=${siteId}`);
            if (res.ok) {
                const data = await res.json();
                setFormDataByKey(prev => ({ ...prev, [key]: data }));
                setModalOpenFor(key);
            } else if (res.status === 404) {
                setErrorByKey(prev => ({ ...prev, [key]: 'Form not found or unpublished.' }));
            } else {
                setErrorByKey(prev => ({ ...prev, [key]: 'Could not load form. Please try again.' }));
            }
        } catch {
            setErrorByKey(prev => ({ ...prev, [key]: 'Network error. Please check your connection.' }));
        }
        setLoadingFor(null);
    } else {
        setModalOpenFor(key);
    }
};
```

### Step 3: Update auto-dismiss effect

- [ ] Replace the `formError` auto-dismiss effect (lines 109–113) with one that clears per-key errors after 4s:

```tsx
React.useEffect(() => {
    const keys = (Object.keys(errorByKey) as ButtonKey[]).filter(k => errorByKey[k]);
    if (keys.length === 0) return;
    const timers = keys.map(k =>
        setTimeout(() => setErrorByKey(prev => ({ ...prev, [k]: undefined })), 4000)
    );
    return () => timers.forEach(clearTimeout);
}, [errorByKey]);
```

### Step 4: Update the primary trigger build call and the final JSX

- [ ] Update the `primaryTrigger` build to use the new keyed state:

```tsx
const primaryCfg: TriggerConfig = {
    label: data.label,
    variant: data.variant,
    linkType: data.linkType,
    url: data.url,
    formId: data.formId,
    openInNewTab: data.openInNewTab,
};
const primaryTrigger = buildTrigger(primaryCfg, 'primary', {
    isLoadingForm: loadingFor === 'primary',
    onFormClick: handleFormClick('primary', primaryCfg),
});
```

- [ ] Update the final `return`:

```tsx
const primaryError = errorByKey.primary;
const primaryIsFormLink = data.linkType === 'form' && !!data.formId;

return (
    <>
        <div className={wrapperClass}>
            {primaryTrigger}
            {primaryError && (
                <div
                    role="alert"
                    className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--theme-error-bg)',
                        color: 'var(--theme-error)',
                        borderColor: 'var(--theme-error-bg)',
                    }}
                >
                    {primaryError}
                </div>
            )}
        </div>
        {primaryIsFormLink && modalOpenFor === 'primary' && formDataByKey.primary && (
            <FormModal
                form={formDataByKey.primary}
                isOpen={true}
                onClose={() => setModalOpenFor(null)}
                siteId={siteId}
            />
        )}
    </>
);
```

- [ ] Delete the now-unused top-level `isFormLink` line if it still exists.

### Step 5: Manual regression verification

- [ ] In Canvas Studio, repeat the same checks from Task 2 Step 2: URL link, page link, form link (modal opens & closes), all variants, all alignments, on `clean` and `glass` cardStyle. Behavior must remain identical.

### Step 6: Type check and commit

- [ ] Run:

```bash
cd clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -i "DefaultButtonBlock" || echo "no errors in DefaultButtonBlock"
```

- [ ] Commit:

```bash
git add clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx
git commit -m "refactor(blocks): key DefaultButtonBlock form state by button"
```

---

## Task 4: Button — render secondary CTA when `data.secondary` is present

**Files:**
- Modify: `clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx`

### Step 1: Add secondary build + alignment-aware pair wrapper

- [ ] Below the `primaryTrigger` build, add:

```tsx
const secondaryCfg: TriggerConfig | null = data.secondary
    ? {
        label: data.secondary.label,
        variant: data.secondary.variant,
        linkType: data.secondary.linkType,
        url: data.secondary.url,
        formId: data.secondary.formId,
        openInNewTab: data.secondary.openInNewTab,
    }
    : null;

const secondaryTrigger = secondaryCfg
    ? buildTrigger(secondaryCfg, 'secondary', {
        isLoadingForm: loadingFor === 'secondary',
        onFormClick: handleFormClick('secondary', secondaryCfg),
    })
    : null;

const secondaryError = errorByKey.secondary;
const secondaryIsFormLink = !!data.secondary && data.secondary.linkType === 'form' && !!data.secondary.formId;
```

### Step 2: Build the alignment + container-query pair wrapper

- [ ] Replace the final `return` JSX with a branch on whether `secondaryTrigger` exists:

```tsx
const pairJustify =
    data.align === 'left' ? 'justify-start' :
    data.align === 'right' ? 'justify-end' :
    'justify-center';

const isFull = data.align === 'full';

const triggers = secondaryTrigger ? (
    <div
        className={`@container w-full ${isFull ? '' : `flex ${pairJustify}`}`}
    >
        <div className={`flex flex-col @[320px]:flex-row gap-3 ${isFull ? 'w-full' : ''}`}>
            {isFull ? (
                <>
                    <div className="flex-1 [&>*]:w-full [&>*]:block">{primaryTrigger}</div>
                    <div className="flex-1 [&>*]:w-full [&>*]:block">{secondaryTrigger}</div>
                </>
            ) : (
                <>
                    {primaryTrigger}
                    {secondaryTrigger}
                </>
            )}
        </div>
    </div>
) : (
    primaryTrigger
);

return (
    <>
        <div className={wrapperClass}>
            {triggers}
            {primaryError && (
                <div
                    role="alert"
                    className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--theme-error-bg)',
                        color: 'var(--theme-error)',
                        borderColor: 'var(--theme-error-bg)',
                    }}
                >
                    {primaryError}
                </div>
            )}
            {secondaryError && (
                <div
                    role="alert"
                    className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border"
                    style={{
                        backgroundColor: 'var(--theme-error-bg)',
                        color: 'var(--theme-error)',
                        borderColor: 'var(--theme-error-bg)',
                    }}
                >
                    {secondaryError}
                </div>
            )}
        </div>
        {primaryIsFormLink && modalOpenFor === 'primary' && formDataByKey.primary && (
            <FormModal
                form={formDataByKey.primary}
                isOpen={true}
                onClose={() => setModalOpenFor(null)}
                siteId={siteId}
            />
        )}
        {secondaryIsFormLink && modalOpenFor === 'secondary' && formDataByKey.secondary && (
            <FormModal
                form={formDataByKey.secondary}
                isOpen={true}
                onClose={() => setModalOpenFor(null)}
                siteId={siteId}
            />
        )}
    </>
);
```

### Step 3: Verify Tailwind v4 container-query class works

- [ ] In `clicker-platform-v2/app/globals.css` (or the main Tailwind import file), confirm `@import "tailwindcss";` is present and no plugin opt-in is needed. Tailwind v4 ships `@container` and arbitrary `@[320px]:` variants in core.
- [ ] If a `tailwind.config.{ts,js,mjs}` exists in `clicker-platform-v2/` (unlikely in v4), confirm `@tailwindcss/container-queries` is **not** required.

### Step 4: Type check

- [ ] Run:

```bash
cd clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -i "DefaultButtonBlock" || echo "no errors in DefaultButtonBlock"
```

### Step 5: Commit (rendering only — admin can't add `secondary` yet)

- [ ] Commit:

```bash
git add clicker-platform-v2/components/blocks/public/DefaultButtonBlock.tsx
git commit -m "feat(blocks): DefaultButtonBlock renders optional secondary CTA"
```

---

## Task 5: ButtonForm — collapsible "Secondary button" section

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/forms/ButtonForm.tsx`

### Step 1: Add the secondary toggle and field block

- [ ] Replace the entire body of the `ButtonForm` return statement with a version that appends a secondary-button section after the existing fields. The existing primary fields are kept exactly as-is.

```tsx
'use client';

import { LinkPicker, LinkValue } from './LinkPicker';

interface ButtonFormProps {
    data: any;
    onChange: (data: any) => void;
}

interface SecondaryButtonData {
    label?: string;
    variant?: 'primary' | 'secondary' | 'outline';
    linkType?: 'url' | 'page' | 'form';
    url?: string;
    pageId?: string | null;
    formId?: string | null;
    openInNewTab?: boolean;
}

export const ButtonForm = ({ data, onChange }: ButtonFormProps) => {
    const safeData = data || {};
    const secondary: SecondaryButtonData | undefined = safeData.secondary;

    const handleChange = (field: string, value: string | boolean) => {
        onChange({ ...safeData, [field]: value });
    };

    const handleLinkChange = (next: LinkValue) => {
        onChange({
            ...safeData,
            linkType: next.type,
            url: next.url || '',
            pageId: next.pageId ?? null,
            formId: next.formId ?? null,
        });
    };

    const linkValue: LinkValue = {
        type: safeData.linkType || 'url',
        url: safeData.url || '',
        pageId: safeData.pageId ?? null,
        formId: safeData.formId ?? null,
    };

    const url = (safeData.url || '').trim();
    const isExternal = /^(https?:\/\/|mailto:|tel:)/i.test(url);
    const newTabChecked = isExternal || safeData.openInNewTab === true;

    const updateSecondary = (patch: Partial<SecondaryButtonData>) => {
        onChange({ ...safeData, secondary: { ...(secondary || {}), ...patch } });
    };

    const handleSecondaryLinkChange = (next: LinkValue) => {
        updateSecondary({
            linkType: next.type,
            url: next.url || '',
            pageId: next.pageId ?? null,
            formId: next.formId ?? null,
        });
    };

    const addSecondary = () => {
        onChange({
            ...safeData,
            secondary: {
                label: 'Learn More',
                variant: 'outline',
                linkType: 'url',
                url: '',
            },
        });
    };

    const removeSecondary = () => {
        const next = { ...safeData };
        delete next.secondary;
        onChange(next);
    };

    const secondaryLinkValue: LinkValue = {
        type: secondary?.linkType || 'url',
        url: secondary?.url || '',
        pageId: secondary?.pageId ?? null,
        formId: secondary?.formId ?? null,
    };
    const secondaryUrl = (secondary?.url || '').trim();
    const secondaryIsExternal = /^(https?:\/\/|mailto:|tel:)/i.test(secondaryUrl);
    const secondaryNewTabChecked = secondaryIsExternal || secondary?.openInNewTab === true;

    const inputClass = 'w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-medium';
    const labelClass = 'block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelClass}>Button Text</label>
                    <input
                        type="text"
                        value={safeData.label || ''}
                        onChange={(e) => handleChange('label', e.target.value)}
                        className={inputClass}
                        placeholder="Click Here"
                    />
                </div>
                <div className="md:col-span-2">
                    <LinkPicker value={linkValue} onChange={handleLinkChange} />
                    <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                        <input
                            type="checkbox"
                            checked={newTabChecked}
                            disabled={isExternal}
                            onChange={(e) => handleChange('openInNewTab', e.target.checked)}
                            className="rounded border-gray-300 dark:border-neutral-700"
                        />
                        Open in new tab{isExternal ? ' (auto for external links)' : ''}
                    </label>
                </div>
                <div>
                    <label className={labelClass}>Style</label>
                    <select
                        value={safeData.variant || 'primary'}
                        onChange={(e) => handleChange('variant', e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer`}
                    >
                        <option value="primary">Solid (Brand)</option>
                        <option value="secondary">Secondary</option>
                        <option value="outline">Outline</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Alignment</label>
                    <select
                        value={safeData.align || 'center'}
                        onChange={(e) => handleChange('align', e.target.value)}
                        className={`${inputClass} appearance-none cursor-pointer`}
                    >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                        <option value="full">Full Width</option>
                    </select>
                </div>
            </div>

            {!secondary && (
                <button
                    type="button"
                    onClick={addSecondary}
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                >
                    + Add secondary button
                </button>
            )}

            {secondary && (
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">Secondary button</span>
                        <button
                            type="button"
                            onClick={removeSecondary}
                            className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
                        >
                            Remove
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={labelClass}>Button Text</label>
                            <input
                                type="text"
                                value={secondary.label || ''}
                                onChange={(e) => updateSecondary({ label: e.target.value })}
                                className={inputClass}
                                placeholder="Learn More"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <LinkPicker value={secondaryLinkValue} onChange={handleSecondaryLinkChange} />
                            <label className="mt-2 flex items-center gap-2 text-xs text-neutral-400 dark:text-neutral-500">
                                <input
                                    type="checkbox"
                                    checked={secondaryNewTabChecked}
                                    disabled={secondaryIsExternal}
                                    onChange={(e) => updateSecondary({ openInNewTab: e.target.checked })}
                                    className="rounded border-gray-300 dark:border-neutral-700"
                                />
                                Open in new tab{secondaryIsExternal ? ' (auto for external links)' : ''}
                            </label>
                        </div>
                        <div>
                            <label className={labelClass}>Style</label>
                            <select
                                value={secondary.variant || 'outline'}
                                onChange={(e) => updateSecondary({ variant: e.target.value as SecondaryButtonData['variant'] })}
                                className={`${inputClass} appearance-none cursor-pointer`}
                            >
                                <option value="primary">Solid (Brand)</option>
                                <option value="secondary">Secondary</option>
                                <option value="outline">Outline</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
```

### Step 2: Manual verification — full end-to-end

- [ ] In Canvas Studio, drop a Button block. Confirm it renders single-button (no regression).
- [ ] Click "+ Add secondary button". A second section appears with default `label="Learn More"`, `variant="outline"`, URL link.
- [ ] Edit the secondary label/URL. Confirm the public block renders both buttons side-by-side on desktop.
- [ ] Resize the browser narrow (or drop the block inside a 2-column Columns block). Buttons stack vertically when the container width < 320px.
- [ ] Set primary `align = full`. Both buttons share the row at 50% each on desktop, stack 100% on mobile/narrow.
- [ ] Set primary `align = left | center | right`. The pair aligns accordingly.
- [ ] Set secondary `linkType = form` (pick a form), set primary `linkType = form` (pick a different form). Click each → confirm correct modal opens; closing one doesn't affect the other.
- [ ] Click "Remove" on secondary. Block returns to single-button rendering. Underlying data no longer has `secondary` key (verify in the block JSON via the navigator if needed).
- [ ] Test on both `clean` and `glass` cardStyle templates.

### Step 3: Type check, lint, commit

- [ ] Run:

```bash
cd clicker-platform-v2 && pnpm exec tsc --noEmit 2>&1 | grep -i "ButtonForm\|DefaultButtonBlock" || echo "no errors"
```

- [ ] Run:

```bash
cd clicker-platform-v2 && pnpm lint 2>&1 | grep -E "ButtonForm|DefaultButtonBlock|DefaultFeatureCardsBlock" || echo "no lint issues in touched files"
```

- [ ] Commit:

```bash
git add clicker-platform-v2/components/admin/blocks/forms/ButtonForm.tsx
git commit -m "feat(blocks): ButtonForm collapsible secondary-button section"
```

---

## Final verification checklist

Before considering this work done, confirm:

- [ ] Feature Cards block with 1 card renders full-width on desktop and mobile.
- [ ] Feature Cards block with 2/3/4 cards renders identically to before this change.
- [ ] Button block with no `secondary` field renders identically to before this change (primary single button works for URL, page, form).
- [ ] Button block with `secondary` renders both buttons; container query stacks them at <320px container width.
- [ ] `align: full` with two buttons gives 50/50 split on desktop, stacked on mobile/narrow.
- [ ] Form-link primary + form-link secondary open independent modals.
- [ ] Removing the secondary button restores single-button rendering and clears `data.secondary`.
- [ ] No TypeScript errors introduced in `DefaultButtonBlock.tsx`, `DefaultFeatureCardsBlock.tsx`, or `ButtonForm.tsx`.
- [ ] No new lint errors in the three touched files.
- [ ] Verified on both `clean` and `glass` cardStyle templates.
