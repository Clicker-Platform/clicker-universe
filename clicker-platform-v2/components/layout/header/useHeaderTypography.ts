import type { HeaderTypography, HeaderNavTextPreset } from '@/data/mockData';

const PRESETS: Record<HeaderNavTextPreset, string> = {
  'default': 'text-sm font-medium tracking-normal',
  'tight': 'text-sm font-semibold tracking-tight uppercase',
  'spacious': 'text-xs font-bold tracking-[0.2em] uppercase',
  'sentence-case': 'text-base font-medium tracking-normal',
};

const TRACKING_OVERRIDE: Record<NonNullable<HeaderTypography['trackingOverride']>, string> = {
  'normal': 'tracking-normal',
  'tight': 'tracking-tight',
  'wide': 'tracking-wider',
};

export function resolveHeaderTypographyClass(typography: HeaderTypography): string {
  let classes = PRESETS[typography.preset];

  if (typography.trackingOverride) {
    classes = classes.replace(/tracking-\S+/g, '').trim();
    classes += ' ' + TRACKING_OVERRIDE[typography.trackingOverride];
  }

  if (typography.caseOverride === 'none') {
    classes = classes.replace(/\buppercase\b/g, '').trim();
  } else if (typography.caseOverride === 'uppercase') {
    if (!classes.includes('uppercase')) classes += ' uppercase';
  }

  return classes.replace(/\s+/g, ' ').trim();
}

export function useHeaderTypography(typography: HeaderTypography): string {
  return resolveHeaderTypographyClass(typography);
}
