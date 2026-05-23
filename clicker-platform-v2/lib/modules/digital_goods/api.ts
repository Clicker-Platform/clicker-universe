// Digital Goods Module — Firestore API
// All paths from constants.ts. Site-scoped, never hardcoded.

export function generateSlug(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')                        // strip diacritics
    .replace(/[̀-ͯ]/g, '')          // remove combining marks
    .replace(/[^a-z0-9\s-]/g, '')             // keep only alphanumerics, spaces, hyphens
    .trim()
    .replace(/[\s-]+/g, '-')                  // collapse spaces/hyphens
    .replace(/^-+|-+$/g, '');                 // trim hyphens
}
