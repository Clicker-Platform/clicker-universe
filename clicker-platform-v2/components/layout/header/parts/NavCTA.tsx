'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import type { HeaderCTA, NavigationItem } from '@/data/mockData';

interface NavCTAProps {
  cta: HeaderCTA;
  typographyClass: string;
  onItemClick: (e: React.MouseEvent, item: NavigationItem) => void;
  fullWidth?: boolean;
}

export const NavCTA: React.FC<NavCTAProps> = ({
  cta,
  typographyClass,
  onItemClick,
  fullWidth = false,
}) => {
  const { tenantSlug, isSubdomain } = useSite();
  const { theme } = useTemplate();

  const getHref = useCallback(
    (val: string) => resolveNavHref(val, tenantSlug, isSubdomain),
    [tenantSlug, isSubdomain]
  );

  if (!cta.enabled) return null;

  const actionItem: NavigationItem = {
    id: 'cta',
    label: cta.label,
    type: cta.linkType,
    value: cta.linkValue,
    formId: cta.formId,
  };

  const sizeClass = fullWidth ? 'w-full py-5 text-center' : 'px-5 py-2';

  return (
    <Link
      href={getHref(cta.linkValue)}
      onClick={(e) => onItemClick(e, actionItem)}
      className={`${sizeClass} rounded-full hover:opacity-90 transition-opacity ${typographyClass}`}
      style={{
        backgroundColor: theme.colors.primary,
        color: theme.colors.accentForeground ?? theme.colors.background,
      }}
    >
      {cta.label || 'Order'}
    </Link>
  );
};
