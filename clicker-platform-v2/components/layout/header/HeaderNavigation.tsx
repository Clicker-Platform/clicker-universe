'use client';

import React, { useState, useCallback } from 'react';
import { FormModal } from '@/components/FormModal';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import { useNavigation } from '@/components/layout/NavigationProvider';
import { useDeviceView } from '@/components/DeviceViewContext';
import { TopNavSkeleton } from '@/components/layout/NavSkeleton';
import { useScrollBehavior } from './useScrollBehavior';
import { useHeaderTypography } from './useHeaderTypography';
import { HeaderShell } from './HeaderShell';
import { HEADER_VARIANTS } from './variants';
import type { BusinessProfile, NavigationItem } from '@/data/mockData';

interface HeaderNavigationProps {
  profile: BusinessProfile;
  siteId?: string;
  forceMobile?: boolean;
  /** Canvas Studio preview: intercepts nav clicks instead of real navigation */
  onNavigate?: (href: string, item: NavigationItem) => void;
}

export const HeaderNavigation: React.FC<HeaderNavigationProps> = ({
  profile,
  siteId,
  forceMobile = false,
  onNavigate,
}) => {
  const { tenantSlug, isSubdomain } = useSite();
  const { theme } = useTemplate();
  const deviceView = useDeviceView();
  const isPreview = deviceView !== 'responsive';
  const { layout } = theme;
  const { header, loading, formCache } = useNavigation();

  const [selectedForm, setSelectedForm] = useState<any>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const scrollState = useScrollBehavior({
    behavior: header.scrollBehavior,
    disabled: isPreview || forceMobile,
  });

  const typographyClass = useHeaderTypography(header.typography);

  const getHref = useCallback(
    (val: string) => resolveNavHref(val, tenantSlug, isSubdomain),
    [tenantSlug, isSubdomain]
  );

  const openChat = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ai-sales-agent:open'));
    }
  }, []);

  const handleItemClick = useCallback(
    async (e: React.MouseEvent, item: NavigationItem) => {
      if (onNavigate) {
        e.preventDefault();
        onNavigate(getHref(item.value), item);
        return;
      }
      if (item.value === 'action:chat' || (item.type as string) === 'action-chat') {
        e.preventDefault();
        openChat();
        return;
      }
      if (item.type === 'form' && item.formId) {
        e.preventDefault();
        const cached = formCache[item.formId];
        if (cached) {
          setSelectedForm(cached);
          setIsFormOpen(true);
        } else if (siteId) {
          try {
            const { getDoc, doc } = await import('firebase/firestore');
            const { db } = await import('@/lib/firebase');
            const snap = await getDoc(doc(db, 'sites', siteId, 'forms', item.formId));
            if (snap.exists() && snap.data().isPublished !== false) {
              setSelectedForm({ id: snap.id, ...snap.data() });
              setIsFormOpen(true);
            }
          } catch (err) {
            console.error('HeaderNavigation: form fetch error', err);
          }
        }
      }
    },
    [formCache, siteId, openChat, onNavigate, getHref]
  );

  const isMobileOnly = layout?.navMode === 'mobile-only';
  if (isMobileOnly) return null;
  if (loading) return <TopNavSkeleton forceMobile={forceMobile || isPreview} />;

  const VariantComponent = HEADER_VARIANTS[header.variant] ?? HEADER_VARIANTS['logo-left'];
  const LogoLeftComponent = HEADER_VARIANTS['logo-left'];
  const isLogoLeft = header.variant === 'logo-left';

  const sharedVariantProps = {
    profile,
    siteId,
    items: header.items,
    cta: header.cta,
    typographyClass,
    onItemClick: handleItemClick,
    logoFontStyle: header.logoFontStyle,
  };

  return (
    <>
      <HeaderShell config={header} scrollState={scrollState} staticPosition={isPreview || forceMobile}>
        {isLogoLeft ? (
          // Configured variant is already LogoLeft — render once at all sizes.
          <VariantComponent {...sharedVariantProps} forceMobile={forceMobile} />
        ) : (
          // Mobile (< lg) always renders LogoLeft for safety; desktop (lg+)
          // renders the configured variant. Mutually exclusive via CSS.
          <>
            <div className="w-full lg:hidden">
              <LogoLeftComponent {...sharedVariantProps} forceMobile />
            </div>
            <div className="hidden w-full lg:block">
              <VariantComponent {...sharedVariantProps} forceMobile={forceMobile} />
            </div>
          </>
        )}
      </HeaderShell>

      <FormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        form={selectedForm}
        siteId={siteId || ''}
      />
    </>
  );
};
