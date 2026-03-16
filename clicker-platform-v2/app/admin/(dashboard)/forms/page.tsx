'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { Plus, FileText, Loader2 } from 'lucide-react';
import { Form } from '@/data/mockData';
import { FormCard } from './FormCard';
import { FormsSkeleton } from '@/components/skeletons/FormsSkeleton';

// ...
import { useSite } from '@/lib/site-context';

export default function FormsPage() {
    const { siteId } = useSite();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        async function fetchForms() {
            try {
                const formsQuery = query(collection(db, 'sites', siteId, 'forms'), orderBy('createdAt', 'desc'));
                const formsSnap = await getDocs(formsQuery);
                // ...

                const fetchedForms = formsSnap.docs.map(doc => {
                    const data = doc.data();

                    // Safe serialization for Timestamp
                    const serializeDate = (ts: any) => {
                        if (!ts) return null;
                        // Client SDK Timestamp objects have toMillis()
                        if (typeof ts.toMillis === 'function') return ts.toMillis();
                        if (typeof ts.toDate === 'function') return ts.toDate().getTime();
                        if (ts.seconds) return ts.seconds * 1000;
                        return null;
                    };

                    return {
                        id: doc.id,
                        ...data,
                        createdAt: serializeDate(data.createdAt),
                        updatedAt: serializeDate(data.updatedAt)
                    } as unknown as Form;
                });

                setForms(fetchedForms);
            } catch (error) {
                console.error("Error fetching forms:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchForms();
    }, [siteId]);

    if (loading) {
        return <FormsSkeleton />;
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-black text-brand-dark mb-2 uppercase tracking-tight">Forms Builder</h1>
                    <p className="text-gray-600 dark:text-neutral-400 font-medium">Build and manage your lead capture forms.</p>
                </div>
                <Link
                    href="/admin/forms/builder"
                    className="inline-flex items-center gap-2 bg-brand-dark text-brand-green px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-all shadow-sm"
                >
                    <Plus size={20} strokeWidth={3} />
                    Create Form
                </Link>
            </div>

            {/* Forms Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {forms.length > 0 ? (
                    forms.map((form) => (
                        <FormCard key={form.id} form={form} />
                    ))
                ) : (
                    <div className="col-span-full py-20 text-center bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-gray-300 dark:border-neutral-700">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-neutral-800 rounded-full mb-4 text-gray-400 dark:text-neutral-600">
                            <FileText size={32} />
                        </div>
                        <h3 className="text-xl font-black text-gray-400 dark:text-neutral-600 mb-2">No forms yet</h3>
                        <p className="text-gray-500 dark:text-neutral-500 font-medium mb-6">Create your first form to start collecting leads.</p>
                        <Link
                            href="/admin/forms/builder"
                            className="inline-flex items-center gap-2 bg-brand-dark text-white px-6 py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors"
                        >
                            <Plus size={20} />
                            Create New Form
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
