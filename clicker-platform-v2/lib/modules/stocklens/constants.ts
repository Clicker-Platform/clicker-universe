export const STOCKLENS_SKUS = 'modules/stocklens/skus';
export const STOCKLENS_UNITS = 'units';
export const STOCKLENS_CONFIG = 'modules/stocklens/private/config';
export const STOCKLENS_STORAGE = 'stocklens/units';

export const CONDITION_LABELS = {
  BNIB: 'Brand New In Box',
  BNOB: 'Brand New Open Box',
  SECOND: 'Bekas Normal',
  BROKEN: 'Rusak',
} as const;

export const CONDITION_COLORS = {
  BNIB: 'text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20',
  BNOB: 'text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-700/50 bg-blue-50 dark:bg-blue-900/20',
  SECOND: 'text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20',
  BROKEN: 'text-red-600 dark:text-red-400 border-red-300 dark:border-red-700/50 bg-red-50 dark:bg-red-900/20',
} as const;

export const CATEGORY_CODES = [
  'ELC', 'TOY', 'SHO', 'CLO', 'GAM', 'SPT', 'HOM', 'BOO', 'ACC', 'GEN',
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  ELC: 'Electronics',
  TOY: 'Toys / Collectible',
  SHO: 'Shoes',
  CLO: 'Clothing / Fashion',
  GAM: 'Gaming',
  SPT: 'Sports',
  HOM: 'Home / Living',
  BOO: 'Books',
  ACC: 'Accessories',
  GEN: 'General / Mixed',
};
