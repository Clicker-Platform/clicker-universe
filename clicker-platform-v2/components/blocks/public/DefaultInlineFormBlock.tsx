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
import { getCardClasses, getGlassStyle } from './cardStyles';

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
    const router = useRouter();
    const [form, setForm] = useState<Form | null>(null);
    const [loadingForm, setLoadingForm] = useState(true);
    const [submitted, setSubmitted] = useState(false);

    const isClean = theme?.cardStyle === 'clean';
    const isGlass = theme?.cardStyle === 'glass';
    const isBold = !isClean && !isGlass;

    const colors = theme?.colors ?? {};
    const fonts = theme?.fonts ?? {};

    // Contrast color for text/icons placed on top of theme.primary.
    // Falls back to accent, then background, then white.
    const primaryContrastColor =
        colors.accentForeground ??
        (colors.accent && colors.accent !== colors.primary ? colors.accent : undefined) ??
        colors.background ??
        '#ffffff';

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

    // Per-cardStyle input styling.
    const labelClassName = isGlass ? 'text-white/80' : 'text-theme-foreground';
    const inputClassName = isGlass
        ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-[var(--theme-primary)]/50'
        : isBold
        ? 'bg-white border-[3px] border-theme-border text-theme-foreground focus:border-[var(--theme-primary)]'
        : 'bg-white border border-gray-200 text-theme-foreground focus:border-[var(--theme-primary)]';

    // Success state
    if (submitted) {
        return (
            <section className="w-full px-4 py-10 max-w-2xl mx-auto text-center">
                <div
                    className="w-14 h-14 flex items-center justify-center mx-auto mb-4"
                    style={{
                        backgroundColor: colors.primary,
                        borderRadius: 'var(--theme-radius)',
                    }}
                >
                    <CheckCircle size={28} style={{ color: primaryContrastColor }} />
                </div>
                <p
                    className="text-lg font-bold"
                    style={{ color: 'var(--theme-foreground)', fontFamily: fonts.heading }}
                >
                    {data.successMessage || "Thank you! We'll be in touch."}
                </p>
            </section>
        );
    }

    // Card wrapper styling per cardStyle. Skip the card entirely for `clean` to match
    // its minimalist aesthetic (form sits directly on the page background).
    const cardClasses = isBold
        ? `${getCardClasses('brutalist')} p-6`
        : isGlass
        ? `${getCardClasses('glass')} p-6`
        : ''; // clean: no card wrapper
    const cardStyle = isGlass
        ? { ...getGlassStyle(colors.surface), borderRadius: 'var(--theme-radius)' }
        : isBold
        ? { borderRadius: 'var(--theme-radius)' }
        : undefined;

    const hoverClass = isBold
        ? 'hover:-translate-y-1'
        : isGlass
        ? 'hover:brightness-110'
        : 'hover:opacity-90';

    return (
        <section className="w-full px-4 py-10 max-w-2xl mx-auto">
            <div className={cardClasses} style={cardStyle}>
                {data.heading && (
                    <h2
                        className={`mb-1 ${isBold ? 'text-3xl font-black uppercase tracking-tight' : 'text-2xl font-bold'}`}
                        style={{ color: 'var(--theme-foreground)', fontFamily: fonts.heading }}
                    >
                        {data.heading}
                    </h2>
                )}
                {data.subheading && (
                    <p
                        className="text-sm font-medium mb-6"
                        style={{ color: 'var(--theme-foreground)', opacity: 0.6, fontFamily: fonts.body }}
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
                        style={{ color: 'var(--theme-foreground)', opacity: 0.5, fontFamily: fonts.body }}
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
                            className={`w-full py-4 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${hoverClass} ${
                                isBold ? 'font-black uppercase tracking-wider text-sm border-[3px]' : 'font-bold'
                            }`}
                            style={{
                                backgroundColor: isBold ? colors.foreground : colors.primary,
                                color: isBold ? colors.background : primaryContrastColor,
                                borderColor: isBold ? colors.foreground : undefined,
                                borderRadius: 'calc(var(--theme-radius) * 0.6)',
                                boxShadow: isBold
                                    ? `4px 4px 0px 0px ${colors.border ?? colors.foreground}`
                                    : '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                fontFamily: fonts.heading,
                            }}
                        >
                            {submitting && <Loader size={20} className="animate-spin" />}
                            {form.buttonText || 'Submit'}
                        </button>
                    </form>
                )}
            </div>
        </section>
    );
}
