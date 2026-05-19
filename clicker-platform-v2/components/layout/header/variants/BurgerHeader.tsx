'use client';

import React, { useState, useEffect, useRef } from 'react';
import { NavLogo } from '../parts/NavLogo';
import { NavMenu } from '../parts/NavMenu';
import { NavCTA } from '../parts/NavCTA';
import { BurgerButton } from '../parts/BurgerButton';
import { useTemplate } from '@/components/TemplateProvider';
import type { VariantProps } from './LogoLeftHeader';

export const BurgerHeader: React.FC<VariantProps> = ({
  profile,
  siteId,
  items,
  cta,
  typographyClass,
  onItemClick,
  forceMobile = false,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { theme } = useTemplate();
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape closes the panel
  useEffect(() => {
    if (!isMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMenuOpen]);

  return (
    <div className="flex items-center justify-between w-full relative">
      <NavLogo profile={profile} siteId={siteId} />

      <div className="flex items-center gap-3">
        <NavCTA cta={cta} typographyClass={typographyClass} onItemClick={onItemClick} />
        <BurgerButton isOpen={isMenuOpen} onClick={() => setIsMenuOpen(!isMenuOpen)} />
      </div>

      {isMenuOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Navigation menu"
          className="absolute right-0 top-full mt-2 z-50 min-w-[240px] p-6 rounded-xl shadow-lg border flex flex-col gap-4"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border ?? `${theme.colors.foreground}26`,
          }}
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
        </div>
      )}
    </div>
  );
};
