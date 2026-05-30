// Platform-level account identity tier. NOT the loyalty module (lib/modules/membership).
// NOT sites/{siteId}/members (that is staff RBAC — see admin-auth.ts).
export const COLLECTION_ACCOUNTS = 'accounts'; // sites/{siteId}/accounts/{uid}

// Magic-link token `module` scope for the account tier. Deliberately 'account'
// (NOT 'member') so it can never collide with any loyalty-module magic-link scope.
export const ACCOUNT_MODULE_SCOPE = 'account';
