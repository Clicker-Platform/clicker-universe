// Digital Goods Module — path constants
// Never hardcode these strings elsewhere — always import from here

export const MODULE_ID = 'digital_goods';

// Firestore collection paths (relative to sites/{siteId}/)
export const COLLECTION_PRODUCTS = 'modules/digital_goods/products';
export const COLLECTION_ORDERS   = 'modules/digital_goods/orders';     // Plan 2
export const COLLECTION_LIBRARY  = 'modules/digital_goods/library';    // Plan 2
export const DOC_SETTINGS        = 'modules/digital_goods/settings/config';

// Storage paths (mirrors Firestore)
export const STORAGE_FOLDER_PRODUCTS = 'modules/digital_goods/products';
export const STORAGE_FOLDER_QRIS     = 'modules/digital_goods/settings';
export const MAX_PDF_MB = 50;
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

// Admin route paths
export const ROUTES = {
  list:     '/admin/digital-goods',
  orders:   '/admin/digital-goods/orders',
  settings: '/admin/digital-goods/settings',
} as const;

// Defaults
export const DEFAULT_CURRENCY = 'IDR' as const;

// Public storefront routes (tenant-scoped — see feedback memory: tenant routes under [tenant]).
// The storefront stays canvas-built; buyer identity is now the platform account tier
// (/[tenant]/account/*), so library/order/login/profile routes no longer live here.
export const publicRoutes = (tenant: string) => ({
  store:        `/${tenant}/store`,
  storeItem:    (slug: string)     => `/${tenant}/store/${slug}`,
  checkout:     (slug: string)     => `/${tenant}/store/${slug}/checkout`,
});

// Plan 2 — Storage subfolders
export const STORAGE_FOLDER_PRODUCT_FILES = `${STORAGE_FOLDER_PRODUCTS}/files`;

// Plan 2 — Signed URL TTL for PDF downloads (15 minutes)
export const SIGNED_URL_TTL_SECONDS = 15 * 60;

// Plan 2 — Email template alias KEYS (looked up via getTemplateAliases())
export const EMAIL_ALIAS_KEYS = {
  newOrderTenant: 'digitalGoodsNewOrderTenant',
  orderPaidBuyer: 'digitalGoodsOrderPaidBuyer',
} as const;
