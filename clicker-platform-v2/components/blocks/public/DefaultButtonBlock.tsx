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

    type ButtonKey = 'primary' | 'secondary';
    const [modalOpenFor, setModalOpenFor] = useState<ButtonKey | null>(null);
    const [formDataByKey, setFormDataByKey] = useState<Partial<Record<ButtonKey, any>>>({});
    const [loadingFor, setLoadingFor] = useState<ButtonKey | null>(null);
    const [errorByKey, setErrorByKey] = useState<Partial<Record<ButtonKey, string>>>({});

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

    const handleFormClick = (key: ButtonKey, cfg: TriggerConfig) => async (e: React.MouseEvent) => {
        e.preventDefault();
        if (previewMode || !siteId) return;
        setErrorByKey(prev => ({ ...prev, [key]: undefined }));
        if (!formDataByKey[key]) {
            setLoadingFor(key);
            try {
                const res = await fetch(`/api/forms?id=${cfg.formId}&siteId=${siteId}`);
                if (res.ok) {
                    const formJson = await res.json();
                    setFormDataByKey(prev => ({ ...prev, [key]: formJson }));
                    setModalOpenFor(key);
                } else if (res.status === 404) {
                    setErrorByKey(prev => ({ ...prev, [key]: 'Form not found or unpublished.' }));
                } else {
                    setErrorByKey(prev => ({ ...prev, [key]: 'Could not load form. Please try again.' }));
                }
            } catch {
                setErrorByKey(prev => ({ ...prev, [key]: 'Network error. Please check your connection.' }));
            }
            setLoadingFor(null);
        } else {
            setModalOpenFor(key);
        }
    };

    // Auto-dismiss per-key errors after 4s
    React.useEffect(() => {
        const keys = (Object.keys(errorByKey) as ButtonKey[]).filter(k => errorByKey[k]);
        if (keys.length === 0) return;
        const timers = keys.map(k =>
            setTimeout(() => setErrorByKey(prev => ({ ...prev, [k]: undefined })), 4000)
        );
        return () => timers.forEach(clearTimeout);
    }, [errorByKey]);

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

    const primaryCfg: TriggerConfig = {
        label: data.label,
        variant: data.variant,
        linkType: data.linkType,
        url: data.url,
        formId: data.formId,
        openInNewTab: data.openInNewTab,
    };
    const primaryTrigger = buildTrigger(primaryCfg, 'primary', {
        isLoadingForm: loadingFor === 'primary',
        onFormClick: handleFormClick('primary', primaryCfg),
    });

    const secondaryCfg: TriggerConfig | null = data.secondary
        ? {
            label: data.secondary.label,
            variant: data.secondary.variant,
            linkType: data.secondary.linkType,
            url: data.secondary.url,
            formId: data.secondary.formId,
            openInNewTab: data.secondary.openInNewTab,
        }
        : null;

    const secondaryTrigger = secondaryCfg
        ? buildTrigger(secondaryCfg, 'secondary', {
            isLoadingForm: loadingFor === 'secondary',
            onFormClick: handleFormClick('secondary', secondaryCfg),
        })
        : null;

    const primaryError = errorByKey.primary;
    const secondaryError = errorByKey.secondary;
    const primaryIsFormLink = data.linkType === 'form' && !!data.formId;
    const secondaryIsFormLink = !!data.secondary && data.secondary.linkType === 'form' && !!data.secondary.formId;

    const pairJustify =
        data.align === 'left' ? 'justify-start' :
        data.align === 'right' ? 'justify-end' :
        'justify-center';
    const isFull = data.align === 'full';

    const triggers = secondaryTrigger ? (
        <div className={`@container w-full ${isFull ? '' : `flex ${pairJustify}`}`}>
            <div className={`flex flex-col @[320px]:flex-row gap-3 ${isFull ? 'w-full' : ''}`}>
                {isFull ? (
                    <>
                        <div className="flex-1 [&>*]:w-full [&>*]:block">{primaryTrigger}</div>
                        <div className="flex-1 [&>*]:w-full [&>*]:block">{secondaryTrigger}</div>
                    </>
                ) : (
                    <>
                        {primaryTrigger}
                        {secondaryTrigger}
                    </>
                )}
            </div>
        </div>
    ) : (
        primaryTrigger
    );

    const errorBoxClass = 'mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border';
    const errorBoxStyle = {
        backgroundColor: 'var(--theme-error-bg)',
        color: 'var(--theme-error)',
        borderColor: 'var(--theme-error-bg)',
    };

    return (
        <>
            <div className={wrapperClass}>
                {triggers}
                {primaryError && (
                    <div role="alert" className={errorBoxClass} style={errorBoxStyle}>
                        {primaryError}
                    </div>
                )}
                {secondaryError && (
                    <div role="alert" className={errorBoxClass} style={errorBoxStyle}>
                        {secondaryError}
                    </div>
                )}
            </div>
            {primaryIsFormLink && modalOpenFor === 'primary' && formDataByKey.primary && (
                <FormModal
                    form={formDataByKey.primary}
                    isOpen={true}
                    onClose={() => setModalOpenFor(null)}
                    siteId={siteId}
                />
            )}
            {secondaryIsFormLink && modalOpenFor === 'secondary' && formDataByKey.secondary && (
                <FormModal
                    form={formDataByKey.secondary}
                    isOpen={true}
                    onClose={() => setModalOpenFor(null)}
                    siteId={siteId}
                />
            )}
        </>
    );
};
