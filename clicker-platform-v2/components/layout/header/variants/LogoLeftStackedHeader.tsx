'use client';

import React, { useState } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { VariantProps } from './LogoLeftHeader';

/**
 * Two-row layout: logo + CTA on top, menu below.
 * Note: HeaderShell needs to allow a tall variant — Task 16 wires that.
 */
export const LogoLeftStackedHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
  logoFontStyle,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();
  const borderColor = theme.colors.border ?? `${theme.colors.foreground}26`;

  return (
    <div className="flex flex-col w-full py-2 gap-2 relative">
      <div className="flex items-center justify-between w-full">
        <NavLogo profile={profile} siteId={siteId} logoFontStyle={logoFontStyle} />
        <div className="flex items-center gap-3">
          <div className={forceMobile ? 'hidden' : 'hidden lg:block'}>
            <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
          </div>
          {(items.length > 0 || cta.enabled) && (
            <div className={forceMobile ? 'block' : 'lg:hidden'}>
              <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
            </div>
          )}
        </div>
      </div>

      <div
        className={`${forceMobile ? 'hidden' : 'hidden lg:flex'} items-center pt-2 border-t`}
        style={{ borderColor }}
      >
        <NavMenu items={items} typographyClass={typographyClass} onItemClick={onItemClick} gap="gap-6" />
      </div>

      {isMenuOpen && (
        <div
          className="absolute inset-x-0 top-full mt-2 z-50 p-6 rounded-xl shadow-lg flex flex-col gap-4"
          style={{ backgroundColor: theme.colors.background, borderColor }}
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
