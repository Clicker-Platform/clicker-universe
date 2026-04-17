export function clearSessionCookies() {
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
  const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const secureFlag = isSecure ? '; Secure' : '';
  document.cookie = `__session=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
  if (isSecure && baseDomain) {
    document.cookie = `__session=; path=/; max-age=0; Domain=.${baseDomain}; SameSite=Lax; Secure`;
  }
}
