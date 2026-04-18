// Firestore path: sites/{siteId}/wa/main/{subcollection}
// WA_ROOT = collection, WA_MAIN_DOC = anchor doc, then subcollections
export const WA_ROOT = 'wa';
export const WA_MAIN_DOC = 'main';
export const WA_CUSTOMER_THREADS = 'customer_threads';
export const WA_STAFF_COMMANDS = 'staff_commands';
export const WA_CONTACTS = 'contacts';
export const WA_TEMPLATES = 'templates';
export const WA_RAW_MESSAGES = 'raw_messages';

// For doc() calls: doc(db, 'sites', siteId, WA_ROOT, 'config')
export const WA_CONFIG_DOC = 'config';


// Meta API
export const META_API_BASE = 'https://graph.facebook.com/v19.0';
export const META_MESSAGES_ENDPOINT = (phoneNumberId: string) =>
  `${META_API_BASE}/${phoneNumberId}/messages`;
