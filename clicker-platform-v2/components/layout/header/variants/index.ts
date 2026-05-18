import React from 'react';
import type { HeaderVariant } from '@/data/mockData';
import type { VariantProps } from './LogoLeftHeader';
import { LogoLeftHeader } from './LogoLeftHeader';
import { LogoCenterHeader } from './LogoCenterHeader';
import { BurgerHeader } from './BurgerHeader';
import { LogoLeftStackedHeader } from './LogoLeftStackedHeader';

export type { VariantProps } from './LogoLeftHeader';

export const HEADER_VARIANTS: Record<HeaderVariant, React.FC<VariantProps>> = {
  'logo-left': LogoLeftHeader,
  'logo-center': LogoCenterHeader,
  'burger': BurgerHeader,
  'logo-left-stacked': LogoLeftStackedHeader,
};
