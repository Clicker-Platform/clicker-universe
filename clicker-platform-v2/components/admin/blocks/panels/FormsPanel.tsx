'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, addDoc, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Form, FormField } from '@/data/mockData';
import { Plus, Trash2, GripVertical, ArrowLeft, Save, FileText, Loader2, ChevronDown } from 'lucide-react';
import { useSite } from '@/lib/site-context';

// ── Shared styles ────────────────────────────────────────────────────────

const inputClass = "w-full px-3 py-2 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-lg text-sm text-neutral-900 dark:text-neutral-200 placeholder-neutral-400 dark:placeholder-neutral-600 focus:border-blue-500/50 focus:outline-none transition-colors";
const labelClass = "block text-xs font-medium text-neutral-400 dark:text-neutral-500 mb-1";

// ── Form List Item ───────────────────────────────────────────────────────

function FormListItem({ form, siteId, onEdit, onDelete }: { form: Form; siteId: string; onEdit: (f: Form) => void; onDelete: (id: string) => void }) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleDelete = async () => {
        setDeleting(true);
        setErrorMsg('');
        try {
            await deleteDoc(doc(db, 'sites', siteId, 'forms', form.id));
            onDelete(form.id);
        } catch {
            setErrorMsg('Delete failed');
            setConfirmDelete(false);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-neutral-800/50 rounded-lg group transition-colors">
            <div className="w-7 h-7 bg-gray-100 dark:bg-neutral-800 rounded-md flex items-center justify-center text-neutral-500 dark:text-neutral-400 flex-shrink-0">
                <FileText size={14} />
            </div>

            <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onEdit(form)}>
                <div className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">{form.title || 'Untitled'}</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase ${
                        form.isPublished
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-200 dark:bg-neutral-700 text-neutral-500'
                    }`}>
                        {form.isPublished ? 'Published' : 'Draft'}
                    </span>
                    <span className="text-[10px] text-neutral-400 dark:text-neutral-600">{form.fields?.length || 0} fields</span>
                </div>
            </div>

            {confirmDelete ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="px-2 py-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/30 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50"
                    >
                        {deleting ? '...' : 'Confirm'}
                    </button>
                    <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-2 py-1 text-[10px] font-bold text-neutral-400 bg-neutral-800 rounded-md hover:bg-neutral-700 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => onEdit(form)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                        <FileText size={13} />
                    </button>
                    <button onClick={() => setConfirmDelete(true)} className="p-1.5 text-neutral-400 dark:text-neutral-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-neutral-700 rounded-md transition-colors">
                        <Trash2 size={13} />
                    </button>
                </div>
            )}

            {errorMsg && (
                <span className="text-[10px] text-red-400 flex-shrink-0">{errorMsg}</span>
            )}
        </div>
    );
}

// ── Field Editor Card ────────────────────────────────────────────────────

function FieldCard({ field, index, onChange, onRemove }: {
    field: FormField;
    index: number;
    onChange: (updates: Partial<FormField>) => void;
    onRemove: () => void;
}) {
    const [collapsed, setCollapsed] = useState(false);

    return (
        <div className="bg-gray-100 dark:bg-neutral-800/50 rounded-lg border border-gray-200 dark:border-neutral-700/50 overflow-hidden">
            {/* Field header */}
            <div className="flex items-center gap-2 px-3 py-2">
                <GripVertical size={14} className="text-neutral-400 dark:text-neutral-600 flex-shrink-0" />
                <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex-1 flex items-center gap-2 text-left min-w-0"
                >
                    <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase">Field {index + 1}</span>
                    <span className="text-xs text-neutral-400 dark:text-neutral-500 truncate">{field.label}</span>
                    <ChevronDown size={12} className={`text-neutral-400 dark:text-neutral-600 transition-transform ml-auto flex-shrink-0 ${collapsed ? '-rotate-90' : ''}`} />
                </button>
                <button
                    type="button"
                    onClick={onRemove}
                    className="p-1 text-neutral-400 dark:text-neutral-600 hover:text-red-400 transition-colors flex-shrink-0"
                >
                    <Trash2 size={13} />
                </button>
            </div>

            {/* Field body */}
            {!collapsed && (
                <div className="px-3 pb-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className={labelClass}>Type</label>
                            <select
                                value={field.type}
                                onChange={e => onChange({ type: e.target.value as FormField['type'] })}
                                className={inputClass}
                            >
                                <option value="text">Text</option>
                                <option value="email">Email</option>
                                <option value="tel">Phone</option>
                                <option value="textarea">Long Text</option>
                                <option value="select">Dropdown</option>
                                <option value="file">File Upload</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>Label</label>
                            <input
                                type="text"
                                value={field.label}
                                onChange={e => onChange({ label: e.target.value })}
                                className={inputClass}
                            />
                        </div>
                    </div>

                    <div>
                        <label className={labelClass}>Placeholder</label>
                        <input
                            type="text"
                            value={field.placeholder || ''}
                            onChange={e => onChange({ placeholder: e.target.value })}
                            className={inputClass}
                            placeholder="Optional"
                        />
                    </div>

                    {field.type === 'select' && (
                        <div className="bg-amber-500/5 p-2.5 rounded-md border border-amber-500/20">
                            <label className="block text-xs font-medium text-amber-400 mb-1">Options (comma separated)</label>
                            <input
                                type="text"
                                value={field.options?.join(', ') || ''}
                                onChange={e => onChange({ options: e.target.value.split(',').map(s => s.trim()) })}
                                placeholder="Option 1, Option 2, Option 3"
                                className={inputClass}
                            />
                        </div>
                    )}

                    <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={field.required}
                            onChange={e => onChange({ required: e.target.checked })}
                            className="rounded border-gray-300 dark:border-neutral-600 bg-gray-100 dark:bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                        />
                        <span className="text-xs text-neutral-700 dark:text-neutral-300">Required field</span>
                    </label>
                </div>
            )}
        </div>
    );
}

// ── Main FormsPanel ──────────────────────────────────────────────────────

export function FormsPanel() {
    const { siteId } = useSite();
    const [forms, setForms] = useState<Form[]>([]);
    const [loading, setLoading] = useState(true);

    // Builder state
    const [view, setView] = useState<'list' | 'builder'>('list');
    const [editingForm, setEditingForm] = useState<Partial<Form>>({});
    const [editingId, setEditingId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    // ── Data fetching ─────────────────────────────────────────────────

    const fetchForms = useCallback(async () => {
        if (!siteId) return;
        try {
            const formsQuery = query(collection(db, 'sites', siteId, 'forms'), orderBy('createdAt', 'desc'));
            const snap = await getDocs(formsQuery);
            const fetched = snap.docs.map(d => {
                const data = d.data();
                const serializeDate = (ts: any) => {
                    if (!ts) return null;
                    if (typeof ts.toMillis === 'function') return ts.toMillis();
                    if (typeof ts.toDate === 'function') return ts.toDate().getTime();
                    if (ts.seconds) return ts.seconds * 1000;
                    return null;
                };
                return {
                    id: d.id,
                    ...data,
                    createdAt: serializeDate(data.createdAt),
                    updatedAt: serializeDate(data.updatedAt),
                } as unknown as Form;
            });
            setForms(fetched);
        } catch (error) {
            console.error('Error fetching forms:', error);
        } finally {
            setLoading(false);
        }
    }, [siteId]);

    useEffect(() => { fetchForms(); }, [fetchForms]);

    // ── Builder actions ───────────────────────────────────────────────

    const openBuilder = (form?: Form) => {
        if (form) {
            setEditingForm({ ...form });
            setEditingId(form.id);
        } else {
            setEditingForm({
                title: 'New Form',
                buttonText: 'Submit',
                isPublished: false,
                fields: [],
                emailNotificationTo: '',
            });
            setEditingId(null);
        }
        setView('builder');
    };

    const handleSave = async () => {
        if (!siteId || !editingForm.title) return;
        setSaving(true);
        try {
            const { id, createdAt, updatedAt, ...data } = editingForm as any;
            if (editingId) {
                await updateDoc(doc(db, 'sites', siteId, 'forms', editingId), {
                    ...data,
                    updatedAt: serverTimestamp(),
                });
            } else {
                await addDoc(collection(db, 'sites', siteId, 'forms'), {
                    ...data,
                    createdAt: serverTimestamp(),
                });
            }
            setView('list');
            setEditingForm({});
            setEditingId(null);
            fetchForms();
        } catch (error) {
            console.error('Error saving form:', error);
        } finally {
            setSaving(false);
        }
    };

    const addField = () => {
        const newField: FormField = {
            id: Date.now().toString(),
            type: 'text',
            label: 'New Field',
            placeholder: '',
            required: false,
            options: [],
        };
        setEditingForm(prev => ({ ...prev, fields: [...(prev.fields || []), newField] }));
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setEditingForm(prev => ({
            ...prev,
            fields: prev.fields?.map(f => f.id === id ? { ...f, ...updates } : f),
        }));
    };

    const removeField = (id: string) => {
        setEditingForm(prev => ({
            ...prev,
            fields: prev.fields?.filter(f => f.id !== id),
        }));
    };

    const handleDeleteFromList = (id: string) => {
        setForms(prev => prev.filter(f => f.id !== id));
    };

    // ── Render ────────────────────────────────────────────────────────

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 text-neutral-500">
                <Loader2 size={20} className="animate-spin" />
            </div>
        );
    }

    // ── Builder View ──────────────────────────────────────────────────

    if (view === 'builder') {
        return (
            <div className="flex flex-col h-full">
                {/* Toolbar */}
                <div className="px-3 py-2 border-b border-gray-200 dark:border-neutral-800 flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={() => { setView('list'); setEditingForm({}); setEditingId(null); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-gray-300 dark:border-neutral-700 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                    >
                        <ArrowLeft size={13} /> Back
                    </button>
                    <div className="flex-1" />
                    <button
                        onClick={handleSave}
                        disabled={saving || !editingForm.title}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        {saving ? 'Saving...' : 'Save'}
                    </button>
                </div>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="p-3 space-y-4">
                        {/* General Settings */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">General</h3>
                            <div>
                                <label className={labelClass}>Form Title</label>
                                <input
                                    type="text"
                                    value={editingForm.title || ''}
                                    onChange={e => setEditingForm(prev => ({ ...prev, title: e.target.value }))}
                                    className={inputClass}
                                    placeholder="Form Title"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Button Text</label>
                                <input
                                    type="text"
                                    value={editingForm.buttonText || ''}
                                    onChange={e => setEditingForm(prev => ({ ...prev, buttonText: e.target.value }))}
                                    className={inputClass}
                                    placeholder="Submit"
                                />
                            </div>
                            <div>
                                <label className={labelClass}>Notification Email (optional)</label>
                                <input
                                    type="email"
                                    value={editingForm.emailNotificationTo || ''}
                                    onChange={e => setEditingForm(prev => ({ ...prev, emailNotificationTo: e.target.value }))}
                                    className={inputClass}
                                    placeholder="you@example.com"
                                />
                            </div>
                            <label className="flex items-center gap-2.5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={editingForm.isPublished || false}
                                    onChange={e => setEditingForm(prev => ({ ...prev, isPublished: e.target.checked }))}
                                    className="rounded border-neutral-600 bg-neutral-800 text-blue-500 focus:ring-blue-500/30"
                                />
                                <span className="text-xs text-neutral-300">Published</span>
                            </label>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-gray-200 dark:border-neutral-800" />

                        {/* Fields */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Fields</h3>
                                <button
                                    onClick={addField}
                                    className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-neutral-700 dark:text-neutral-300 bg-gray-100 dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 rounded-md hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                                >
                                    <Plus size={11} /> Add Field
                                </button>
                            </div>

                            {(editingForm.fields?.length || 0) === 0 ? (
                                <div className="text-center py-8 text-neutral-400 dark:text-neutral-600 text-xs">
                                    No fields yet. Click "Add Field" to start building your form.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {editingForm.fields?.map((field, index) => (
                                        <FieldCard
                                            key={field.id}
                                            field={field}
                                            index={index}
                                            onChange={(updates) => updateField(field.id, updates)}
                                            onRemove={() => removeField(field.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── List View ─────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="px-3 py-2 border-b border-neutral-800 flex items-center gap-2 flex-shrink-0">
                <button
                    onClick={() => openBuilder()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-neutral-800 text-neutral-300 border border-neutral-700 hover:bg-neutral-700 transition-colors"
                >
                    <Plus size={13} /> Create Form
                </button>
                <div className="flex-1" />
                <span className="text-[10px] text-neutral-400 dark:text-neutral-600 font-medium">{forms.length} forms</span>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="py-1">
                    {forms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-500 gap-2">
                            <FileText size={24} className="opacity-20" />
                            <p className="text-xs">No forms yet</p>
                            <button
                                onClick={() => openBuilder()}
                                className="text-xs text-blue-400 hover:text-blue-300 font-bold"
                            >
                                Create your first form
                            </button>
                        </div>
                    ) : (
                        forms.map(form => (
                            <FormListItem
                                key={form.id}
                                form={form}
                                siteId={siteId!}
                                onEdit={openBuilder}
                                onDelete={handleDeleteFromList}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
