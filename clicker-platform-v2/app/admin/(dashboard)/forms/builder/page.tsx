'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { FormBuilderClient } from './FormBuilderClient';
import { Form } from '@/data/mockData';
import { Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

export default function BuilderPage() {
    const searchParams = useSearchParams();
    const formId = searchParams.get('id');
    const { siteId } = useSite();
    const [initialForm, setInitialForm] = useState<Form | undefined>(undefined);
    const [loading, setLoading] = useState(!!formId);

    useEffect(() => {
        async function fetchForm() {
            if (!formId || !siteId) return;

            try {
                const docSnap = await getDoc(doc(db, 'sites', siteId, 'forms', formId));
                if (docSnap.exists()) {
                    const data = docSnap.data();

                    const serializeDate = (ts: unknown) => {
                        if (!ts) return null;
                        const t = ts as { toMillis?: () => number; toDate?: () => Date; seconds?: number };
                        if (typeof t.toMillis === 'function') return t.toMillis();
                        if (typeof t.toDate === 'function') return t.toDate().getTime();
                        if (t.seconds) return t.seconds * 1000;
                        return null;
                    };

                    const form = {
                        id: docSnap.id,
                        ...(data as Record<string, unknown>),
                        createdAt: serializeDate(data?.createdAt),
                        updatedAt: serializeDate(data?.updatedAt)
                    } as unknown as Form;

                    setInitialForm(form);
                }
            } catch (error) {
                logger.error('admin.form.fetch.failed', { siteId, error });
            } finally {
                setLoading(false);
            }
        }

        fetchForm();
    }, [formId, siteId]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <Loader2 size={48} className="text-brand-dark animate-spin" />
            </div>
        );
    }

    return <FormBuilderClient initialForm={initialForm} />;
}
