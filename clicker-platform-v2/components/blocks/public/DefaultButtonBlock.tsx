'use client';

import React, { useState } from 'react';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { FormModal } from '@/components/FormModal';
import { UnifiedButton } from '@/components/ui/UnifiedButton';
import type { ButtonTier, ButtonSize } from '@/lib/buttonPacks/types';

function isSafeHref(href: string | undefined | null): boolean {
  if (!href) return false;
  return /^(https?:\/\/|\/|#|mailto:|tel:)/i.test(href);
}

function resolveTier(d: any, fallback: ButtonTier = 'primary'): ButtonTier {
  if (d?.tier === 'primary' || d?.tier === 'secondary' || d?.tier === 'tertiary') return d.tier;
  if (d?.variant === 'outline') return 'secondary';
  if (d?.variant === 'secondary') return 'secondary';
  if (d?.variant === 'primary') return 'primary';
  return fallback;
}

function resolveSize(d: any): ButtonSize {
  return d?.size === 'sm' || d?.size === 'lg' ? d.size : 'md';
}

type ButtonKey = 'primary' | 'secondary';

interface ButtonCfg {
  label: string;
  tier: ButtonTier;
  size: ButtonSize;
  linkType: string;
  url?: string;
  formId?: string;
  openInNewTab?: boolean;
  fullWidth: boolean;
}

export const DefaultButtonBlock = ({
  data,
  previewMode,
  siteId: siteIdProp,
}: { data: any; previewMode?: boolean; siteId?: string }) => {
  const { siteId: ctxSiteId, tenantSlug, isSubdomain } = useSite();
  const siteId = siteIdProp || ctxSiteId;

  const [modalOpenFor, setModalOpenFor] = useState<ButtonKey | null>(null);
  const [formDataByKey, setFormDataByKey] = useState<Partial<Record<ButtonKey, any>>>({});
  const [loadingFor, setLoadingFor] = useState<ButtonKey | null>(null);
  const [errorByKey, setErrorByKey] = useState<Partial<Record<ButtonKey, string>>>({});

  const isFull = data.align === 'full';

  const alignClass =
    isFull ? ''
    : data.align === 'left' ? 'text-left'
    : data.align === 'right' ? 'text-right'
    : 'text-center';

  const pairJustify =
    data.align === 'left' ? 'justify-start'
    : data.align === 'right' ? 'justify-end'
    : 'justify-center';

  const wrapperClass = isFull ? '' : alignClass;

  // Auto-dismiss per-key errors after 4s
  React.useEffect(() => {
    const keys = (Object.keys(errorByKey) as ButtonKey[]).filter(k => errorByKey[k]);
    if (keys.length === 0) return;
    const timers = keys.map(k =>
      setTimeout(() => setErrorByKey(prev => ({ ...prev, [k]: undefined })), 4000)
    );
    return () => timers.forEach(clearTimeout);
  }, [errorByKey]);

  const handleFormClick = (key: ButtonKey, cfg: ButtonCfg) => async (e: React.MouseEvent) => {
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

  const buildTrigger = (
    cfg: ButtonCfg,
    key: ButtonKey,
  ): React.ReactNode => {
    const { label, tier, size, linkType, fullWidth } = cfg;
    const isFormLink = linkType === 'form' && !!cfg.formId;

    const rawUrl = typeof cfg.url === 'string' ? cfg.url.trim() : '';
    const resolvedHref =
      linkType === 'page'
        ? resolveNavHref(rawUrl, tenantSlug, isSubdomain)
        : rawUrl;
    const safe = isSafeHref(resolvedHref);
    const external = safe && /^(https?:\/\/|mailto:|tel:)/i.test(resolvedHref);
    const openInNewTab = external || cfg.openInNewTab === true;

    if (previewMode || (!isFormLink && !safe)) {
      return (
        <UnifiedButton tier={tier} size={size} fullWidth={fullWidth}>
          {label}
        </UnifiedButton>
      );
    }
    if (isFormLink) {
      return (
        <UnifiedButton
          tier={tier}
          size={size}
          fullWidth={fullWidth}
          onClick={handleFormClick(key, cfg)}
          loading={loadingFor === key}
        >
          {label}
        </UnifiedButton>
      );
    }
    return (
      <UnifiedButton
        tier={tier}
        size={size}
        fullWidth={fullWidth}
        href={resolvedHref}
        external={openInNewTab}
      >
        {label}
      </UnifiedButton>
    );
  };

  const primaryCfg: ButtonCfg = {
    label: data.label || 'Click Here',
    tier: resolveTier(data, 'primary'),
    size: resolveSize(data),
    linkType: data.linkType || 'url',
    url: data.url,
    formId: data.formId,
    openInNewTab: data.openInNewTab,
    fullWidth: isFull,
  };

  const secondaryCfg: ButtonCfg | null = data.secondary
    ? {
        label: data.secondary.label || 'Learn More',
        tier: resolveTier(data.secondary, 'secondary'),
        size: resolveSize(data.secondary),
        linkType: data.secondary.linkType || 'url',
        url: data.secondary.url,
        formId: data.secondary.formId,
        openInNewTab: data.secondary.openInNewTab,
        fullWidth: isFull,
      }
    : null;

  const primaryTrigger = buildTrigger(primaryCfg, 'primary');
  const secondaryTrigger = secondaryCfg ? buildTrigger(secondaryCfg, 'secondary') : null;

  const primaryError = errorByKey.primary;
  const secondaryError = errorByKey.secondary;
  const primaryIsFormLink = data.linkType === 'form' && !!data.formId;
  const secondaryIsFormLink =
    !!data.secondary && data.secondary.linkType === 'form' && !!data.secondary.formId;

  const errorBoxClass = 'mt-2 inline-block text-xs font-medium px-3 py-1.5 rounded-lg border';
  const errorBoxStyle = {
    backgroundColor: 'var(--theme-error-bg)',
    color: 'var(--theme-error)',
    borderColor: 'var(--theme-error-bg)',
  };

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
