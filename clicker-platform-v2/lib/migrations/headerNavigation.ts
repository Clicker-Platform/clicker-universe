import type {
  HeaderNavigationConfig,
  NavigationItem,
  HeaderCTA,
} from '@/data/mockData';

interface LegacyNavigationShape {
  header?: HeaderNavigationConfig;
  topNav?: NavigationItem[];
  topNavActions?: { cta?: HeaderCTA } | null;
  headerStyle?: { bgColor?: string; showBorder?: boolean };
}

const NEW_SITE_DEFAULTS: HeaderNavigationConfig = {
  variant: 'logo-left',
  width: 'constrained',
  scrollBehavior: 'fixed',
  items: [],
  cta: { enabled: false, label: '', linkType: 'url', linkValue: '' },
  typography: { preset: 'default' },
  scrolledAppearance: { enabled: false },
};

export function synthesizeHeaderConfig(
  legacy: LegacyNavigationShape | undefined,
): HeaderNavigationConfig {
  if (legacy?.header) return legacy.header;

  if (!legacy || (!legacy.topNav && !legacy.topNavActions && !legacy.headerStyle)) {
    return NEW_SITE_DEFAULTS;
  }

  // Existing tenant — preserve today's look exactly
  return {
    variant: 'logo-left',
    width: 'full',
    scrollBehavior: 'fixed',
    items: legacy.topNav ?? [],
    cta:
      legacy.topNavActions?.cta ?? {
        enabled: false,
        label: '',
        linkType: 'url',
        linkValue: '',
      },
    bgColor: legacy.headerStyle?.bgColor,
    showBorder: legacy.headerStyle?.showBorder ?? true,
    typography: { preset: 'spacious' },
    scrolledAppearance: { enabled: false },
  };
}
