export const FT_WALLETS    = 'modules/fintrack/wallets';
export const FT_ENTRIES    = 'modules/fintrack/entries';
export const FT_TRANSFERS  = 'modules/fintrack/transfers';
export const FT_CATEGORIES = 'modules/fintrack/categories';
export const FT_BUDGETS    = 'modules/fintrack/budgets';
export const FT_GOALS      = 'modules/fintrack/goals';
export const FT_DEBTS      = 'modules/fintrack/debts';
export const FT_RECURRING  = 'modules/fintrack/recurring';
export const FT_CONFIG     = 'modules/fintrack/private/config';

export const DEFAULT_CATEGORIES: Omit<import('./types').FintrackCategory, 'id'>[] = [
  { nama: 'Makanan & Minuman', icon: '🍴', warna: '#F97316', isDefault: true },
  { nama: 'Transport',         icon: '🚗', warna: '#3B82F6', isDefault: true },
  { nama: 'Belanja',           icon: '🛍️', warna: '#A855F7', isDefault: true },
  { nama: 'Tagihan',           icon: '📋', warna: '#EF4444', isDefault: true },
  { nama: 'Kesehatan',         icon: '💊', warna: '#10B981', isDefault: true },
  { nama: 'Hiburan',           icon: '🎮', warna: '#F59E0B', isDefault: true },
  { nama: 'Gaji',              icon: '💰', warna: '#22C55E', isDefault: true },
  { nama: 'Lainnya',           icon: '📦', warna: '#6B7280', isDefault: true },
];

export const WALLET_TYPE_SUGGESTIONS = ['Bank', 'E-Wallet', 'Cash', 'Investasi'];
export const WALLET_ICONS = ['🏦', '💳', '📱', '💵', '💼', '🏧', '💎', '🪙'];
export const WALLET_COLORS = ['#C8A951', '#4FC3F7', '#50C878', '#E05C5C', '#A855F7', '#F97316', '#3B82F6', '#10B981'];
