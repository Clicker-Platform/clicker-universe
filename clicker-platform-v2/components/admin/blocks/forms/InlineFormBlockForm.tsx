'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';
import { Form } from '@/data/mockData';

interface Props {
    data: Record<string, unknown>;
    onChange: (data: Record<string, unknown>) => void;
}

export function InlineFormBlockForm({ data, onChange }: Props) {
    const safe = (data || {}) as {
        formId?: string;
        heading?: string;
        subheading?: string;
        successMessage?: string;
        redirectUrl?: string;
    };
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
