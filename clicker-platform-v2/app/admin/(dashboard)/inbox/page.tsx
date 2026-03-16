'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import Link from 'next/link';
import { Mail, Loader2 } from 'lucide-react';
import { Submission, Form } from '@/data/mockData';
import InboxClient from './InboxClient';
import { InboxSkeleton } from '@/components/skeletons/InboxSkeleton';

// ... imports
import { useSite } from '@/lib/site-context';

export default function InboxPage() {
    const { siteId } = useSite();
    const [submissions, setSubmissions] = useState<Submission[]>([]);
    const [formFieldMap, setFormFieldMap] = useState<Record<string, Record<string, string>>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!siteId) return;

        async function fetchInboxData() {
            try {
                const [submissionsSnap, formsSnap] = await Promise.all([
                    getDocs(query(collection(db, 'sites', siteId, 'inbox'), orderBy('submittedAt', 'desc'))),
                    getDocs(collection(db, 'sites', siteId, 'forms'))
                ]);

                // Build a map of formId -> fieldId -> fieldLabel
                const newFormFieldMap: Record<string, Record<string, string>> = {};
                formsSnap.docs.forEach(doc => {
                    const formData = doc.data() as Form;
                    if (formData.fields && Array.isArray(formData.fields)) {
                        const fieldMap: Record<string, string> = {};
                        formData.fields.forEach((field: any) => {
                            if (field.id && field.label) {
                                fieldMap[field.id] = field.label;
                            }
                        });
                        newFormFieldMap[doc.id] = fieldMap;
                    }
                });
                setFormFieldMap(newFormFieldMap);

                const fetchedSubmissions = submissionsSnap.docs.map(doc => {
                    const data = doc.data();
                    const serializeDate = (ts: any) => {
                        if (!ts) return null;
                        if (typeof ts.toMillis === 'function') return ts.toMillis();
                        if (typeof ts.toDate === 'function') return ts.toDate().getTime();
                        if (ts.seconds) return ts.seconds * 1000;
                        return null;
                    };

                    return {
                        id: doc.id,
                        ...data,
                        submittedAt: serializeDate(data.submittedAt),
                        status: data.status || 'new'
                    } as unknown as Submission;
                });
                setSubmissions(fetchedSubmissions);

            } catch (error) {
                console.error("Error fetching inbox:", error);
            } finally {
                setLoading(false);
            }
        }

        fetchInboxData();
    }, [siteId]);

    if (loading) {
        return <InboxSkeleton />;
    }

    return (
        <div>
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-black text-brand-dark dark:text-neutral-100 mb-2 uppercase tracking-tight flex items-center gap-3">
                    <Mail size={32} /> Inbox
                </h1>
                <p className="text-gray-600 dark:text-neutral-400 font-medium">Read and manage form submissions from your customers.</p>
            </div>

            <InboxClient initialSubmissions={submissions} formFieldMap={formFieldMap} siteId={siteId} />
        </div>
    );
}
