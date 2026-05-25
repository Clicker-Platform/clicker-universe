'use client';

import { useEffect } from 'react';
import { getButtonPackById, getDefaultButtonPack } from '@/lib/buttonPacks/packs';
import { DEFAULT_BUTTON_COLORS } from '@/lib/buttonPacks/types';
import type { ButtonPack, ButtonColors, ButtonPackId } from '@/lib/buttonPacks/types';
import { pickContrastText } from '@/lib/buttonPacks/contrast';

type Props = {
  packId: ButtonPackId | null;
  colors?: Partial<ButtonColors>;
  children?: React.ReactNode;
};

export function buildButtonCssVars(pack: ButtonPack, colors: ButtonColors): Record<string, string> {
  const primaryText = colors.primaryText ?? pickContrastText(colors.primaryFill);
  return {
    '--btn-radius': `${pack.radius}px`,
    '--btn-border-width': `${pack.borderWidth}px`,
    '--btn-font-weight': String(pack.fontWeight),
    '--btn-tracking': pack.letterSpacing,
    '--btn-transform': pack.textTransform,

    '--btn-sm-pad-y': `${pack.sizes.sm.padY}px`,
    '--btn-sm-pad-x': `${pack.sizes.sm.padX}px`,
    '--btn-sm-font':  `${pack.sizes.sm.fontSize}px`,
    '--btn-md-pad-y': `${pack.sizes.md.padY}px`,
    '--btn-md-pad-x': `${pack.sizes.md.padX}px`,
    '--btn-md-font':  `${pack.sizes.md.fontSize}px`,
    '--btn-lg-pad-y': `${pack.sizes.lg.padY}px`,
    '--btn-lg-pad-x': `${pack.sizes.lg.padX}px`,
    '--btn-lg-font':  `${pack.sizes.lg.fontSize}px`,

    '--btn-primary-fill':     colors.primaryFill,
    '--btn-primary-text':     primaryText,
    '--btn-secondary-border': colors.secondaryBorder,
    '--btn-secondary-text':   colors.secondaryText,
    '--btn-tertiary-text':    colors.tertiaryText,
  };
}

export function ButtonPackProvider({ packId, colors, children }: Props) {
  const pack = getButtonPackById(packId) ?? getDefaultButtonPack();
  const resolved: ButtonColors = { ...DEFAULT_BUTTON_COLORS, ...(colors ?? {}) };

  useEffect(() => {
    const root = document.documentElement;
    const vars = buildButtonCssVars(pack, resolved);
    for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
    root.setAttribute('data-tertiary-style', pack.tertiaryStyle);
    return () => {
      for (const k of Object.keys(vars)) root.style.removeProperty(k);
      root.removeAttribute('data-tertiary-style');
    };
  }, [pack, resolved.primaryFill, resolved.primaryText, resolved.secondaryBorder, resolved.secondaryText, resolved.tertiaryText]);

  return <>{children}</>;
}
