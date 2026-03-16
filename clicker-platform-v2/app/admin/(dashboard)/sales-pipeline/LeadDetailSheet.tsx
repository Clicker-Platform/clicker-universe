'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Lead, PipelineStage } from '@/lib/modules/sales-pipeline/types';
import { updateLead } from '@/lib/modules/sales-pipeline/api';
import { Loader2, Trash2, X, Calendar, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useSite } from '@/lib/site-context';

interface LeadDetailSheetProps {
    lead: Lead | null;
    stages: PipelineStage[];
    isOpen: boolean;
    onClose: () => void;
}

export function LeadDetailSheet({ lead, stages, isOpen, onClose }: LeadDetailSheetProps) {
    const { siteId } = useSite();
    const [formData, setFormData] = useState<Partial<Lead>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (lead) {
            setFormData(lead);
        } else {
            setFormData({});
        }
    }, [lead]);

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    const handleSave = async () => {
        if (!lead || !formData.name) return;

        setIsSaving(true);
        try {
            if (!siteId) return;
            await updateLead(siteId, lead.id, formData);
            toast.success("Lead updated successfully");
            onClose();
        } catch (error) {
            toast.error("Failed to update lead");
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    if (!lead && !isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 transition-opacity animate-in fade-in"
                    onClick={onClose}
                />
            )}

            {/* Slide-over panel */}
            <div className={cn(
                "fixed inset-y-0 right-0 z-50 w-full sm:max-w-md bg-white dark:bg-neutral-900 shadow-xl transition-transform duration-300 ease-in-out transform",
                isOpen ? "translate-x-0" : "translate-x-full"
            )}>
                <div className="h-full flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900 dark:text-neutral-100">Lead Details</h2>
                            {lead && <p className="text-xs text-gray-500 dark:text-neutral-500">Created {format(lead.createdAt, 'PPP')}</p>}
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-neutral-500 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Name</label>
                                <input
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Contact Info</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400 dark:text-neutral-600" />
                                    <input
                                        className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm"
                                        value={formData.contact || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, contact: e.target.value }))}
                                        placeholder="Phone or Email"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Value (IDR)</label>
                                    <input
                                        type="number"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm"
                                        value={formData.value || ''}
                                        onChange={(e) => setFormData(prev => ({ ...prev, value: Number(e.target.value) }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Stage</label>
                                    <select
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm bg-white dark:bg-neutral-800"
                                        value={formData.stageId}
                                        onChange={(e) => setFormData(prev => ({ ...prev, stageId: e.target.value }))}
                                    >
                                        {stages.map(stage => (
                                            <option key={stage.id} value={stage.id}>
                                                {stage.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="h-px bg-gray-100 dark:bg-neutral-800 my-4" />

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-neutral-300">Notes</label>
                                <textarea
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5 dark:focus:ring-white/5 text-sm min-h-[150px] resize-none"
                                    placeholder="Add notes..."
                                    value={formData.notes || ''}
                                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-800/50 flex justify-end gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-black dark:bg-neutral-800 hover:bg-gray-800 dark:hover:bg-neutral-700 transition-colors flex items-center shadow-sm disabled:opacity-70"
                        >
                            {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
