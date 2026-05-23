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

function resolveTier(data: any): ButtonTier {
  if (data.tier === 'primary' || data.tier === 'secondary' || data.tier === 'tertiary') return data.tier;
  if (data.variant === 'outline') return 'secondary';
  if (data.variant === 'secondary') return 'secondary';
  return 'primary';
}

function resolveSize(data: any): ButtonSize {
  return data.size === 'sm' || data.size === 'lg' ? data.size : 'md';
}

export const DefaultButtonBlock = ({
  data,
  previewMode,
  siteId: siteIdProp,
}: { data: any; previewMode?: boolean; siteId?: string }) => {
  const { siteId: ctxSiteId, tenantSlug, isSubdomain } = useSite();
  const siteId = siteIdProp || ctxSiteId;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const tier = resolveTier(data);
  const size = resolveSize(data);
  const label = data.label || 'Click Here';
  const linkType = data.linkType || 'url';
  const isFormLink = linkType === 'form' && !!data.formId;
  const fullWidth = data.align === 'full';

  const alignClass =
    fullWidth ? ''
    : data.align === 'left' ? 'text-left'
    : data.align === 'right' ? 'text-right'
    : 'text-center';

  const rawUrl = typeof data.url === 'string' ? data.url.trim() : '';
  const resolvedHref = linkType === 'page'
    ? resolveNavHref(rawUrl, tenantSlug, isSubdomain)
    : rawUrl;
  const safe = isSafeHref(resolvedHref);
  const external = safe && /^(https?:\/\/|mailto:|tel:)/i.test(resolvedHref);
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

  React.useEffect(() => {
    if (!formError) return;
    const t = setTimeout(() => setFormError(null), 4000);
    return () => clearTimeout(t);
  }, [formError]);

  let trigger: React.ReactNode;
  if (previewMode || (!isFormLink && !safe)) {
    trigger = <UnifiedButton tier={tier} size={size} fullWidth={fullWidth}>{label}</UnifiedButton>;
  } else if (isFormLink) {
    trigger = (
      <UnifiedButton
        tier={tier} size={size} fullWidth={fullWidth}
        onClick={handleFormClick} loading={isLoadingForm}
      >
        {label}
      </UnifiedButton>
    );
  } else {
    trigger = (
      <UnifiedButton
        tier={tier} size={size} fullWidth={fullWidth}
        href={resolvedHref} external={openInNewTab}
      >
        {label}
      </UnifiedButton>
    );
  }

  return (
    <>
      <div className={alignClass}>
        {trigger}
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
