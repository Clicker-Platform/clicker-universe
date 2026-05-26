// Digital Goods Module — path constants
// Never hardcode these strings elsewhere — always import from here

export const MODULE_ID = 'digital_goods';

// Firestore collection paths (relative to sites/{siteId}/)
export const COLLECTION_BUYERS   = 'modules/digital_goods/buyers';     // Plan 2 (auto-provisioned on first authed visit)
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

// Permission key (registered in RBAC)
export const PERM_MANAGE = 'digital_goods.manage';

// Defaults
export const DEFAULT_CURRENCY = 'IDR' as const;

// Plan 2 — Public buyer routes (tenant-scoped — see feedback memory: tenant routes under [tenant])
// IMPORTANT: login is owned by digital_goods (NOT /member/login which lives in the loyalty module
// by accident — see CLAUDE.md rule 10). Route built in Plan 2 Task 4b.
export const publicRoutes = (tenant: string) => ({
  store:        `/${tenant}/store`,
  storeItem:    (slug: string)     => `/${tenant}/store/${slug}`,
  checkout:     (slug: string)     => `/${tenant}/store/${slug}/checkout`,
  library:      `/${tenant}/library`,
  libraryEntry: (entryId: string)  => `/${tenant}/library/${entryId}`,
  orderStatus:  (orderId: string)  => `/${tenant}/library/orders/${orderId}`,
  login:        `/${tenant}/store/login`,
  loginVerify:  `/${tenant}/store/login/verify`,
  profile:      `/${tenant}/profile`,
  onboarding:   `/${tenant}/onboarding`,
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
