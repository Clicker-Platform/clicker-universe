import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'auth', 'backyard', 'go',
  'app', 'dashboard', 'login', 'register', 'public',
  'static', 'assets', 'cdn', 'mail', 'ftp', 'ns',
  'support', 'help', 'docs', 'blog', 'status',
  'platform', 'clicker', 'clickerapps', 'gateway',
]);

const SLUG_FORMAT = /^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/;

export interface SlugValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateSlugFormat(slug: string): SlugValidationResult {
  if (!slug) return { ok: false, reason: 'Slug wajib diisi' };
  if (slug.length < 3) return { ok: false, reason: 'Slug minimal 3 karakter' };
  if (slug.length > 30) return { ok: false, reason: 'Slug maksimal 30 karakter' };
  if (!SLUG_FORMAT.test(slug)) {
    return { ok: false, reason: 'Hanya huruf kecil, angka, dan tanda hubung (-)' };
  }
  if (RESERVED_SLUGS.has(slug)) {
    return { ok: false, reason: `"${slug}" adalah slug reserved, pilih yang lain` };
  }
  return { ok: true };
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const ref = doc(db, 'sites', slug);
  const snap = await getDoc(ref);
  return !snap.exists();
}
