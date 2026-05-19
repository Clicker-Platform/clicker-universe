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

const SIZE_OVERRIDE: Record<NonNullable<HeaderTypography['sizeOverride']>, string> = {
  'sm': 'text-sm',
  'md': 'text-base',
  'lg': 'text-lg',
};

const WEIGHT_OVERRIDE: Record<NonNullable<HeaderTypography['weightOverride']>, string> = {
  'normal': 'font-normal',
  'medium': 'font-medium',
  'semibold': 'font-semibold',
  'bold': 'font-bold',
};

export function resolveHeaderTypographyClass(typography: HeaderTypography): string {
  let classes = PRESETS[typography.preset];

  if (typography.trackingOverride) {
    classes = classes.replace(/tracking-\S+/g, '').trim();
    classes += ' ' + TRACKING_OVERRIDE[typography.trackingOverride];
  }

  if (typography.sizeOverride) {
    classes = classes.replace(/\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g, '').trim();
    classes += ' ' + SIZE_OVERRIDE[typography.sizeOverride];
  }

  if (typography.weightOverride) {
    classes = classes.replace(/\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g, '').trim();
    classes += ' ' + WEIGHT_OVERRIDE[typography.weightOverride];
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
