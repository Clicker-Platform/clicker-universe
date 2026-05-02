'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CheckCircle, Loader } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { FormFieldsRenderer } from '@/components/forms/FormFieldsRenderer';
import { useTemplate } from '@/components/TemplateProvider';

interface Props {
    data: {
        formId?: string;
        heading?: string;
        subheading?: string;
        successMessage?: string;
        redirectUrl?: string;
    };
    siteId?: string;
}

export function DefaultInlineFormBlock({ data, siteId }: Props) {
    const { theme } = useTemplate();
    const isGlass = theme.cardStyle === 'glass';
    const router = useRouter();
    const [form, setForm] = useState<Form | null>(null);
    const [loadingForm, setLoadingForm] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!data?.formId || !siteId) {
            setLoadingForm(false);
            return;
        }
        (async () => {
            try {
                const snap = await getDoc(doc(db, 'sites', siteId, 'forms', data.formId!));
                if (!snap.exists()) {
                    setForm(null);
                    return;
                }
                const formData = { id: snap.id, ...snap.data() } as Form;
                setForm(formData.isPublished === false ? null : formData);
            } catch {
                setForm(null);
            } finally {
                setLoadingForm(false);
            }
        })();
    }, [data?.formId, siteId]);

    const { formData, setField, submitting, error, handleSubmit } = useFormSubmit({
        siteId,
        form: form!,
        onSuccess: () => {
            if (data.redirectUrl) {
                router.push(data.redirectUrl);
            } else {
                setSubmitted(true);
            }
        },
    });

    const labelClassName = isGlass ? 'text-white/80' : 'text-gray-700';
    const inputClassName = isGlass
        ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
        : 'bg-gray-50 border-2 border-gray-200 focus:border-brand-dark';

    if (submitted) {
        return (
            <section className="w-full px-4 py-10 max-w-2xl mx-auto text-center">
                <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'var(--theme-primary)' }}
                >
                    <CheckCircle size={28} className="text-white" />
                </div>
                <p
                    className="text-lg font-bold"
                    style={{ color: 'var(--theme-foreground)' }}
                >
                    {data.successMessage || "Thank you! We'll be in touch."}
                </p>
            </section>
        );
    }

    return (
        <section className="w-full px-4 py-10 max-w-2xl mx-auto">
            {data.heading && (
                <h2
                    className="text-2xl font-black mb-1"
                    style={{ color: 'var(--theme-foreground)' }}
                >
                    {data.heading}
                </h2>
            )}
            {data.subheading && (
                <p
                    className="text-sm font-medium mb-6"
                    style={{ color: 'var(--theme-foreground)', opacity: 0.6 }}
                >
                    {data.subheading}
                </p>
            )}

            {loadingForm ? (
                <div className="space-y-4 animate-pulse">
                    <div className="h-10 bg-gray-200 dark:bg-neutral-800 rounded" />
                    <div className="h-10 bg-gray-200 dark:bg-neutral-800 rounded" />
                    <div className="h-12 bg-gray-200 dark:bg-neutral-800 rounded" />
                </div>
            ) : !form ? (
                <p
                    className="text-sm font-medium italic"
                    style={{ color: 'var(--theme-foreground)', opacity: 0.5 }}
                >
                    Select a form in the block settings.
                </p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormFieldsRenderer
                        fields={form.fields}
                        formData={formData}
                        onChange={setField}
                        labelClassName={labelClassName}
                        inputClassName={inputClassName}
                    />

                    {error && (
                        <p className="text-sm text-red-500 font-medium">{error}</p>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="w-full font-bold py-4 rounded-xl shadow-lg hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white"
                        style={{ backgroundColor: 'var(--theme-primary)' }}
                    >
                        {submitting && <Loader size={20} className="animate-spin" />}
                        {form.buttonText || 'Submit'}
                    </button>
                </form>
            )}
        </section>
    );
}
