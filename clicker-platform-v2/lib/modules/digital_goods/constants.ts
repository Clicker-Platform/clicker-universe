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
  list:        '/admin/digital-goods',
  productNew:  '/admin/digital-goods/products/new',
  productEdit: '/admin/digital-goods/products/edit',
  settings:    '/admin/digital-goods/settings',
} as const;

// Permission key (registered in RBAC)
export const PERM_MANAGE = 'digital_goods.manage';

// Defaults
export const DEFAULT_CURRENCY = 'IDR' as const;
