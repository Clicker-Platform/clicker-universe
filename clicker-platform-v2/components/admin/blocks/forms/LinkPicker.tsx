'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';

export type LinkType = 'page' | 'form' | 'url';

export interface LinkValue {
    type?: LinkType;
    url?: string;
    pageId?: string | null;
    formId?: string | null;
}

interface LinkPickerProps {
    value: LinkValue;
    onChange: (next: LinkValue) => void;
    label?: string;
}

export const LinkPicker = ({ value, onChange, label = 'Link Type' }: LinkPickerProps) => {
    const { siteId } = useSite();
    const [pages, setPages] = useState<any[]>([]);
    const [forms, setForms] = useState<any[]>([]);

    useEffect(() => {
        if (!siteId) return;
        Promise.all([
            getDocs(collection(db, 'sites', siteId, 'pages')),
            getDocs(collection(db, 'sites', siteId, 'forms')),
        ]).then(([pSnap, fSnap]) => {
            setPages(pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
            setForms(fSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
        });
    }, [siteId]);

    const type: LinkType = value.type || 'url';
    const inputClass = 'w-full px-4 py-2.5 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all';

    const setType = (t: LinkType) => {
        onChange({ type: t, url: '', pageId: null, formId: null });
    };

    return (
        <div>
            <label className="block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-2 uppercase tracking-wider">{label}</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
                {(['page', 'form', 'url'] as const).map(t => (
                    <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`px-3 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                            type === t
                                ? 'bg-blue-500/15 text-blue-500 border border-blue-500/40'
                                : 'bg-gray-100 dark:bg-neutral-800 text-neutral-500 border border-gray-300 dark:border-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300'
                        }`}
                    >
                        {t === 'url' ? 'URL' : t}
                    </button>
                ))}
            </div>
            {type === 'form' ? (
                <select
                    value={value.formId || ''}
                    onChange={(e) => onChange({ ...value, type: 'form', formId: e.target.value, url: '', pageId: null })}
                    className={`${inputClass} font-medium appearance-none cursor-pointer`}
                >
                    <option value="">— Select Form —</option>
                    {forms.map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
                </select>
            ) : type === 'page' ? (
                <select
                    value={value.pageId || ''}
                    onChange={(e) => {
                        const page = pages.find(p => p.id === e.target.value);
                        onChange({ ...value, type: 'page', pageId: e.target.value, url: page ? `/${page.slug}` : '', formId: null });
                    }}
                    className={`${inputClass} font-medium appearance-none cursor-pointer`}
                >
                    <option value="">— Select Page —</option>
                    {pages.map(p => <option key={p.id} value={p.id}>{p.title} (/{p.slug})</option>)}
                </select>
            ) : (
                <input
                    type="text"
                    value={value.url || ''}
                    onChange={(e) => onChange({ ...value, type: 'url', url: e.target.value, pageId: null, formId: null })}
                    className={`${inputClass} font-mono`}
                    placeholder="https://... or /page"
                />
            )}
        </div>
    );
};
