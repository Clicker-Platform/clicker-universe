'use client';

import React, { useState } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { NavigationItem, HeaderCTA, BusinessProfile } from '@/data/mockData';

export interface VariantProps {
  profile: BusinessProfile;
  siteId?: string;
  items: NavigationItem[];
  cta: HeaderCTA;
  typographyClass: string;
  onItemClick: (e: React.MouseEvent, item: NavigationItem) => void;
  forceMobile?: boolean;
  logoFontStyle?: 'heading' | 'body';
}

export const LogoLeftHeader: React.FC<VariantProps> = ({
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

  const showMobileToggle = items.length > 0 || cta.enabled;

  return (
    <div className="flex items-center justify-between w-full relative">
      <NavLogo profile={profile} siteId={siteId} logoFontStyle={logoFontStyle} />

      <div className="flex items-center gap-4 relative z-10">
        <NavMenu
          items={items}
          typographyClass={typographyClass}
          onItemClick={onItemClick}
          className={forceMobile ? 'hidden' : 'hidden lg:flex'}
          gap="gap-6"
        />

        <div className={forceMobile ? 'hidden' : 'hidden lg:block'} data-testid="desktop-cta">
          <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
        </div>

        <div className={forceMobile ? 'hidden' : 'hidden lg:flex'} data-testid="desktop-menu" />

        {showMobileToggle && (
          <div className={forceMobile ? 'block' : 'lg:hidden'}>
            <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
          </div>
        )}
      </div>

      {isMenuOpen && (
        <div
          className="absolute inset-x-0 top-full mt-2 z-50 p-6 rounded-xl shadow-lg flex flex-col gap-2"
          style={{ backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
        >
          <NavMenu
            items={items}
            // Mobile dropdown: force readable size + 44px tap target,
            // ignoring the (often-too-tight) desktop typography preset.
            typographyClass="text-base font-medium tracking-normal py-2 min-h-[44px] flex items-center w-full"
            onItemClick={(e, item) => {
              onItemClick(e, item);
              setIsMenuOpen(false);
            }}
            className="flex-col items-start"
            gap="gap-1"
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
