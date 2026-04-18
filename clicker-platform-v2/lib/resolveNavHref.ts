/**
 * Resolves a stored nav link value to a fully-qualified path for the current deployment mode.
 *
 * Stored values:
 *   'action:homepage' | 'action:home' → tenant root  (always '/' relative to tenant)
 *   '/some-slug'                       → tenant-relative page
 *   'https://...'                      → absolute URL, returned as-is
 *   'action:...'                       → other actions, returned as '#'
 *
 * Path-based (localhost / clicker.id/go):  prepend /{tenantSlug}
 * Subdomain   (go.clicker.id):             no prefix needed, '/' is already the tenant root
 */
export function resolveNavHref(
    value: string | undefined,
    tenantSlug: string,
    isSubdomain: boolean
): string {
    if (!value) return '#';

    // Homepage shortcut
    if (value === 'action:home' || value === 'action:homepage') {
        return isSubdomain ? '/' : `/${tenantSlug}`;
    }

    // Other special actions
    if (value.startsWith('action:')) return '#';

    // Absolute URLs — return as-is
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('mailto:') || value.startsWith('tel:')) {
        return value;
    }

    // Relative page slug (e.g. '/pos')
    if (value.startsWith('/')) {
        return isSubdomain ? value : `/${tenantSlug}${value}`;
    }

    return value;
}
