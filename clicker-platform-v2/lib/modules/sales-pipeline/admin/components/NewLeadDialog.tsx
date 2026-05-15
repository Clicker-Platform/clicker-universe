'use client';

import { useState } from 'react';
import { createLead } from '@/lib/modules/sales-pipeline/api';
import { toast } from 'sonner';
import { Loader2, X } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

interface NewLeadDialogProps {
    defaultStageId: string;
    isOpen: boolean;
    onClose: () => void;
}

export function NewLeadDialog({ defaultStageId, isOpen, onClose }: NewLeadDialogProps) {
    const { siteId } = useSite();
    const [name, setName] = useState('');
    const [contact, setContact] = useState('');
    const [value, setValue] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !contact) {
            toast.error("Name and Contact are required");
            return;
        }

        setIsSubmitting(true);
        try {
            if (!siteId) return;
            await createLead(siteId, {
                name,
                contact,
                stageId: defaultStageId,
                notes: '',
                source: 'Manual',
                value: value ? Number(value) : 0
            });
            toast.success("Lead created successfully");
            setName('');
            setContact('');
            setValue('');
            onClose();
        } catch (error) {
            toast.error("Failed to create lead");
            logger.error('sales-pipeline.lead.create.failed', { siteId, error });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div
                className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200"
                role="dialog"
            >
                <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                    <div>
                        <h3 className="font-bold text-lg leading-none">Add New Lead</h3>
                        <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Manually add a new potential customer.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-gray-600 dark:hover:text-neutral-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="new-name" className="text-sm font-medium text-gray-700 dark:text-neutral-300">Name</label>
                        <input
                            id="new-name"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm"
                            placeholder="e.g. Jane Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="new-contact" className="text-sm font-medium text-gray-700 dark:text-neutral-300">Contact</label>
                        <input
                            id="new-contact"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm"
                            placeholder="e.g. +1234567890"
                            value={contact}
                            onChange={(e) => setContact(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="new-value" className="text-sm font-medium text-gray-700 dark:text-neutral-300">Value (IDR)</label>
                        <input
                            id="new-value"
                            type="number"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm"
                            placeholder="e.g. 15000000"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-black hover:bg-gray-800 transition-colors flex items-center justify-center disabled:opacity-70"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Create Lead
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
