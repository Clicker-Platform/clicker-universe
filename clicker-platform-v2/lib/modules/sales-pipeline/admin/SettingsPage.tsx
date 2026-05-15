'use client';

import { useCallback, useEffect, useState } from 'react';
import { getPipelineConfig, savePipelineConfig, getAvailableForms } from '@/lib/modules/sales-pipeline/api';
import { FormIntegration, PipelineConfig, PipelineStage } from '@/lib/modules/sales-pipeline/types';
import { useSite } from '@/lib/site-context';
import { Loader2, Plus, Trash2, Save, ArrowUp, ArrowDown, GripVertical, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { toast } from 'sonner';

export default function SettingsPage() {
    const { siteId } = useSite();
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'integrations' | 'stages'>('integrations');
    const [config, setConfig] = useState<PipelineConfig | null>(null);
    const [availableForms, setAvailableForms] = useState<{ id: string, title: string, fields: { id: string, label: string }[] }[]>([]);
    const [isAddingIntegration, setIsAddingIntegration] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [newIntegration, setNewIntegration] = useState<Partial<FormIntegration>>({ fieldMapping: { name: '', contact: '' } });
    const [integrationToDelete, setIntegrationToDelete] = useState<{ id: string, index: number } | null>(null);

    const selectedFormFields = availableForms.find(f => f.id === newIntegration.formId)?.fields || [];

    const loadData = useCallback(async () => {
        if (!siteId) return;
        setIsLoading(true);
        try {
            const [fetchedConfig, forms] = await Promise.all([getPipelineConfig(siteId), getAvailableForms(siteId)]);
            setConfig(fetchedConfig);
            setAvailableForms(forms);
        } catch {
            toast.error("Failed to load settings");
        } finally {
            setIsLoading(false);
        }
    }, [siteId]);

    useEffect(() => {
        if (siteId) loadData();
    }, [siteId, loadData]);

    async function handleSaveIntegration() {
        if (!newIntegration.formId || !newIntegration.targetStageId || !newIntegration.fieldMapping?.name || !newIntegration.fieldMapping?.contact) {
            toast.error("Please fill in all required fields");
            return;
        }
        const newEntry: FormIntegration = newIntegration as FormIntegration;
        const updatedConfig = { ...config! };
        let updatedIntegrations = [...(updatedConfig.formIntegrations || [])];
        if (editingIndex !== null) {
            updatedIntegrations[editingIndex] = newEntry;
        } else {
            updatedIntegrations = updatedIntegrations.filter(i => i.formId !== newEntry.formId);
            updatedIntegrations.push(newEntry);
        }
        updatedConfig.formIntegrations = updatedIntegrations;
        setConfig(updatedConfig);
        setIsAddingIntegration(false);
        setEditingIndex(null);
        setNewIntegration({ fieldMapping: { name: '', contact: '' } });
        setIsSaving(true);
        try {
            if (siteId) {
                await savePipelineConfig(siteId, updatedConfig);
                toast.success(editingIndex !== null ? "Integration updated" : "Integration saved");
            }
        } catch {
            toast.error("Failed to save configuration");
            loadData();
        } finally {
            setIsSaving(false);
        }
    }

    async function confirmDeleteIntegration() {
        if (!integrationToDelete) return;
        const updatedConfig = { ...config! };
        updatedConfig.formIntegrations = updatedConfig.formIntegrations?.filter((_, idx) => idx !== integrationToDelete.index) || [];
        setConfig(updatedConfig);
        setIntegrationToDelete(null);
        setIsSaving(true);
        try {
            if (siteId) {
                await savePipelineConfig(siteId, updatedConfig);
                toast.success("Integration removed");
            }
        } catch {
            toast.error("Failed to save changes");
            loadData();
        } finally {
            setIsSaving(false);
        }
    }

    if (isLoading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl">
            <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
                <div className="p-6 border-b border-gray-100 dark:border-neutral-800">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-200">Pipeline Settings</h2>
                    <p className="text-sm text-gray-400 dark:text-neutral-600 font-medium mt-0.5">Configure stages and form integrations</p>
                </div>

                <div className="flex border-b border-gray-100 dark:border-neutral-800 px-6">
                    <button onClick={() => setActiveTab('integrations')} className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'integrations' ? "border-brand-dark dark:border-neutral-400 text-brand-dark dark:text-neutral-200" : "border-transparent text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400")}>
                        Form Integrations
                    </button>
                    <button onClick={() => setActiveTab('stages')} className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors", activeTab === 'stages' ? "border-brand-dark dark:border-neutral-400 text-brand-dark dark:text-neutral-200" : "border-transparent text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-400")}>
                        Pipeline Stages
                    </button>
                </div>

                <div className="p-6 bg-gray-50/50 dark:bg-neutral-900/50">
                    <div className="space-y-6">
                        {activeTab === 'stages' && config && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-neutral-300">Manage Stages</h3>
                                    <button onClick={() => { const newStage: PipelineStage = { id: `stage-${Date.now()}`, name: 'New Stage', order: config.stages.length, type: 'active', color: '#000000' }; setConfig({ ...config, stages: [...config.stages, newStage] }); }} className="flex items-center gap-2 text-xs font-bold bg-studio-blue text-white px-3 py-1.5 rounded-lg hover:bg-studio-blue/85 transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Add Stage
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {config.stages.sort((a, b) => a.order - b.order).map((stage, idx) => (
                                        <div key={stage.id} className="bg-white dark:bg-neutral-800 p-3 rounded-lg border border-gray-200 dark:border-neutral-700 flex items-center gap-3 group">
                                            <div className="text-gray-300 dark:text-neutral-700 cursor-grab px-1"><GripVertical className="w-4 h-4" /></div>
                                            <div className="w-3 h-8 rounded-full bg-brand-green/20" />
                                            <div className="flex-1">
                                                <input value={stage.name} onChange={(e) => { const updatedStages = config.stages.map(s => s.id === stage.id ? { ...s, name: e.target.value } : s); setConfig({ ...config, stages: updatedStages }); }} className="w-full font-bold text-gray-800 dark:text-neutral-200 bg-transparent outline-none focus:underline" placeholder="Stage Name" />
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button disabled={idx === 0} onClick={() => { const s = [...config.stages]; [s[idx], s[idx - 1]] = [s[idx - 1], s[idx]]; s.forEach((x, i) => x.order = i); setConfig({ ...config, stages: s }); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded text-gray-400 disabled:opacity-30"><ArrowUp className="w-4 h-4" /></button>
                                                <button disabled={idx === config.stages.length - 1} onClick={() => { const s = [...config.stages]; [s[idx], s[idx + 1]] = [s[idx + 1], s[idx]]; s.forEach((x, i) => x.order = i); setConfig({ ...config, stages: s }); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded text-gray-400 disabled:opacity-30"><ArrowDown className="w-4 h-4" /></button>
                                                <div className="w-px h-4 bg-gray-200 dark:bg-neutral-700 mx-1" />
                                                <button onClick={() => setConfig({ ...config, stages: config.stages.filter(s => s.id !== stage.id) })} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex justify-end pt-2">
                                    <button onClick={async () => { if (!config || !siteId) return; setIsSaving(true); try { await savePipelineConfig(siteId, config); toast.success("Pipeline stages updated"); } catch { toast.error("Failed to save changes"); } finally { setIsSaving(false); } }} disabled={isSaving} className="bg-studio-blue text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-studio-blue/85 transition-all flex items-center gap-2">
                                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'integrations' && !isAddingIntegration && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-neutral-300">Active Integrations</h3>
                                    <button onClick={() => { setIsAddingIntegration(true); setEditingIndex(null); setNewIntegration({ fieldMapping: { name: '', contact: '' } }); }} className="flex items-center gap-2 text-xs font-bold bg-studio-blue text-white px-3 py-1.5 rounded-lg hover:bg-studio-blue/85 transition-colors">
                                        <Plus className="w-3.5 h-3.5" /> Add New
                                    </button>
                                </div>
                                {!config?.formIntegrations?.length ? (
                                    <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-neutral-700 rounded-lg">
                                        <p className="text-gray-400 dark:text-neutral-600 text-sm font-medium">No form integrations configured.</p>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {config.formIntegrations.map((integration, idx) => {
                                            const formName = availableForms.find(f => f.id === integration.formId)?.title || integration.formId;
                                            const stageName = config.stages.find(s => s.id === integration.targetStageId)?.name || integration.targetStageId;
                                            return (
                                                <div key={`${integration.formId}-${idx}`} className="bg-white dark:bg-neutral-800 p-4 rounded-lg border border-gray-100 dark:border-neutral-700 flex items-center justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-brand-dark dark:text-neutral-200">{formName}</span>
                                                            <span className="text-gray-300 dark:text-neutral-700">→</span>
                                                            <span className="text-xs font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">{stageName}</span>
                                                        </div>
                                                        <p className="text-xs text-gray-400 dark:text-neutral-600 font-mono">Map: {integration.fieldMapping.name}, {integration.fieldMapping.contact}</p>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button onClick={() => { setNewIntegration(integration); setEditingIndex(idx); setIsAddingIntegration(true); }} className="p-2 text-gray-300 hover:text-brand-primary hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                                                        <button onClick={() => setIntegrationToDelete({ id: integration.formId, index: idx })} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {isAddingIntegration && (
                            <div className="bg-white dark:bg-neutral-800 p-6 rounded-lg border-2 border-brand-green/20">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-bold text-gray-800 dark:text-neutral-200">{editingIndex !== null ? 'Edit Integration' : 'Add New Integration'}</h3>
                                    <button onClick={() => { setIsAddingIntegration(false); setEditingIndex(null); setNewIntegration({ fieldMapping: { name: '', contact: '' } }); }} className="text-xs font-bold text-gray-400 hover:text-gray-600">Cancel</button>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Source Form</label>
                                        <select className="w-full p-3 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 rounded-lg font-medium focus:ring-2 focus:ring-brand-green/20 focus:border-brand-green outline-none" value={newIntegration.formId || ''} onChange={e => setNewIntegration({ ...newIntegration, formId: e.target.value })}>
                                            <option value="">Select a form...</option>
                                            {availableForms.map(f => (<option key={f.id} value={f.id}>{f.title}</option>))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Target Stage</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {config?.stages.map(stage => (
                                                <button key={stage.id} onClick={() => setNewIntegration({ ...newIntegration, targetStageId: stage.id })} className={cn("p-2 text-sm font-bold rounded-lg border text-left transition-all", newIntegration.targetStageId === stage.id ? "border-brand-green bg-brand-green/10 text-brand-dark" : "border-gray-200 dark:border-neutral-700 text-gray-500 hover:bg-gray-50 dark:hover:bg-neutral-800")}>
                                                    {stage.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="pt-4 border-t border-gray-100 dark:border-neutral-700">
                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Field Mapping</label>
                                        {selectedFormFields.length > 0 ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="text-xs text-gray-400 block mb-1">Name Field *</span>
                                                    <select className="w-full p-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 rounded-lg text-sm font-medium focus:border-brand-dark outline-none" value={newIntegration.fieldMapping?.name || ''} onChange={e => setNewIntegration({ ...newIntegration, fieldMapping: { ...newIntegration.fieldMapping!, name: e.target.value } })}>
                                                        <option value="">Select field...</option>
                                                        {selectedFormFields.map(field => (<option key={field.id} value={field.id}>{field.label}</option>))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <span className="text-xs text-gray-400 block mb-1">Contact Field *</span>
                                                    <select className="w-full p-2.5 bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 dark:text-neutral-200 rounded-lg text-sm font-medium focus:border-brand-dark outline-none" value={newIntegration.fieldMapping?.contact || ''} onChange={e => setNewIntegration({ ...newIntegration, fieldMapping: { ...newIntegration.fieldMapping!, contact: e.target.value } })}>
                                                        <option value="">Select field...</option>
                                                        {selectedFormFields.map(field => (<option key={field.id} value={field.id}>{field.label}</option>))}
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 text-xs rounded-lg border border-yellow-100">
                                                Please select a valid source form above to see available fields.
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={handleSaveIntegration} disabled={isSaving} className="w-full mt-4 py-3 bg-studio-blue text-white rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-studio-blue/85 transition-colors disabled:opacity-50">
                                        {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {editingIndex !== null ? 'Update Integration' : 'Save Integration'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ConfirmationDialog isOpen={!!integrationToDelete} title="Remove Integration?" message="This will stop new submissions from this form creating leads. Existing leads remain unchanged." confirmLabel="Remove" onConfirm={confirmDeleteIntegration} onCancel={() => setIntegrationToDelete(null)} isLoading={isSaving} />
        </div>
    );
}
