'use client';

import { useState, useEffect } from 'react';
import { FormIntegration, PipelineConfig, PipelineStage } from '@/lib/modules/sales-pipeline/types';
import { getAvailableForms, getPipelineConfig, savePipelineConfig } from '@/lib/modules/sales-pipeline/api';
import { Loader2, Plus, Trash2, X, Settings as SettingsIcon, Save, GripVertical, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { toast } from 'sonner';
import { useSite } from '@/lib/site-context';

interface SettingsDialogProps {
    isOpen: boolean;
    onClose: () => void;
    stages: PipelineStage[];
}

export function SettingsDialog({ isOpen, onClose, stages: initialStages }: SettingsDialogProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'integrations' | 'stages'>('integrations');
    const [config, setConfig] = useState<PipelineConfig | null>(null);
    const [availableForms, setAvailableForms] = useState<{ id: string, title: string, fields: { id: string, label: string }[] }[]>([]);

    const { siteId } = useSite();

    // New Integration Form State
    const [isAddingIntegration, setIsAddingIntegration] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [newIntegration, setNewIntegration] = useState<Partial<FormIntegration>>({
        fieldMapping: { name: '', contact: '' }
    });

    const selectedFormFields = availableForms.find(f => f.id === newIntegration.formId)?.fields || [];

    useEffect(() => {
        if (isOpen && siteId) {
            loadData();
        }
    }, [isOpen, siteId]);

    async function loadData() {
        if (!siteId) return;
        setIsLoading(true);
        try {
            const [fetchedConfig, forms] = await Promise.all([
                getPipelineConfig(siteId),
                getAvailableForms(siteId)
            ]);
            setConfig(fetchedConfig);
            setAvailableForms(forms);
        } catch (error) {
            console.error("Failed to load settings:", error);
            toast.error("Failed to load settings");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSaveIntegration() {
        if (!newIntegration.formId || !newIntegration.targetStageId || !newIntegration.fieldMapping?.name || !newIntegration.fieldMapping?.contact) {
            toast.error("Please fill in all required fields");
            return;
        }

        const newEntry: FormIntegration = newIntegration as FormIntegration;

        // Optimistic update
        const updatedConfig = { ...config! };
        let updatedIntegrations = [...(updatedConfig.formIntegrations || [])];

        if (editingIndex !== null) {
            // Update existing
            updatedIntegrations[editingIndex] = newEntry;
        } else {
            // Add new (remove existing if same formId to avoid dupes)
            updatedIntegrations = updatedIntegrations.filter(i => i.formId !== newEntry.formId);
            updatedIntegrations.push(newEntry);
        }

        updatedConfig.formIntegrations = updatedIntegrations;

        setConfig(updatedConfig);
        setIsAddingIntegration(false);
        setEditingIndex(null);
        setNewIntegration({ fieldMapping: { name: '', contact: '' } });

        // Save
        setIsSaving(true);
        try {
            if (siteId) {
                await savePipelineConfig(siteId, updatedConfig);
                toast.success(editingIndex !== null ? "Integration updated" : "Integration saved");
            }
        } catch (error) {
            toast.error("Failed to save configuration");
            loadData(); // Revert
        } finally {
            setIsSaving(false);
        }
    }

    const [integrationToDelete, setIntegrationToDelete] = useState<{ id: string, index: number } | null>(null);

    async function confirmDeleteIntegration() {
        if (!integrationToDelete) return;

        // Optimistic update
        const updatedConfig = { ...config! };
        updatedConfig.formIntegrations = updatedConfig.formIntegrations?.filter((_, idx) => idx !== integrationToDelete.index) || [];
        setConfig(updatedConfig);
        setIntegrationToDelete(null);

        // Save
        setIsSaving(true);
        try {
            if (siteId) {
                await savePipelineConfig(siteId, updatedConfig);
                toast.success("Integration removed");
            }
        } catch (error) {
            toast.error("Failed to save properties");
            loadData(); // Revert
        } finally {
            setIsSaving(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-brand-green/10 rounded-xl">
                            <SettingsIcon className="w-6 h-6 text-brand-dark" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-brand-dark">Pipeline Settings</h2>
                            <p className="text-sm text-gray-400 font-medium">Configure stages and integrations</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-100 px-6">
                    <button
                        onClick={() => setActiveTab('integrations')}
                        className={cn(
                            "px-4 py-3 text-sm font-bold border-b-2 transition-colors",
                            activeTab === 'integrations'
                                ? "border-brand-dark text-brand-dark"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        Form Integrations
                    </button>
                    <button
                        onClick={() => setActiveTab('stages')}
                        className={cn(
                            "px-4 py-3 text-sm font-bold border-b-2 transition-colors",
                            activeTab === 'stages'
                                ? "border-brand-dark text-brand-dark"
                                : "border-transparent text-gray-400 hover:text-gray-600"
                        )}
                    >
                        Pipeline Stages
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* --- TAB: STAGES --- */}
                            {activeTab === 'stages' && config && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-700">Manage Stages</h3>
                                        <button
                                            onClick={() => {
                                                const newStage: PipelineStage = {
                                                    id: `stage-${Date.now()}`,
                                                    name: 'New Stage',
                                                    order: (config.stages.length) + 1,
                                                    type: 'active',
                                                    color: '#000000'
                                                };
                                                setConfig({ ...config, stages: [...config.stages, newStage] });
                                            }}
                                            className="flex items-center gap-2 text-xs font-bold bg-brand-dark text-white px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add Stage
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {config.stages
                                            .sort((a, b) => a.order - b.order)
                                            .map((stage, idx) => (
                                                <div key={stage.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex items-center gap-3 group">
                                                    {/* Drag Handle (Visual Only for now) */}
                                                    <div className="text-gray-300 cursor-grab px-1">
                                                        <GripVertical className="w-4 h-4" />
                                                    </div>

                                                    {/* Color Indicator */}
                                                    <div className="w-3 h-8 rounded-full bg-brand-green/20" />

                                                    {/* Inputs */}
                                                    <div className="flex-1">
                                                        <input
                                                            value={stage.name}
                                                            onChange={(e) => {
                                                                const updatedStages = config.stages.map(s =>
                                                                    s.id === stage.id ? { ...s, name: e.target.value } : s
                                                                );
                                                                setConfig({ ...config, stages: updatedStages });
                                                            }}
                                                            className="w-full font-bold text-gray-800 bg-transparent outline-none focus:underline"
                                                            placeholder="Stage Name"
                                                        />
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            disabled={idx === 0}
                                                            onClick={() => {
                                                                const newStages = [...config.stages];
                                                                const temp = newStages[idx];
                                                                newStages[idx] = newStages[idx - 1];
                                                                newStages[idx - 1] = temp;
                                                                // Re-assign order based on index
                                                                newStages.forEach((s, i) => s.order = i);
                                                                setConfig({ ...config, stages: newStages });
                                                            }}
                                                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                        >
                                                            <ArrowUp className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            disabled={idx === config.stages.length - 1}
                                                            onClick={() => {
                                                                const newStages = [...config.stages];
                                                                const temp = newStages[idx];
                                                                newStages[idx] = newStages[idx + 1];
                                                                newStages[idx + 1] = temp;
                                                                newStages.forEach((s, i) => s.order = i);
                                                                setConfig({ ...config, stages: newStages });
                                                            }}
                                                            className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                                                        >
                                                            <ArrowDown className="w-4 h-4" />
                                                        </button>
                                                        <div className="w-px h-4 bg-gray-200 mx-1" />
                                                        <button
                                                            onClick={() => {
                                                                // Basic safety check could go here, relying on server/user for now
                                                                const newStages = config.stages.filter(s => s.id !== stage.id);
                                                                setConfig({ ...config, stages: newStages });
                                                            }}
                                                            className="p-1.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-500"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>

                                    <div className="mt-8 flex justify-end">
                                        <button
                                            onClick={async () => {
                                                if (!config || !siteId) return;
                                                setIsSaving(true);
                                                try {
                                                    await savePipelineConfig(siteId, config);
                                                    toast.success("Pipeline stages updated");
                                                } catch (err) {
                                                    toast.error("Failed to save changes");
                                                } finally {
                                                    setIsSaving(false);
                                                }
                                            }}
                                            disabled={isSaving}
                                            className="bg-brand-dark text-white font-bold py-3 px-8 rounded-xl shadow-lg hover:bg-gray-800 transition-all flex items-center gap-2"
                                        >
                                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                            Save Changes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* --- TAB: INTEGRATIONS --- */}
                            {activeTab === 'integrations' && !isAddingIntegration && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-bold text-gray-700">Active Integrations</h3>
                                        <button
                                            onClick={() => {
                                                setIsAddingIntegration(true);
                                                setEditingIndex(null);
                                                setNewIntegration({ fieldMapping: { name: '', contact: '' } });
                                            }}
                                            className="flex items-center gap-2 text-xs font-bold bg-brand-dark text-white px-3 py-1.5 rounded-lg hover:bg-black/80 transition-colors"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            Add New
                                        </button>
                                    </div>

                                    {config?.formIntegrations?.length === 0 ? (
                                        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
                                            <p className="text-gray-400 text-sm font-medium">No form integrations configured.</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {config?.formIntegrations?.map((integration, idx) => {
                                                const formName = availableForms.find(f => f.id === integration.formId)?.title || integration.formId;
                                                const stageName = initialStages.find(s => s.id === integration.targetStageId)?.name || integration.targetStageId;

                                                return (
                                                    <div key={`${integration.formId}-${idx}`} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-brand-dark">{formName}</span>
                                                                <span className="text-gray-300">→</span>
                                                                <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">{stageName}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400 font-mono">
                                                                Map: {integration.fieldMapping.name}, {integration.fieldMapping.contact}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => {
                                                                    setNewIntegration(integration);
                                                                    setEditingIndex(idx);
                                                                    setIsAddingIntegration(true);
                                                                }}
                                                                className="p-2 text-gray-300 hover:text-brand-primary hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit Integration"
                                                            >
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => setIntegrationToDelete({ id: integration.formId, index: idx })}
                                                                className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete Integration"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Add New Integration Form */}
                            {isAddingIntegration && (
                                <div className="bg-white p-6 rounded-2xl border-2 border-brand-green/20 shadow-sm animate-in fade-in slide-in-from-bottom-4">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="font-bold text-gray-800">{editingIndex !== null ? 'Edit Integration' : 'Add New Integration'}</h3>
                                        <button
                                            onClick={() => {
                                                setIsAddingIntegration(false);
                                                setEditingIndex(null);
                                                setNewIntegration({ fieldMapping: { name: '', contact: '' } });
                                            }}
                                            className="text-xs font-bold text-gray-400 hover:text-gray-600"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Form Selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Source Form</label>
                                            <select
                                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none transition-all"
                                                value={newIntegration.formId || ''}
                                                onChange={e => setNewIntegration({ ...newIntegration, formId: e.target.value })}
                                            >
                                                <option value="">Select a form...</option>
                                                {availableForms.map(f => (
                                                    <option key={f.id} value={f.id}>{f.title}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Stage Selection */}
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target Stage</label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {initialStages.map(stage => (
                                                    <button
                                                        key={stage.id}
                                                        onClick={() => setNewIntegration({ ...newIntegration, targetStageId: stage.id })}
                                                        className={cn(
                                                            "p-2 text-sm font-bold rounded-lg border text-left transition-all",
                                                            newIntegration.targetStageId === stage.id
                                                                ? "border-brand-green bg-brand-green/10 text-brand-dark"
                                                                : "border-gray-200 text-gray-500 hover:bg-gray-50"
                                                        )}
                                                    >
                                                        {stage.name}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Field Mapping */}
                                        <div className="pt-4 border-t border-gray-100">
                                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Field Mapping</label>

                                            {selectedFormFields.length > 0 ? (
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <span className="text-xs text-gray-400 block mb-1">Name Field *</span>
                                                        <select
                                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-brand-dark outline-none transition-all"
                                                            value={newIntegration.fieldMapping?.name || ''}
                                                            onChange={e => setNewIntegration({
                                                                ...newIntegration,
                                                                fieldMapping: { ...newIntegration.fieldMapping!, name: e.target.value }
                                                            })}
                                                        >
                                                            <option value="">Select field...</option>
                                                            {selectedFormFields.map(field => (
                                                                <option key={field.id} value={field.id}>{field.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <span className="text-xs text-gray-400 block mb-1">Contact Field *</span>
                                                        <select
                                                            className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium focus:border-brand-dark outline-none transition-all"
                                                            value={newIntegration.fieldMapping?.contact || ''}
                                                            onChange={e => setNewIntegration({
                                                                ...newIntegration,
                                                                fieldMapping: { ...newIntegration.fieldMapping!, contact: e.target.value }
                                                            })}
                                                        >
                                                            <option value="">Select field...</option>
                                                            {selectedFormFields.map(field => (
                                                                <option key={field.id} value={field.id}>{field.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="p-3 bg-yellow-50 text-yellow-700 text-xs rounded-lg border border-yellow-100">
                                                    Please select a valid source form above to see available fields.
                                                </div>
                                            )}

                                            <p className="text-[10px] text-gray-400 mt-2">
                                                Select the form fields that map to the lead's Name and Contact info.
                                            </p>
                                        </div>

                                        <button
                                            onClick={handleSaveIntegration}
                                            disabled={isSaving}
                                            className="w-full mt-4 py-3 bg-brand-dark text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors disabled:opacity-50"
                                        >
                                            {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {editingIndex !== null ? 'Update Integration' : 'Save Integration'}
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>
                    )}
                </div>
            </div>

            <ConfirmationDialog
                isOpen={!!integrationToDelete}
                title="Remove Integration?"
                message="This will stop new submissions from this form creating leads. Existing leads remain unchanged."
                confirmLabel="Remove"
                onConfirm={confirmDeleteIntegration}
                onCancel={() => setIntegrationToDelete(null)}
                isLoading={isSaving}
            />
        </div>
    );
}
