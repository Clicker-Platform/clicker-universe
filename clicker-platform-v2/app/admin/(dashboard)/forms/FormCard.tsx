'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Calendar, Trash2 } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useRouter } from 'next/navigation';
import { useSite } from '@/lib/site-context';

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { AlertDialog } from '@/components/common/AlertDialog';

interface FormCardProps {
    form: Form;
}

export const FormCard: React.FC<FormCardProps> = ({ form }) => {
    const router = useRouter();
    const { siteId } = useSite();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showErrorDialog, setShowErrorDialog] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const handleDeleteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/forms/delete?id=${form.id}&siteId=${siteId}`, { method: 'DELETE' });
            if (res.ok) {
                router.refresh();
            } else {
                const data = await res.json();
                if (data.code === 'FORM_IN_USE') {
                    setErrorMessage('Cannot delete this form because it is currently linked to a card. Please remove the link first.');
                } else {
                    setErrorMessage('Failed to delete form. Please try again.');
                }
                setShowErrorDialog(true);
                setIsDeleting(false);
            }
        } catch (error) {
            console.error(error);
            setErrorMessage('An unexpected error occurred while deleting the form.');
            setShowErrorDialog(true);
            setIsDeleting(false);
        }
        setShowDeleteConfirm(false);
    };

    if (isDeleting) {
        return (
            <div className="bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-red-100 shadow-sm flex flex-col items-center justify-center min-h-[200px] animate-pulse">
                <Trash2 className="text-red-300 mb-2" size={32} />
                <p className="text-red-300 font-bold">Deleting...</p>
            </div>
        );
    }

    return (
        <>
            <Link
                href={`/admin/forms/builder?id=${form.id}`}
                className="group bg-white dark:bg-neutral-900 p-6 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm hover:shadow-md transition-all duration-200 block relative"
            >
                {/* Delete Button */}
                <button
                    onClick={handleDeleteClick}
                    className="absolute top-4 right-4 p-2 bg-white dark:bg-neutral-900 rounded-full text-gray-400 dark:text-neutral-600 hover:text-red-500 hover:bg-red-50 transition-colors z-10 border-2 border-transparent hover:border-red-100"
                    title="Delete Form"
                >
                    <Trash2 size={18} />
                </button>

                {/* Status Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${form.isPublished ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-400 dark:text-neutral-600'}`}>
                    {form.isPublished ? 'Published' : 'Draft'}
                </div>

                <div className="w-12 h-12 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border border-gray-200 dark:border-neutral-700 flex items-center justify-center mb-4 text-brand-dark group-hover:bg-gray-100 dark:group-hover:bg-neutral-700 transition-colors mt-8">
                    <FileText size={24} strokeWidth={2.5} />
                </div>

                <h3 className="font-extrabold text-xl text-brand-dark mb-2 truncate pr-4">{form.title}</h3>
                <p className="text-gray-500 dark:text-neutral-500 font-medium text-sm mb-6 line-clamp-2">
                    {form.fields?.length || 0} fields • {form.buttonText}
                </p>

                <div className="border-t border-gray-100 dark:border-neutral-800/50 pt-4 flex items-center text-gray-400 dark:text-neutral-600 text-sm font-medium gap-2">
                    <Calendar size={16} />
                    <span suppressHydrationWarning>
                        {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : 'Unknown date'}
                    </span>
                </div>
            </Link>

            <ConfirmationDialog
                isOpen={showDeleteConfirm}
                title="Delete Form?"
                message={`Are you sure you want to delete "${form.title}"? This action cannot be undone.`}
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                confirmLabel="Delete Form"
                isLoading={isDeleting}
            />

            <AlertDialog
                isOpen={showErrorDialog}
                title="Cannot Delete Form"
                message={errorMessage}
                onClose={() => setShowErrorDialog(false)}
                variant="error"
            />
        </>
    );
};
