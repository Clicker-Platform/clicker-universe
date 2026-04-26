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
  BNIB: 'text-yellow-400 border-yellow-400',
  BNOB: 'text-cyan-400 border-cyan-400',
  SECOND: 'text-yellow-300 border-yellow-300',
  BROKEN: 'text-red-400 border-red-400',
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
