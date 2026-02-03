'use client';

import React, { useState } from 'react';
import { X, CheckCircle, Loader } from 'lucide-react';
import { Form, FormField } from '@/data/mockData';
import { FormFileField } from '@/components/FormFileField';
// ... (existing imports)



interface FormModalProps {
    form: Form;
    isOpen: boolean;
    onClose: () => void;
    siteId?: string;
}

export const FormModal: React.FC<FormModalProps> = ({ form, isOpen, onClose, siteId }) => {
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState<Record<string, string>>({});

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await fetch('/api/forms/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formId: form.id,
                    formTitle: form.title,
                    data: formData,
                    siteId: siteId,
                    fieldLabels: form.fields.reduce((acc, field) => ({ ...acc, [field.id]: field.label }), {})
                })
            });
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

            <div className="relative bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                {!success && (
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={24} />
                    </button>
                )}

                {success ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
                        <div className="w-16 h-16 bg-brand-green rounded-full flex items-center justify-center mb-6 animate-bounce">
                            <CheckCircle size={32} className="text-brand-dark" />
                        </div>
                        <h2 className="text-2xl font-black text-brand-dark mb-2">Sent!</h2>
                        <p className="text-gray-500 font-bold">Thanks for reaching out.</p>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl font-black text-brand-dark uppercase tracking-tight mb-2">{form.title}</h2>
                            <p className="text-gray-500 font-medium text-sm">Fill out the form below.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            {form.fields.map((field) => (
                                <div key={field.id}>
                                    {field.type !== 'file' && (
                                        <label className="block text-sm font-bold text-gray-700 mb-1">
                                            {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                    )}

                                    {field.type === 'textarea' ? (
                                        <textarea
                                            required={field.required}
                                            placeholder={field.placeholder}
                                            value={formData[field.id] || ''}
                                            onChange={e => handleChange(field.id, e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark focus:ring-0 transition-colors bg-gray-50 font-medium resize-none h-32"
                                        />
                                    ) : field.type === 'select' ? (
                                        <select
                                            required={field.required}
                                            value={formData[field.id] || ''}
                                            onChange={e => handleChange(field.id, e.target.value)}
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark focus:ring-0 transition-colors bg-gray-50 font-medium appearance-none"
                                        >
                                            <option value="">Select an option...</option>
                                            {field.options?.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
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
                                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-brand-dark focus:ring-0 transition-colors bg-gray-50 font-medium"
                                        />
                                    )}
                                </div>
                            ))}

                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full bg-brand-dark text-white font-bold py-4 rounded-xl shadow-lg hover:bg-gray-800 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2"
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
