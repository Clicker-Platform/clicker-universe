'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle, Loader } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { FormFieldsRenderer } from '@/components/forms/FormFieldsRenderer';

interface FormModalProps {
    form: Form;
    isOpen: boolean;
    onClose: () => void;
    siteId?: string;
}

export const FormModal: React.FC<FormModalProps> = ({ form, isOpen, onClose, siteId }) => {
    const { theme } = useTemplate();
    const isGlass = theme.cardStyle === 'glass';
    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        Promise.resolve().then(() => setMounted(true));
    }, []);

    const { formData, setField, submitting, handleSubmit } = useFormSubmit({
        siteId,
        form,
        onSuccess: () => {
            setSuccess(true);
            setTimeout(() => {
                onClose();
                setSuccess(false);
            }, 2000);
        },
    });

    if (!isOpen) return null;
    if (!mounted) return null;
    if (form.isPublished === false) return null;

    const labelClassName = isGlass ? 'text-white/80' : 'text-gray-700';
    const inputClassName = isGlass
        ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
        : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark';

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div
                className={`relative w-full sm:max-w-md overflow-hidden shadow-2xl
                    rounded-t-3xl sm:rounded-3xl
                    max-h-[90vh] sm:max-h-[90vh] overflow-y-auto
                    animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200 ${
                    isGlass ? 'border border-white/10 backdrop-blur-xl' : 'bg-white'
                }`}
                style={isGlass ? { background: 'rgba(26, 26, 26, 0.85)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' } : undefined}
            >
                {/* Drag handle (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-1">
                    <div className={`w-10 h-1 rounded-full ${isGlass ? 'bg-white/20' : 'bg-gray-300'}`} />
                </div>
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
                            <p className={`font-medium text-sm ${isGlass ? 'text-white/50' : 'text-gray-500'}`}>
                                Fill out the form below.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <FormFieldsRenderer
                                fields={form.fields}
                                formData={formData}
                                onChange={setField}
                                labelClassName={labelClassName}
                                inputClassName={inputClassName}
                            />

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full font-bold py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-6 flex items-center justify-center gap-2 ${
                                    isGlass ? 'text-white hover:brightness-110' : 'bg-brand-dark text-white hover:bg-gray-800'
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
        </div>,
        document.body
    );
};
