'use client';

import React, { useCallback } from 'react';
import Link from 'next/link';
import { useTemplate } from '@/components/TemplateProvider';
import { useSite } from '@/lib/site-context';
import { resolveNavHref } from '@/lib/resolveNavHref';
import type { NavigationItem } from '@/data/mockData';

interface NavMenuProps {
  items: NavigationItem[];
  typographyClass: string;
  onItemClick: (e: React.MouseEvent, item: NavigationItem) => void;
  className?: string;
  gap?: string;
}

export const NavMenu: React.FC<NavMenuProps> = ({
  items,
  typographyClass,
  onItemClick,
  className = '',
  gap = 'gap-6',
}) => {
  const { tenantSlug, isSubdomain } = useSite();
  const { theme } = useTemplate();
  const textMuted = `${theme.colors.foreground}99`;

  const getHref = useCallback(
    (val: string) => resolveNavHref(val, tenantSlug, isSubdomain),
    [tenantSlug, isSubdomain]
  );

  // Phase 1: ignore item.children. Phase 2 will add drop-down rendering.

  return (
    <div className={`flex items-center ${gap} ${className}`}>
      {items.map((item) => (
        <Link
          key={item.id}
          href={getHref(item.value)}
          onClick={(e) => onItemClick(e, item)}
          className={`${typographyClass} hover:opacity-100 transition-opacity`}
          style={{ color: textMuted }}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
};
