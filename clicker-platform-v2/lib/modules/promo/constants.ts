// lib/modules/promo/constants.ts
import { PromoSettings } from './types';

export const PROMOS_COLLECTION = 'modules/promo/promos';
export const VOUCHERS_COLLECTION = 'modules/promo/vouchers';
export const SETTINGS_DOC = 'modules/promo/settings/config';

export const DEFAULT_PROMO_SETTINGS: Omit<PromoSettings, 'updatedAt'> = {
  voucherCodePrefix: 'VCH',
  defaultVoucherExpiryDays: 30,
  allowGuestCodes: true,
};

export const VOUCHER_CODE_BLOCK_LENGTH = 4; // 4 alphanumeric chars per block
