import { memo } from 'react';
import { Mail, Archive } from 'lucide-react';
import { Submission } from '@/data/mockData';
import { SubmissionCard } from './SubmissionCard';

interface SubmissionListProps {
    submissions: Submission[];
    formFieldMap: Record<string, Record<string, string>>;
    loadingId: string | null;
    filterStatus: 'all' | 'new' | 'read' | 'archived';
    onAction: (id: string, action: string) => void;
}

export const SubmissionList = memo(function SubmissionList({
    submissions,
    formFieldMap,
    loadingId,
    filterStatus,
    onAction
}: SubmissionListProps) {

    if (submissions.length === 0) {
        return (
            <div className="p-20 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4 text-gray-400">
                    {filterStatus === 'archived' ? <Archive size={32} /> : <Mail size={32} />}
                </div>
                <h3 className="text-xl font-black text-gray-400 mb-2">
                    {filterStatus === 'archived' ? 'No Archived Items' : 'Inbox Empty'}
                </h3>
                <p className="text-gray-500 font-medium">
                    {filterStatus === 'archived' ? 'Archived submissions will appear here.' : 'No new submissions yet.'}
                </p>
            </div>
        );
    }

    return (
        <div className="divide-y-2 divide-gray-100">
            {submissions.map((sub) => (
                <SubmissionCard
                    key={sub.id}
                    submission={sub}
                    formFieldMap={formFieldMap}
                    loadingId={loadingId}
                    onAction={onAction}
                />
            ))}
        </div>
    );
});
