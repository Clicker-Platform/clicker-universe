'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, FormField } from '@/data/mockData';
import { Plus, Trash2, Save, ArrowLeft, GripVertical, Settings } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';

interface FormBuilderClientProps {
    initialForm?: Form;
}

export function FormBuilderClient({ initialForm }: FormBuilderClientProps) {
    const router = useRouter();
    const { siteId } = useSite();
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState<Partial<Form>>(initialForm || {
        title: 'New Form',
        buttonText: 'Submit',
        isPublished: false,
        fields: [],
        emailNotificationTo: ''
    });

    const addField = () => {
        const newField: FormField = {
            id: Date.now().toString(),
            type: 'text',
            label: 'New Field',
            placeholder: '',
            required: false,
            options: [] // Initialize options for Select fields
        };
        setForm(prev => ({ ...prev, fields: [...(prev.fields || []), newField] }));
    };

    const updateField = (id: string, updates: Partial<FormField>) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields?.map(f => f.id === id ? { ...f, ...updates } : f)
        }));
    };

    const removeField = (id: string) => {
        setForm(prev => ({
            ...prev,
            fields: prev.fields?.filter(f => f.id !== id)
        }));
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const endpoint = initialForm ? '/api/forms/update' : '/api/forms/create';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, siteId })
            });

            if (res.ok) {
                router.push('/admin/forms');
                router.refresh();
            } else {
                alert('Error saving form');
            }
        } catch (error) {
            logger.error('admin.form.save.failed', { siteId, error });
            alert('Error saving form');
        }
        setLoading(false);
    };

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 bg-white dark:bg-neutral-900 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">
                            {initialForm ? 'Edit Form' : 'Create Form'}
                        </h1>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={loading}
                    className="inline-flex items-center gap-2 bg-studio-blue text-white px-6 py-3 rounded-lg font-bold hover:bg-studio-blue/85 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Save size={20} />
                    {loading ? 'Saving...' : 'Save Form'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Settings & Fields */}
                <div className="lg:col-span-2 space-y-8">
                    {/* General Settings */}
                    <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-200 mb-4 flex items-center gap-2">
                            <Settings size={20} /> General Settings
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Form Title</label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 focus:ring-0 transition-colors font-bold"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Button Text</label>
                                <input
                                    type="text"
                                    value={form.buttonText}
                                    onChange={e => setForm(prev => ({ ...prev, buttonText: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 focus:ring-0 transition-colors"
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.isPublished}
                                        onChange={e => setForm(prev => ({ ...prev, isPublished: e.target.checked }))}
                                        className="w-5 h-5 rounded-md border border-gray-300 dark:border-neutral-700 text-brand-green focus:ring-brand-green"
                                    />
                                    <span className="font-bold text-gray-700 dark:text-neutral-300">Published</span>
                                </label>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">Notification Email (Optional)</label>
                                <input
                                    type="email"
                                    value={form.emailNotificationTo || ''}
                                    onChange={e => setForm(prev => ({ ...prev, emailNotificationTo: e.target.value }))}
                                    placeholder="Enter email to receive alerts"
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 focus:ring-0 transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Fields Editor */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-800 dark:text-neutral-200">Form Fields</h2>
                            <button
                                onClick={addField}
                                className="inline-flex items-center gap-2 bg-gray-100 dark:bg-neutral-800 text-brand-dark px-4 py-2 rounded-lg font-bold hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
                            >
                                <Plus size={18} /> Add Field
                            </button>
                        </div>

                        {form.fields?.map((field, index) => (
                            <div key={field.id} className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 group">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-2 text-gray-400 dark:text-neutral-600">
                                        <GripVertical size={20} className="cursor-move" />
                                        <span className="font-bold text-xs uppercase">Field {index + 1}</span>
                                    </div>
                                    <button onClick={() => removeField(field.id)} className="text-gray-400 dark:text-neutral-600 hover:text-red-500 transition-colors">
                                        <Trash2 size={20} />
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 mb-1 uppercase">Type</label>
                                        <select
                                            value={field.type}
                                            onChange={e => updateField(field.id, { type: e.target.value as any })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400 bg-gray-50 font-medium"
                                        >
                                            <option value="text">Text Input</option>
                                            <option value="email">Email</option>
                                            <option value="tel">Phone</option>
                                            <option value="textarea">Long Text</option>
                                            <option value="select">Dropdown</option>
                                            <option value="file">File Upload</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 mb-1 uppercase">Label</label>
                                        <input
                                            type="text"
                                            value={field.label}
                                            onChange={e => updateField(field.id, { label: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400"
                                        />
                                    </div>
                                    <div className="col-span-1 md:col-span-2">
                                        <label className="block text-xs font-bold text-gray-500 dark:text-neutral-500 mb-1 uppercase">Placeholder</label>
                                        <input
                                            type="text"
                                            value={field.placeholder || ''}
                                            onChange={e => updateField(field.id, { placeholder: e.target.value })}
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-gray-400"
                                        />
                                    </div>

                                    {/* Dropdown Options Editor */}
                                    {field.type === 'select' && (
                                        <div className="col-span-1 md:col-span-2 bg-yellow-50 dark:bg-yellow-950/30 p-4 rounded-lg border border-yellow-100">
                                            <label className="block text-xs font-bold text-yellow-700 dark:text-amber-400 mb-1 uppercase">Options (comma separated)</label>
                                            <input
                                                type="text"
                                                value={field.options?.join(', ') || ''}
                                                onChange={e => updateField(field.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                                                placeholder="Option 1, Option 2, Option 3"
                                                className="w-full px-3 py-2 rounded-lg border border-yellow-200 focus:border-yellow-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                                            />
                                        </div>
                                    )}

                                    <div className="col-span-1 md:col-span-2 pt-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={field.required}
                                                onChange={e => updateField(field.id, { required: e.target.checked })}
                                                className="w-4 h-4 rounded border border-gray-300 dark:border-neutral-700 text-brand-dark focus:ring-gray-400"
                                            />
                                            <span className="font-medium text-sm text-gray-600 dark:text-neutral-400">Required field</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column: Preview */}
                <div className="lg:col-span-1">
                    <div className="sticky top-8">
                        <h2 className="text-xs font-semibold text-gray-400 dark:text-neutral-600 uppercase tracking-widest mb-4 text-center">Live Preview</h2>
                        <div className="bg-white dark:bg-neutral-900 p-6 rounded-lg border border-gray-200 dark:border-neutral-800 min-h-[400px] flex flex-col relative overflow-hidden">
                            {/* Decorative Header */}
                            <div className="absolute top-0 inset-x-0 h-2 bg-brand-green"></div>

                            <div className="mb-6">
                                <h3 className="font-extrabold text-2xl text-brand-dark leading-tight mb-2">{form.title || 'Untitled Form'}</h3>
                                <p className="text-gray-500 dark:text-neutral-500 text-sm">Fill out the details below.</p>
                            </div>

                            <div className="space-y-4 flex-1">
                                {form.fields?.map(field => (
                                    <div key={field.id}>
                                        <label className="block text-sm font-bold text-gray-700 dark:text-neutral-300 mb-1">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {field.type === 'textarea' ? (
                                            <textarea
                                                placeholder={field.placeholder}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 bg-gray-50 resize-none h-24"
                                                readOnly
                                            ></textarea>
                                        ) : field.type === 'select' ? (
                                            <select className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 bg-gray-50" disabled>
                                                <option value="">Select option...</option>
                                                {field.options?.map(opt => <option key={opt}>{opt}</option>)}
                                            </select>
                                        ) : field.type === 'file' ? (
                                            <div className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 bg-gray-50 flex items-center gap-2 text-gray-500 dark:text-neutral-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                                <span className="text-sm">Choose File...</span>
                                            </div>
                                        ) : (
                                            <input
                                                type={field.type}
                                                placeholder={field.placeholder}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 bg-gray-50"
                                                readOnly
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8">
                                <button className="w-full bg-studio-blue text-white font-bold py-3 rounded-lg shadow-lg opacity-90 cursor-default">
                                    {form.buttonText || 'Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
