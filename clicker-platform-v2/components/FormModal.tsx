'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle } from 'lucide-react';
import { Form } from '@/data/mockData';
import { useTemplate } from '@/components/TemplateProvider';
import { useDeviceView } from '@/components/DeviceViewContext';
import { useFormSubmit } from '@/lib/forms/useFormSubmit';
import { FormFieldsRenderer } from '@/components/forms/FormFieldsRenderer';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import { H2, BODY_SM, BODY } from '@/components/blocks/public/typography';
import {
    getHeadingColor,
    getBodyColor,
    getMutedColor,
    getAccentColor,
    hexWithOpacity,
} from '@/components/blocks/public/cardStyles';

interface FormModalProps {
    form: Form;
    isOpen: boolean;
    onClose: () => void;
    siteId?: string;
}

export const FormModal: React.FC<FormModalProps> = ({ form, isOpen, onClose, siteId }) => {
    const { theme } = useTemplate();
    const deviceView = useDeviceView();
    const cardStyle = theme.cardStyle;
    const isGlass = cardStyle === 'glass';
    const isClean = cardStyle === 'clean';

    const [success, setSuccess] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const { formData, setField, submitting, handleSubmit } = useFormSubmit({
        siteId,
        form,
        onSuccess: () => {
            setSuccess(true);
            setTimeout(() => { onClose(); setSuccess(false); }, 2000);
        },
    });

    if (!isOpen || !mounted) return null;
    if (form.isPublished === false) return null;

    const headingColor = getHeadingColor(cardStyle, theme);
    const bodyColor = getBodyColor(cardStyle, theme);
    const mutedColor = getMutedColor(cardStyle, theme);
    const accentColor = getAccentColor(theme);
    const borderRadius = theme.borderRadius || '1rem';

    // Card surface — themed instead of hardcoded bg-white
    const surfaceStyle: React.CSSProperties = isGlass
        ? {
            background: 'color-mix(in srgb, var(--theme-surface, #1a1a1a) 88%, transparent)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }
        : {
            background: 'var(--theme-surface, #ffffff)',
            border: isClean ? '1px solid var(--theme-border, rgba(0,0,0,0.08))' : undefined,
            boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
        };

    // Field surface — softly tinted from the theme so inputs read as part of the card
    const inputBg = isGlass
        ? 'rgba(255,255,255,0.05)'
        : hexWithOpacity(theme.colors.foreground, 0.04);
    const inputBorder = isGlass
        ? 'rgba(255,255,255,0.12)'
        : hexWithOpacity(theme.colors.foreground, 0.12);

    // FormFieldsRenderer takes className strings; inline style would be cleaner but
    // its API is class-based. We use arbitrary value tailwind to thread theme tokens.
    const labelClassName = 'font-medium text-sm mb-1.5';
    const labelStyle: React.CSSProperties = { color: bodyColor };
    const inputClassName =
        'w-full px-4 py-3 text-base outline-none transition-colors border';
    const inputStyle: React.CSSProperties = {
        background: inputBg,
        borderColor: inputBorder,
        color: bodyColor,
        borderRadius: `calc(${borderRadius} * 0.6)`,
    };

    const closeBtnColor = isGlass ? 'rgba(255,255,255,0.5)' : mutedColor;

    return createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
            <div
                className="absolute inset-0 backdrop-blur-sm"
                style={{ background: 'rgba(0,0,0,0.55)' }}
                onClick={onClose}
            />

            <div
                className="relative w-full sm:max-w-md overflow-hidden
                    max-h-[90vh] overflow-y-auto
                    rounded-t-[var(--fm-radius)] sm:rounded-b-[var(--fm-radius)]
                    animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200"
                style={{ ...surfaceStyle, ['--fm-radius' as any]: borderRadius }}
            >
                {/* Drag handle (mobile only) */}
                <div className="sm:hidden flex justify-center pt-2 pb-1">
                    <div
                        className="w-10 h-1 rounded-full"
                        style={{ background: isGlass ? 'rgba(255,255,255,0.2)' : hexWithOpacity(theme.colors.foreground, 0.18) }}
                    />
                </div>

                {!success && (
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="absolute top-4 right-4 z-10 transition-opacity hover:opacity-100"
                        style={{ color: closeBtnColor, opacity: 0.7 }}
                    >
                        <X size={22} />
                    </button>
                )}

                {success ? (
                    <div className="p-12 text-center flex flex-col items-center justify-center min-h-[280px]">
                        <div
                            className="w-16 h-16 rounded-full flex items-center justify-center mb-6 animate-bounce"
                            style={{ background: accentColor }}
                        >
                            <CheckCircle size={32} color="#ffffff" />
                        </div>
                        <h2 className={H2(deviceView)} style={{ color: headingColor }}>Sent!</h2>
                        <p className={`${BODY(deviceView)} mt-2`} style={{ color: mutedColor }}>
                            Thanks for reaching out.
                        </p>
                    </div>
                ) : (
                    <div className="p-6 sm:p-8">
                        <div className="text-center mb-7">
                            <h2 className={H2(deviceView)} style={{ color: headingColor }}>
                                {form.title}
                            </h2>
                            <p className={`${BODY_SM(deviceView)} mt-1.5`} style={{ color: mutedColor }}>
                                Fill out the form below.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <FormFieldsRenderer
                                fields={form.fields}
                                formData={formData}
                                onChange={setField}
                                labelClassName={labelClassName}
                                labelStyle={labelStyle}
                                inputClassName={inputClassName}
                                inputStyle={inputStyle}
                            />

                            <div className="pt-2">
                                <UnifiedButton
                                    tier="primary"
                                    size="lg"
                                    fullWidth
                                    type="submit"
                                    loading={submitting}
                                    disabled={submitting}
                                >
                                    {form.buttonText || 'Submit'}
                                </UnifiedButton>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};
