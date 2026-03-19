'use client';

import React, { useState } from 'react';
import { X, CheckCircle, Loader } from 'lucide-react';
import { Form, FormField } from '@/data/mockData';
import { FormFileField } from '@/components/FormFileField';
import { useTemplate } from '@/components/TemplateProvider';



interface FormModalProps {
    form: Form;
    isOpen: boolean;
    onClose: () => void;
    siteId?: string;
}

export const FormModal: React.FC<FormModalProps> = ({ form, isOpen, onClose, siteId }) => {
    const { theme } = useTemplate();
    const isGlass = theme.cardStyle === 'glass';
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});

    if (!isOpen) return null;
    if (form.isPublished === false) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const res = await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: form.id,
                    formTitle: form.title,
                    data: formData,
                    siteId,
                    fieldLabels: form.fields?.reduce((acc, f) => ({ ...acc, [f.id]: f.label }), {})
                })
            });
            if (!res.ok) throw new Error('Submission failed');
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
                setFormData({});
            }, 2000);
        } catch (error) {
            console.error('Submission error:', error);
            alert('Something went wrong. Please try again.');
        }
        setSubmitting(false);
    };

    const handleChange = (fieldId: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldId]: value }));
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div
                className={`relative rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 ${
                    isGlass
                        ? 'border border-white/10 backdrop-blur-xl'
                        : 'bg-white'
                }`}
                style={isGlass ? { background: 'rgba(26, 26, 26, 0.85)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' } : undefined}
            >
                {!success && (
                    <button
                        onClick={onClose}
                        className={`absolute top-4 right-4 z-10 transition-colors ${
                            isGlass ? 'text-white/40 hover:text-white/80' : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <X size={24} />
                    </button>
                )}

                {success ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mb-6 animate-bounce"
                            style={isGlass ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                        >
                            <CheckCircle size={32} className={isGlass ? 'text-white' : 'text-brand-dark'} />
                        </div>
                        <h2 className={`text-2xl font-black mb-2 ${isGlass ? 'text-white' : 'text-brand-dark'}`}>Sent!</h2>
                        <p className={`font-bold ${isGlass ? 'text-white/60' : 'text-gray-500'}`}>Thanks for reaching out.</p>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="text-center mb-8">
                            <h2
                                className={`text-2xl font-black uppercase tracking-tight mb-2 ${
                                    isGlass ? 'text-white' : 'text-brand-dark'
                                }`}
                                style={isGlass ? { color: 'var(--theme-primary)' } : undefined}
                            >
                                {form.title}
                            </h2>
                            <p className={`font-medium text-sm ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>Fill out the form below.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {form.fields.map((field) => (
                                <div key={field.id}>
                                    {field.type !== 'file' && (
                                        <label className={`block text-sm font-bold mb-1 ${
                                            isGlass ? 'text-white/80' : 'text-gray-700'
                                        }`}>
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                    )}

                                    {field.type === 'textarea' ? (
                                        <textarea
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ''}
                                            onChange={e => handleChange(field.id, e.target.value)}
                                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium resize-none h-32 ${
                                                isGlass
                                                    ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
                                                    : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark'
                                            }`}
                                        />
                                    ) : field.type === 'select' ? (
                                        <select
                                            required={field.required}
                                            value={formData[field.id] || ''}
                                            onChange={e => handleChange(field.id, e.target.value)}
                                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium appearance-none ${
                                                isGlass
                                                    ? 'bg-white/5 border-white/10 text-white focus:border-[var(--theme-primary)]/50'
                                                    : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark'
                                            }`}
                                        >
                                            <option value="" className={isGlass ? 'bg-neutral-900 text-white/50' : ''}>Select an option...</option>
                                            {field.options?.map(opt => (
                                                <option key={opt} value={opt} className={isGlass ? 'bg-neutral-900 text-white' : ''}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : field.type === 'file' ? (
                                        <FormFileField
                                            label={field.label}
                                            required={field.required}
                                            value={formData[field.id] || ''}
                                            onChange={url => handleChange(field.id, url)}
                                        />
                                    ) : (
                                        <input
                                            type={field.type}
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ''}
                                            onChange={e => handleChange(field.id, e.target.value)}
                                            className={`w-full px-4 py-3 rounded-xl border focus:ring-0 transition-colors font-medium ${
                                                isGlass
                                                    ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
                                                    : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark'
                                            }`}
                                        />
                                    )}
                                </div>
                            ))}

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full font-bold py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2 ${
                                    isGlass
                                        ? 'text-white hover:brightness-110'
                                        : 'bg-brand-dark text-white hover:bg-gray-800'
                                }`}
                                style={isGlass ? { backgroundColor: 'var(--theme-primary)' } : undefined}
                            >
                                {submitting && <Loader size={20} className="animate-spin" />}
                                {form.buttonText || 'Submit'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
