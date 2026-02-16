'use client';

import { useState, useEffect } from 'react';
import { Mail, Archive } from 'lucide-react';
import { SubmissionCard } from '@/components/admin/inbox/SubmissionCard';
import { InboxFilters } from '@/components/admin/inbox/InboxFilters';
import { SubmissionList } from '@/components/admin/inbox/SubmissionList';
import { Submission } from '@/data/mockData';
import { useRouter } from 'next/navigation';

interface InboxClientProps {
    initialSubmissions: Submission[];
    formFieldMap: Record<string, Record<string, string>>;
    siteId: string;
}

export default function InboxClient({ initialSubmissions, formFieldMap, siteId }: InboxClientProps) {
    const router = useRouter();
    const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
    const [filterStatus, setFilterStatus] = useState<'all' | 'new' | 'read' | 'archived'>('all');
    const [loadingId, setLoadingId] = useState<string | null>(null);

    useEffect(() => {
        setSubmissions(initialSubmissions);
    }, [initialSubmissions]);

    const handleAction = async (id: string, action: string) => {
        setLoadingId(id);
        try {
            const res = await fetch('/api/submissions/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, siteId })
            });
            // ...

            if (res.ok) {
                if (action === 'delete') {
                    setSubmissions(prev => prev.filter(s => s.id !== id));
                } else {
                    setSubmissions(prev => prev.map(s => s.id === id ? { ...s, status: action as Submission['status'] } : s));
                }
                router.refresh(); // Refresh server data so logic stays in sync
            }
        } catch (error) {
            console.error('Error updating submission:', error);
        } finally {
            setLoadingId(null);
        }
    };

    const filteredSubmissions = submissions.filter(sub => {
        if (filterStatus === 'all') return sub.status !== 'archived'; // Default view hides archived unless explicitly asked? Or maybe 'all' shows active ones. Let's make 'all' show everything except archived for now, or just everything.
        // Actually, typical inbox 'All' often means 'Inbox' (new + read). Archived is separate.
        // Let's mimic Gmail: Inbox (new/read) vs Archived.
        return sub.status === filterStatus;
    });

    const counts = {
        all: submissions.filter(s => s.status !== 'archived').length,
        new: submissions.filter(s => s.status === 'new').length,
        read: submissions.filter(s => s.status === 'read').length,
        archived: submissions.filter(s => s.status === 'archived').length,
    };

    return (
        <div>
            {/* Filter Tabs */}
            <InboxFilters
                currentFilter={filterStatus}
                onFilterChange={setFilterStatus}
                counts={counts}
            />

            <div className="bg-white rounded-3xl border-[3px] border-brand-dark shadow-sticker overflow-hidden">
                <SubmissionList
                    submissions={filteredSubmissions}
                    formFieldMap={formFieldMap}
                    loadingId={loadingId}
                    filterStatus={filterStatus}
                    onAction={handleAction}
                />
            </div>
        </div>
    );
}
