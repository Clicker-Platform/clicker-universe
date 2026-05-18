'use client';

import React, { useState, useMemo } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { VariantProps } from './LogoLeftHeader';

export const LogoCenterHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
  isSubPage = false,
  pageTitle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();

  // Split items: left half | right half
  const { leftItems, rightItems } = useMemo(() => {
    const mid = Math.ceil(items.length / 2);
    return { leftItems: items.slice(0, mid), rightItems: items.slice(mid) };
  }, [items]);

  const showMobileToggle = items.length > 0 || cta.enabled;

  return (
    <div className="flex items-center justify-between w-full relative">
      {/* Desktop: left menu | logo (center) | right menu + CTA */}
      <div className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center gap-6 flex-1`}>
        <NavMenu items={leftItems} typographyClass={typographyClass} onItemClick={onItemClick} gap="gap-6" />
      </div>

      <div className={`${forceMobile ? 'flex-1' : 'lg:flex-none'} flex justify-center`}>
        <NavLogo
          profile={profile}
          siteId={siteId}
          isSubPage={isSubPage}
          pageTitle={pageTitle}
          forceMobile={forceMobile}
        />
      </div>

      <div className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center justify-end gap-6 flex-1`}>
        <NavMenu items={rightItems} typographyClass={typographyClass} onItemClick={onItemClick} gap="gap-6" />
        <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
      </div>

      {/* Mobile: burger on the right */}
      {showMobileToggle && (
        <div className={`${forceMobile ? 'block' : 'lg:hidden'} flex-shrink-0`}>
          <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
        </div>
      )}

      {isMenuOpen && (
        <div
          className="absolute inset-x-0 top-full mt-2 z-50 p-6 rounded-xl shadow-lg flex flex-col gap-4"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
        >
          <NavMenu
            items={items}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            className="flex-col items-start"
            gap="gap-4"
          />
          <NavCTA
            cta={cta}
            typographyClass={typographyClass}
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            fullWidth
          />
        </div>
      )}
    </div>
  );
};
