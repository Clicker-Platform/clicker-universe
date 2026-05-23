'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { FormModal } from '@/components/FormModal';
import { useDeviceView } from '@/components/DeviceViewContext';
import { BUTTON_TEXT } from './typography';

function isSafeHref(href: string | undefined | null): boolean {
    if (!href) return false;
    return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
}

function isExternalProtocol(href: string): boolean {
    return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}

interface TriggerConfig {
    label: string;
    variant?: 'primary' | 'secondary' | 'outline';
    linkType?: 'url' | 'page' | 'form';
    url?: string;
    formId?: string;
    openInNewTab?: boolean;
}

export const DefaultButtonBlock = ({ data, previewMode, siteId: siteIdProp }: { data: any; previewMode?: boolean; siteId?: string }) => {
    const { theme } = useTemplate();
    const d = useDeviceView();
    const { siteId: ctxSiteId, tenantSlug, isSubdomain } = useSite();
    const siteId = siteIdProp || ctxSiteId;
    const isClean = theme.cardStyle === 'clean';
    const isGlass = theme.cardStyle === 'glass';

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState<any>(null);
    const [isLoadingForm, setIsLoadingForm] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    const alignClass = {
        left: 'text-left',
        center: 'text-center',
        right: 'text-right',
        full: 'text-center w-full'
    }[data.align as string] || 'text-center';

    const getVariantClass = (variant?: string) => {
        if (isGlass) {
            switch (variant) {
                case 'secondary': return 'bg-white/10 border border-white/20 text-white hover:bg-white/20';
                case 'outline': return 'bg-transparent border border-white/30 text-white hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
                default: return 'bg-[var(--theme-primary)] text-[var(--theme-background)] hover:opacity-90';
            }
        }
        if (isClean) {
            switch (variant) {
                case 'secondary': return 'bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-[var(--theme-foreground)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
                case 'outline': return 'bg-transparent border-2 border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
                default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:bg-[var(--theme-primary)] hover:shadow-lg';
            }
        }
        switch (variant) {
            case 'secondary': return 'bg-[var(--theme-primary)] text-[var(--theme-foreground)] hover:opacity-80';
            case 'outline': return 'bg-transparent border-[3px] border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
            default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:opacity-80';
        }
    };

    const buttonStyle = { borderRadius: 'calc(var(--theme-radius) * 0.75)' };

    const handleFormClick = async (e: React.MouseEvent) => {
        e.preventDefault();
        if (previewMode || !siteId) return;
        setFormError(null);
        if (!formData) {
            setIsLoadingForm(true);
            try {
                const res = await fetch(`/api/forms?id=${data.formId}&siteId=${siteId}`);
                if (res.ok) {
                    setFormData(await res.json());
                    setIsModalOpen(true);
                } else if (res.status === 404) {
                    setFormError('Form not found or unpublished.');
                } else {
                    setFormError('Could not load form. Please try again.');
                }
            } catch {
                setFormError('Network error. Please check your connection.');
            }
            setIsLoadingForm(false);
        } else {
            setIsModalOpen(true);
        }
    };

    // Auto-dismiss error after 4s
    React.useEffect(() => {
        if (!formError) return;
        const t = setTimeout(() => setFormError(null), 4000);
        return () => clearTimeout(t);
    }, [formError]);

    const wrapperClass = `${data.align === 'full' ? '' : alignClass}`;

    const buildTrigger = (
        cfg: TriggerConfig,
        key: 'primary' | 'secondary',
        formState: {
            isLoadingForm: boolean;
            onFormClick: (e: React.MouseEvent) => void;
        }
    ): React.ReactNode => {
        const label = cfg.label || 'Click Here';
        const linkType = cfg.linkType || 'url';
        const isFormLink = linkType === 'form' && !!cfg.formId;

        const rawUrl = typeof cfg.url === 'string' ? cfg.url.trim() : '';
        const resolvedHref = linkType === 'page'
            ? resolveNavHref(rawUrl, tenantSlug, isSubdomain)
            : rawUrl;

        const safe = isSafeHref(resolvedHref);
        const external = safe && isExternalProtocol(resolvedHref);
        const openInNewTab = external || cfg.openInNewTab === true;

        const variantClass = getVariantClass(cfg.variant);
        const className = `inline-block py-3 px-6 ${BUTTON_TEXT(d)} transition-all transform ${isClean ? 'shadow-sm hover:-translate-y-0.5' : isGlass ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'hover:-translate-y-1 hover:shadow-lg'} ${variantClass} ${data.align === 'full' ? 'w-full block' : ''}`;

        if (previewMode || (!isFormLink && !safe)) {
            return <span className={className} style={buttonStyle}>{label}</span>;
        }
        if (isFormLink) {
            return (
                <button
                    type="button"
                    onClick={formState.onFormClick}
                    className={className}
                    style={buttonStyle}
                    disabled={formState.isLoadingForm}
                >
                    {formState.isLoadingForm ? 'Loading…' : label}
                </button>
            );
        }
        if (external) {
            return (
                <a
                    href={resolvedHref}
                    className={className}
                    style={buttonStyle}
                    target={openInNewTab ? '_blank' : undefined}
                    rel={openInNewTab ? 'noopener noreferrer' : undefined}
                >
                    {label}
                </a>
            );
        }
        return (
            <Link
                href={resolvedHref}
                className={className}
                style={buttonStyle}
                target={openInNewTab ? '_blank' : undefined}
                rel={openInNewTab ? 'noopener noreferrer' : undefined}
            >
                {label}
            </Link>
        );
    };

    const isFormLink = data.linkType === 'form' && !!data.formId;

    const primaryTrigger = buildTrigger(
        { label: data.label, variant: data.variant, linkType: data.linkType, url: data.url, formId: data.formId, openInNewTab: data.openInNewTab },
        'primary',
        { isLoadingForm, onFormClick: handleFormClick }
    );

    return (
        <>
            <div className={wrapperClass}>
                {primaryTrigger}
                {formError && (
                    <div
                        role="alert"
                        className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border"
                        style={{
                            backgroundColor: 'var(--theme-error-bg)',
                            color: 'var(--theme-error)',
                            borderColor: 'var(--theme-error-bg)',
                        }}
                    >
                        {formError}
                    </div>
                )}
            </div>
            {isFormLink && isModalOpen && formData && (
                <FormModal form={formData} isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} siteId={siteId} />
            )}
        </>
    );
};
