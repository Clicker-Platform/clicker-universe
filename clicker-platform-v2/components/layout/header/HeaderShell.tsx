'use client';

import React from 'react';
import { useTemplate } from '@/components/TemplateProvider';
import type { HeaderNavigationConfig } from '@/data/mockData';

interface HeaderShellProps {
  config: HeaderNavigationConfig;
  scrollState: { visible: boolean; scrolled: boolean; shrunk: boolean };
  /** When true, render position:relative (Canvas preview). When false, follow config.scrollBehavior. */
  staticPosition?: boolean;
  children: React.ReactNode;
}

export const HeaderShell: React.FC<HeaderShellProps> = ({
  config,
  scrollState,
  staticPosition = false,
  children,
}) => {
  const { theme } = useTemplate();
  const { width, scrollBehavior, bgColor, showBorder, scrolledAppearance } = config;
  const { visible, scrolled, shrunk } = scrollState;

  // Resolve bg + border, applying scrolled-state overrides when enabled
  const isScrolledOverride = scrolledAppearance.enabled && scrolled;
  const effectiveBg = isScrolledOverride
    ? scrolledAppearance.bgColor ?? theme.colors.background
    : bgColor ?? theme.colors.background;
  const showBorderEffective = isScrolledOverride
    ? scrolledAppearance.showBorder ?? false
    : showBorder ?? true;

  // Dev-mode warning when theme.colors.border is missing
  if (process.env.NODE_ENV !== 'production' && showBorderEffective && !theme.colors.border) {
    console.warn('[HeaderShell] theme.colors.border is undefined; using foreground-derived fallback. Add `border` to your template tokens.');
  }

  const borderColor = showBorderEffective
    ? theme.colors.border ?? `${theme.colors.foreground}26`
    : 'transparent';

  // Positioning
  const positionClass = staticPosition
    ? 'relative z-10 w-full'
    : scrollBehavior === 'none'
      ? 'relative z-10 w-full'
      : 'fixed top-0 left-0 right-0 z-50';

  // Visibility (sticky-on-scroll-up)
  const visibilityStyle: React.CSSProperties =
    !staticPosition && scrollBehavior === 'sticky-on-scroll-up' && !visible
      ? { transform: 'translateY(-100%)' }
      : { transform: 'translateY(0)' };

  // Height (shrink-on-scroll)
  const isStacked = config.variant === 'logo-left-stacked';
  const heightClass = isStacked
    ? 'min-h-[64px]'
    : shrunk
      ? 'h-14'
      : scrollBehavior === 'shrink-on-scroll'
        ? 'h-20'
        : 'h-16';

  // Inner container width.
  // "constrained" matches the page body's container width via the
  // --layout-max-width CSS var (set by TemplateProvider from the
  // template's containerWidth: narrow/boxed/tablet/full).
  const innerClass =
    width === 'constrained'
      ? 'mx-auto w-full h-full px-4 flex items-center'
      : 'w-full h-full px-4 flex items-center';

  const innerStyle: React.CSSProperties =
    width === 'constrained'
      ? { maxWidth: 'var(--layout-max-width)' }
      : {};

  return (
    <nav
      className={`${positionClass} ${heightClass} border-b transition-all duration-300`}
      style={{ backgroundColor: effectiveBg, borderColor, ...visibilityStyle }}
    >
      <div className={innerClass} style={innerStyle}>{children}</div>
    </nav>
  );
};
