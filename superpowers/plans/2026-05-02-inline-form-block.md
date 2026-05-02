# Inline Form Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `inline_form` Canvas Studio block that embeds an existing published form as inline page content, so visitors can fill and submit it without a modal overlay.

**Architecture:** Extract shared submission logic and field rendering from `FormModal.tsx` into `lib/forms/useFormSubmit.ts` and `components/forms/FormFieldsRenderer.tsx`. Both `FormModal` and the new inline block use these primitives. The block stores only a `formId` reference; actual form fields are fetched at render time from Firestore via the existing `/api/forms` endpoint.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Firebase Firestore client SDK, Lucide icons, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| New | `clicker-platform-v2/lib/forms/useFormSubmit.ts` | Hook: field state + submit logic |
| New | `clicker-platform-v2/components/forms/FormFieldsRenderer.tsx` | Pure render: all field types |
| Refactor | `clicker-platform-v2/components/FormModal.tsx` | Use new hook + renderer |
| New | `clicker-platform-v2/components/admin/blocks/forms/InlineFormBlockForm.tsx` | Canvas Studio sidebar form |
| New | `clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx` | Public block renderer |
| Modify | `clicker-platform-v2/data/mockData.ts:30` | Add `'inline_form'` to BlockType union |
| Modify | `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts` | BLOCK_OPTIONS + getDefaultData |
| Modify | `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx` | Dynamic import + coreLabels + switch case |
| Modify | `clicker-platform-v2/components/blocks/BlockRenderer.tsx` | Dynamic import + switch case |

---

## Task 1: Create `useFormSubmit` hook

**Files:**
- Create: `clicker-platform-v2/lib/forms/useFormSubmit.ts`

- [ ] **Step 1: Create the hook file**

```ts
// clicker-platform-v2/lib/forms/useFormSubmit.ts
import { useState, FormEvent } from 'react';
import { Form } from '@/data/mockData';

interface UseFormSubmitOptions {
    siteId?: string;
    form: Form;
    onSuccess: () => void;
}

export function useFormSubmit({ siteId, form, onSuccess }: UseFormSubmitOptions) {
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const setField = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: form.id,
                    formTitle: form.title,
                    data: formData,
                    siteId,
                    fieldLabels: form.fields?.reduce(
                        (acc, f) => ({ ...acc, [f.id]: f.label }),
                        {} as Record<string, string>
                    ),
                }),
            });
            if (!res.ok) throw new Error('Submission failed');
            onSuccess();
        } catch (err) {
            setError('Something went wrong. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    return { formData, setField, submitting, error, handleSubmit };
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/lib/forms/useFormSubmit.ts
git commit -m "feat(forms): add useFormSubmit hook extracted from FormModal"
```

---

## Task 2: Create `FormFieldsRenderer` component

**Files:**
- Create: `clicker-platform-v2/components/forms/FormFieldsRenderer.tsx`

- [ ] **Step 1: Create the component**

```tsx
// clicker-platform-v2/components/forms/FormFieldsRenderer.tsx
'use client';

import { FormField } from '@/data/mockData';
import { FormFileField } from '@/components/FormFileField';

interface FormFieldsRendererProps {
    fields: FormField[];
    formData: Record<string, string>;
    onChange: (fieldId: string, value: string) => void;
    labelClassName: string;
    inputClassName: string;
}

export function FormFieldsRenderer({
    fields,
    formData,
    onChange,
    labelClassName,
    inputClassName,
}: FormFieldsRendererProps) {
    return (
        <>
            {fields.map((field) => (
                <div key={field.id}>
                    {field.type !== 'file' && (
                        <label className={`block text-sm font-bold mb-1 ${labelClassName}`}>
                            {field.label}{' '}
                            {field.required && <span className="text-red-500">*</span>}
                        </label>
                    )}

                    {field.type === 'textarea' ? (
                        <textarea
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium resize-none h-32 ${inputClassName}`}
                        />
                    ) : field.type === 'select' ? (
                        <select
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium appearance-none ${inputClassName}`}
                        >
                            <option value="">Select an option...</option>
                            {field.options?.map((opt) => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        </select>
                    ) : field.type === 'file' ? (
                        <FormFileField
                            label={field.label}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(url) => onChange(field.id, url)}
                        />
                    ) : (
                        <input
                            type={field.type}
                            required={field.required}
                            placeholder={field.placeholder}
                            value={formData[field.id] || ''}
                            onChange={(e) => onChange(field.id, e.target.value)}
                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium ${inputClassName}`}
                        />
                    )}
                </div>
            ))}
        </>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/forms/FormFieldsRenderer.tsx
git commit -m "feat(forms): add FormFieldsRenderer shared component"
```

---

## Task 3: Refactor `FormModal` to use shared primitives

**Files:**
- Modify: `clicker-platform-v2/components/FormModal.tsx`

This task replaces the internal `useState` + `handleSubmit` + field JSX with the new hook and renderer. The public API of `FormModal` (props: `form`, `isOpen`, `onClose`, `siteId`) does not change — no callers break.

- [ ] **Step 1: Replace FormModal.tsx with the refactored version**

```tsx
// clicker-platform-v2/components/FormModal.tsx
'use client';

import React from 'react';
import { X, CheckCircle, Loader } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { FormFieldsRenderer } from '@/components/forms/FormFieldsRenderer';
import { useState } from 'react';

interface FormModalProps {
    form: Form;
    isOpen: boolean;
    onClose: () => void;
    siteId?: string;
}

export const FormModal: React.FC<FormModalProps> = ({ form, isOpen, onClose, siteId }) => {
    const { theme } = useTemplate();
    const isGlass = theme.cardStyle === 'glass';
    const [success, setSuccess] = useState(false);

    const { formData, setField, submitting, handleSubmit } = useFormSubmit({
        siteId,
        form,
        onSuccess: () => {
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        },
    });

    if (!isOpen) return null;
    if (form.isPublished === false) return null;

    const labelClassName = isGlass ? 'text-white/80' : 'text-gray-700';
    const inputClassName = isGlass
        ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
        : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div
                className={`relative rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
                    isGlass ? 'border border-white/10 backdrop-blur-xl' : 'bg-white'
                }`}
                style={isGlass ? { background: 'rgba(26, 26, 26, 0.85)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' } : undefined}
            >
                {!success && (
                    <button
                        onClick={onClose}
                        className={`absolute top-4 right-4 z-10 transition-colors ${
                            isGlass ? 'text-white/40 hover:text-white/80' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <X size={24} />
                    </button>
                )}

                {success ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mb-6 animate-bounce"
                            style={isGlass ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                        >
                            <CheckCircle size={32} className={isGlass ? 'text-white' : 'text-brand-dark'} />
                        </div>
                        <h2 className={`text-2xl font-black mb-2 ${isGlass ? 'text-white' : 'text-brand-dark'}`}>Sent!</h2>
                        <p className={`font-bold ${isGlass ? 'text-white/60' : 'text-gray-500'}`}>Thanks for reaching out.</p>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="text-center mb-8">
                            <h2
                                className={`text-2xl font-black uppercase tracking-tight mb-2 ${
                                    isGlass ? 'text-white' : 'text-brand-dark'
                                }`}
                                style={isGlass ? { color: 'var(--theme-primary)' } : undefined}
                            >
                                {form.title}
                            </h2>
                            <p className={`font-medium text-sm ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>
                                Fill out the form below.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <FormFieldsRenderer
                                fields={form.fields}
                                formData={formData}
                                onChange={setField}
                                labelClassName={labelClassName}
                                inputClassName={inputClassName}
                            />

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full font-bold py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2 ${
                                    isGlass ? 'text-white hover:brightness-110' : 'bg-brand-dark text-white hover:bg-gray-800'
                                }`}
                                style={isGlass ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                            >
                                {submitting && <Loader size={20} className="animate-spin" />}
                                {form.buttonText || 'Submit'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
```

- [ ] **Step 2: Verify the modal still works**

Start the dev server and open a Quick Actions block that has a form link. Click it — the modal should open, render fields, and accept input exactly as before. Submit it and confirm the submission appears in the admin Inbox.

```bash
cd clicker-platform-v2 && pnpm dev
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/FormModal.tsx
git commit -m "refactor(forms): FormModal uses useFormSubmit + FormFieldsRenderer"
```

---

## Task 4: Register `inline_form` block type and default data

**Files:**
- Modify: `clicker-platform-v2/data/mockData.ts:30`
- Modify: `clicker-platform-v2/components/admin/blocks/blockDefinitions.ts`

- [ ] **Step 1: Add `'inline_form'` to the BlockType union in `data/mockData.ts`**

Find line 30:
```ts
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | string;
```

Replace with:
```ts
export type BlockType = 'hero' | 'text' | 'image' | 'button' | 'products' | 'faq' | 'link' | 'map' | 'image_gallery' | 'social_embed' | 'quick_actions' | 'hours' | 'featured_product' | 'branches' | 'reservation' | 'reservation_cta' | 'content_showcase' | 'inline_form' | string;
```

- [ ] **Step 2: Add to `BLOCK_OPTIONS` in `blockDefinitions.ts`**

Add `ClipboardList` to the lucide import on line 2:
```ts
import { Type, Image as ImageIcon, Layout, Box, HelpCircle, AlignCenter, Link, Map, List, Clock, Star, MapPin, Play, Columns2, ClipboardList } from 'lucide-react';
```

Add entry to `BLOCK_OPTIONS` array (after the `branches` entry on line 22):
```ts
{ type: 'inline_form', label: 'Inline Form', icon: ClipboardList },
```

- [ ] **Step 3: Add `getDefaultData` case in `blockDefinitions.ts`**

Add before the `default:` case:
```ts
case 'inline_form':
    return {
        ...baseData,
        formId: '',
        heading: '',
        subheading: '',
        successMessage: "Thank you! We'll be in touch.",
        redirectUrl: '',
    };
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/data/mockData.ts clicker-platform-v2/components/admin/blocks/blockDefinitions.ts
git commit -m "feat(inline-form-block): register block type, options, and default data"
```

---

## Task 5: Create the admin sidebar form `InlineFormBlockForm`

**Files:**
- Create: `clicker-platform-v2/components/admin/blocks/forms/InlineFormBlockForm.tsx`

This form fetches published forms from Firestore directly (same pattern as `FormsPanel.tsx` which uses `useSite()` + Firestore client SDK).

- [ ] **Step 1: Create the form component**

```tsx
// clicker-platform-v2/components/admin/blocks/forms/InlineFormBlockForm.tsx
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { Form } from '@/data/mockData';

interface Props {
    data: any;
    onChange: (data: any) => void;
}

export function InlineFormBlockForm({ data, onChange }: Props) {
    const safe = data || {};
    const { siteId } = useSite();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;
        (async () => {
            try {
                const q = query(
                    collection(db, 'sites', siteId, 'forms'),
                    where('isPublished', '==', true),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(q);
                setForms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Form)));
            } finally {
                setLoading(false);
            }
        })();
    }, [siteId]);

    const handle = (field: string, value: string) =>
        onChange({ ...safe, [field]: value });

    const inputCls =
        'w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all';
    const labelCls = 'block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2';

    return (
        <div className="space-y-4">
            <div>
                <label className={labelCls}>Form</label>
                {loading ? (
                    <div className="h-10 bg-gray-100 dark:bg-neutral-800 rounded-lg animate-pulse" />
                ) : forms.length === 0 ? (
                    <p className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                        No published forms yet — create one in Forms.
                    </p>
                ) : (
                    <select
                        value={safe.formId || ''}
                        onChange={(e) => handle('formId', e.target.value)}
                        className={`${inputCls} appearance-none cursor-pointer`}
                    >
                        <option value="">Select a form...</option>
                        {forms.map((f) => (
                            <option key={f.id} value={f.id}>
                                {f.title}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            <div>
                <label className={labelCls}>Heading</label>
                <input
                    type="text"
                    value={safe.heading || ''}
                    onChange={(e) => handle('heading', e.target.value)}
                    placeholder="e.g. Contact Us"
                    className={inputCls}
                />
            </div>

            <div>
                <label className={labelCls}>Subheading</label>
                <input
                    type="text"
                    value={safe.subheading || ''}
                    onChange={(e) => handle('subheading', e.target.value)}
                    placeholder="e.g. Fill in the form below and we'll get back to you."
                    className={inputCls}
                />
            </div>

            <div>
                <label className={labelCls}>Success Message</label>
                <input
                    type="text"
                    value={safe.successMessage || ''}
                    onChange={(e) => handle('successMessage', e.target.value)}
                    placeholder="Thank you! We'll be in touch."
                    className={inputCls}
                />
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                    Shown after submission. Leave blank for the default message.
                </p>
            </div>

            <div>
                <label className={labelCls}>Redirect URL (optional)</label>
                <input
                    type="text"
                    value={safe.redirectUrl || ''}
                    onChange={(e) => handle('redirectUrl', e.target.value)}
                    placeholder="https://..."
                    className={`${inputCls} font-mono`}
                />
                <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
                    If set, redirects here after submission instead of showing the success message.
                </p>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/forms/InlineFormBlockForm.tsx
git commit -m "feat(inline-form-block): add admin sidebar form InlineFormBlockForm"
```

---

## Task 6: Register the admin form in `BlockFormRenderer`

**Files:**
- Modify: `clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx`

- [ ] **Step 1: Add dynamic import**

After the last existing dynamic import (line 34, `SocialEmbedForm`), add:
```ts
const InlineFormBlockForm = dynamic(
    () => import('./forms/InlineFormBlockForm').then(mod => mod.InlineFormBlockForm),
    { loading: () => <FormSkeleton /> }
);
```

- [ ] **Step 2: Add to `coreLabels`**

In the `coreLabels` object (lines 49–55), add:
```ts
'inline_form': 'Inline Form',
```

The full object becomes:
```ts
const coreLabels: Record<string, string> = {
    'hero': 'Hero', 'text': 'Text', 'image': 'Image', 'button': 'Button',
    'products': 'Products', 'faq': 'FAQ', 'link': 'Link', 'map': 'Map', 'image_gallery': 'Gallery',
    'quick_actions': 'Quick Actions', 'hours': 'Operating Hours', 'featured_product': 'Featured Product', 'branches': 'Branches',
    'social_embed': 'Social Embeds',
    'content_showcase': 'Content Showcase',
    'inline_form': 'Inline Form',
};
```

- [ ] **Step 3: Add switch case**

After the `social_embed` case (line 129), add:
```ts
case 'inline_form':
    return renderWithLayoutPicker(<InlineFormBlockForm data={block.data} onChange={handleDataChange} />);
```

- [ ] **Step 4: Commit**

```bash
git add clicker-platform-v2/components/admin/blocks/BlockFormRenderer.tsx
git commit -m "feat(inline-form-block): register InlineFormBlockForm in BlockFormRenderer"
```

---

## Task 7: Create the public renderer `DefaultInlineFormBlock`

**Files:**
- Create: `clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx`

The block fetches the form by `formId` from `/api/forms?id={formId}&siteId={siteId}`. The existing endpoint returns the form JSON (see `FormModal` usage in `QuickActions.tsx` for the pattern). After submit it either shows an inline success state or redirects.

- [ ] **Step 1: Create the public renderer**

```tsx
// clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, Loader } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { FormFieldsRenderer } from '@/components/forms/FormFieldsRenderer';
import { useTemplate } from '@/components/TemplateProvider';

interface Props {
    data: {
        formId?: string;
        heading?: string;
        subheading?: string;
        successMessage?: string;
        redirectUrl?: string;
    };
    siteId?: string;
}

export function DefaultInlineFormBlock({ data, siteId }: Props) {
    const { theme } = useTemplate();
    const isGlass = theme.cardStyle === 'glass';
    const router = useRouter();
    const [form, setForm] = useState<Form | null>(null);
    const [loadingForm, setLoadingForm] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!data?.formId || !siteId) {
            setLoadingForm(false);
            return;
        }
        fetch(`/api/forms?id=${data.formId}&siteId=${siteId}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((f) => setForm(f && f.isPublished !== false ? f : null))
            .catch(() => setForm(null))
            .finally(() => setLoadingForm(false));
    }, [data?.formId, siteId]);

    const { formData, setField, submitting, error, handleSubmit } = useFormSubmit({
        siteId,
        form: form!,
        onSuccess: () => {
            if (data.redirectUrl) {
                router.push(data.redirectUrl);
            } else {
                setSubmitted(true);
            }
        },
    });

    if (loadingForm) {
        return (
            <section className="w-full px-4 py-10 max-w-2xl mx-auto space-y-4 animate-pulse">
                <div className="h-6 bg-gray-200 dark:bg-neutral-800 rounded w-1/3" />
                <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-1/2" />
                <div className="h-10 bg-gray-200 dark:bg-neutral-800 rounded" />
                <div className="h-10 bg-gray-200 dark:bg-neutral-800 rounded" />
                <div className="h-12 bg-gray-200 dark:bg-neutral-800 rounded" />
            </section>
        );
    }

    if (!form) return null;

    const labelClassName = isGlass ? 'text-white/80' : 'text-gray-700';
    const inputClassName = isGlass
        ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
        : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark';

    if (submitted) {
        return (
            <section className="w-full px-4 py-10 max-w-2xl mx-auto text-center">
                <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                    <CheckCircle size={28} className="text-white" />
                </div>
                <p
                    className="text-lg font-bold"
                    style={{ color: 'var(--theme-foreground)' }}
                >
                    {data.successMessage || "Thank you! We'll be in touch."}
                </p>
            </section>
        );
    }

    return (
        <section className="w-full px-4 py-10 max-w-2xl mx-auto">
            {data.heading && (
                <h2
                    className="text-2xl font-black mb-1"
                    style={{ color: 'var(--theme-foreground)' }}
                >
                    {data.heading}
                </h2>
            )}
            {data.subheading && (
                <p
                    className="text-sm font-medium mb-6"
                    style={{ color: 'var(--theme-foreground)', opacity: 0.6 }}
                >
                    {data.subheading}
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <FormFieldsRenderer
                    fields={form.fields}
                    formData={formData}
                    onChange={setField}
                    labelClassName={labelClassName}
                    inputClassName={inputClassName}
                />

                {error && (
                    <p className="text-sm text-red-500 font-medium">{error}</p>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full font-bold py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white"
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                    {submitting && <Loader size={20} className="animate-spin" />}
                    {form.buttonText || 'Submit'}
                </button>
            </form>
        </section>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add clicker-platform-v2/components/blocks/public/DefaultInlineFormBlock.tsx
git commit -m "feat(inline-form-block): add DefaultInlineFormBlock public renderer"
```

---

## Task 8: Register the public renderer in `BlockRenderer`

**Files:**
- Modify: `clicker-platform-v2/components/blocks/BlockRenderer.tsx`

- [ ] **Step 1: Add dynamic import**

After the `SocialEmbedBlock` dynamic import (line 19), add:
```ts
const InlineFormBlock = dynamic(() =>
    import('./public/DefaultInlineFormBlock').then(mod => mod.DefaultInlineFormBlock)
);
```

- [ ] **Step 2: Add switch case**

After the `social_embed` case (line 187), add:
```ts
case 'inline_form':
    return customBlocks?.InlineFormBlock
        ? React.createElement(customBlocks.InlineFormBlock, { data: block.data, siteId })
        : <InlineFormBlock data={block.data} siteId={siteId} />;
```

- [ ] **Step 3: Commit**

```bash
git add clicker-platform-v2/components/blocks/BlockRenderer.tsx
git commit -m "feat(inline-form-block): register DefaultInlineFormBlock in BlockRenderer"
```

---

## Task 9: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
cd clicker-platform-v2 && pnpm dev
```

- [ ] **Step 2: Verify admin — add the block**

1. Open Canvas Studio for any custom page.
2. Click "Add Block" — confirm "Inline Form" appears in the list with a clipboard icon.
3. Add the block. Confirm the sidebar shows: Form selector, Heading, Subheading, Success Message, Redirect URL fields.
4. Select a published form from the dropdown.
5. Enter a heading and subheading.
6. Save the page.

- [ ] **Step 3: Verify public site — fill and submit**

1. Open the published page on the public site.
2. Confirm the form renders inline (not in a modal) with correct fields, heading, and subheading.
3. Fill in the fields and submit.
4. Confirm the inline success message appears in place of the form.
5. Open the admin Inbox — confirm the submission arrived with correct form title and field values.

- [ ] **Step 4: Verify redirect URL path**

1. Back in Canvas Studio, set a Redirect URL (e.g. `/`) on the block.
2. Submit the form on the public site — confirm it redirects to that URL instead of showing the success message.

- [ ] **Step 5: Verify empty/unpublished state**

1. Add a second inline form block but leave the Form selector empty — confirm `return null` (nothing renders on the public site).
2. In Forms admin, unpublish the form used in Step 2. Reload the public page — confirm the block disappears.

- [ ] **Step 6: Verify FormModal still works**

Open a Quick Actions block that links to a form, click the link — confirm the modal opens and submits correctly (regression check for the Task 3 refactor).

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat(inline-form-block): complete inline form block feature"
```
