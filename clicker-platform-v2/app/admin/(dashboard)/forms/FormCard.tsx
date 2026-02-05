'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Calendar, Trash2 } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useRouter } from 'next/navigation';

import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { AlertDialog } from '@/components/common/AlertDialog';

interface FormCardProps {
    form: Form;
}

export const FormCard: React.FC<FormCardProps> = ({ form }) => {
    const router = useRouter();
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
            const res = await fetch(`/api/forms/delete?id=${form.id}`, { method: 'DELETE' });
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
            <div className="bg-white p-6 rounded-3xl border-[3px] border-red-100 shadow-sm flex flex-col items-center justify-center min-h-[200px] animate-pulse">
                <Trash2 className="text-red-300 mb-2" size={32} />
                <p className="text-red-300 font-bold">Deleting...</p>
            </div>
        );
    }

    return (
        <>
            <Link
                href={`/admin/forms/builder?id=${form.id}`}
                className="group bg-white p-6 rounded-3xl border-[3px] border-brand-dark shadow-sticker hover:shadow-sticker-hover transition-all duration-200 transform hover:-translate-y-1 block relative"
            >
                {/* Delete Button */}
                <button
                    onClick={handleDeleteClick}
                    className="absolute top-4 right-4 p-2 bg-white rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors z-10 border-2 border-transparent hover:border-red-100"
                    title="Delete Form"
                >
                    <Trash2 size={18} />
                </button>

                {/* Status Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide border-2 ${form.isPublished ? 'bg-brand-green border-brand-dark text-brand-dark' : 'bg-gray-100 border-gray-300 text-gray-400'}`}>
                    {form.isPublished ? 'Published' : 'Draft'}
                </div>

                <div className="w-12 h-12 bg-gray-50 rounded-2xl border-2 border-brand-dark flex items-center justify-center mb-4 text-brand-dark group-hover:bg-brand-green/20 transition-colors mt-8">
                    <FileText size={24} strokeWidth={2.5} />
                </div>

                <h3 className="font-extrabold text-xl text-brand-dark mb-2 truncate pr-4">{form.title}</h3>
                <p className="text-gray-500 font-medium text-sm mb-6 line-clamp-2">
                    {form.fields?.length || 0} fields • {form.buttonText}
                </p>

                <div className="border-t-2 border-gray-100 pt-4 flex items-center text-gray-400 text-sm font-bold gap-2">
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
