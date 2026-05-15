'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { FormModal } from '@/components/FormModal';

function isSafeHref(href: string | undefined | null): boolean {
    if (!href) return false;
    return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
}

function isExternalProtocol(href: string): boolean {
    return /^(https?:\/\/|mailto:|tel:)/i.test(href);
}

export const DefaultButtonBlock = ({ data, previewMode, siteId: siteIdProp }: { data: any; previewMode?: boolean; siteId?: string }) => {
    const { theme } = useTemplate();
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

    const getVariantClass = () => {
        if (isGlass) {
            switch (data.variant) {
                case 'secondary': return 'bg-white/10 border border-white/20 text-white hover:bg-white/20';
                case 'outline': return 'bg-transparent border border-white/30 text-white hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
                default: return 'bg-[var(--theme-primary)] text-[var(--theme-background)] font-bold hover:opacity-90';
            }
        }
        if (isClean) {
            switch (data.variant) {
                case 'secondary': return 'bg-[var(--theme-surface)] border-2 border-[var(--theme-border)] text-[var(--theme-foreground)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]';
                case 'outline': return 'bg-transparent border-2 border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
                default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:bg-[var(--theme-primary)] hover:shadow-lg';
            }
        }
        switch (data.variant) {
            case 'secondary': return 'bg-[var(--theme-primary)] text-[var(--theme-foreground)] hover:opacity-80';
            case 'outline': return 'bg-transparent border-[3px] border-[var(--theme-foreground)] text-[var(--theme-foreground)] hover:bg-[var(--theme-foreground)] hover:text-[var(--theme-background)]';
            default: return 'bg-[var(--theme-foreground)] text-[var(--theme-background)] hover:opacity-80';
        }
    };

    const className = `inline-block py-3 px-6 font-bold transition-all transform ${isClean ? 'shadow-sm hover:-translate-y-0.5' : isGlass ? 'hover:-translate-y-0.5 hover:shadow-lg' : 'hover:-translate-y-1 hover:shadow-lg'} ${getVariantClass()} ${data.align === 'full' ? 'w-full block' : ''}`;

    const buttonStyle = { borderRadius: 'calc(var(--theme-radius) * 0.75)' };
    const label = data.label || 'Click Here';
    const linkType = data.linkType || 'url';
    const isFormLink = linkType === 'form' && !!data.formId;

    // Resolve href:
    //   form  → handled via overlay (no href; render <button>)
    //   page  → tenant-aware via resolveNavHref(stored '/slug', ...)
    //   url   → as-stored
    const rawUrl = typeof data.url === 'string' ? data.url.trim() : '';
    const resolvedHref = linkType === 'page'
        ? resolveNavHref(rawUrl, tenantSlug, isSubdomain)
        : rawUrl;

    const safe = isSafeHref(resolvedHref);
    const external = safe && isExternalProtocol(resolvedHref);
    const openInNewTab = external || data.openInNewTab === true;

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

    let trigger: React.ReactNode;
    if (previewMode || (!isFormLink && !safe)) {
        trigger = <span className={className} style={buttonStyle}>{label}</span>;
    } else if (isFormLink) {
        trigger = (
            <button
                type="button"
                onClick={handleFormClick}
                className={className}
                style={buttonStyle}
                disabled={isLoadingForm}
            >
                {isLoadingForm ? 'Loading…' : label}
            </button>
        );
    } else if (external) {
        trigger = (
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
    } else {
        trigger = (
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
    }

    return (
        <>
            <div className={wrapperClass}>
                {trigger}
                {formError && (
                    <div
                        role="alert"
                        className="mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg bg-red-500/10 text-red-600 border border-red-500/20"
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
