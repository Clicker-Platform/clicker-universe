/**
 * Multi-Tenant Middleware (Path-Based)
 * 
 * Handles routing for multi-tenant platform where:
 * - / = Static landing page (no tenant)
 * - /admin = Admin dashboard
 * - /{tenant} = Tenant biolink (e.g., /quattro)
 * - /{tenant}/{slug} = Tenant subpages (e.g., /quattro/about)
 * 
 * @module middleware
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
    matcher: [
        /*
         * Match all paths except for:
         * 1. /api routes
         * 2. /_next (Next.js internals)
         * 3. /_static (inside /public)
         * 4. all root files inside /public (e.g. /favicon.ico)
         */
        "/((?!api/|_next/|_static/|[\\w-]+\\.\\w+).*)",
    ],
};

export async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split('/').filter(Boolean);

    // Special routes that are NOT tenant identifiers
    // These routes remain at the root level and are handled by Next.js routing directly
    const specialRoutes = [
        'admin',
        'auth',
        'member',
        'catalog',
        'login',
        'register',
        'invite',
        'setup',
        'dashboard',
        'api',
        '_next'
    ];

    const hostname = request.headers.get('host') || '';
    const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN;
    if (!baseDomain) {
        console.error('[Middleware] NEXT_PUBLIC_BASE_DOMAIN is not defined');
        return new NextResponse('Site Configuration Missing (Base Domain)', { status: 500 });
    }
    const isLocal = hostname.includes('localhost');
    const protocol = isLocal ? 'http' : 'https';
    // Firebase default domains (e.g. stg-clicker-core.web.app) don't support custom subdomains.
    // On these domains, path-based routing must be used instead of subdomain-based routing.
    const isFirebaseDefaultDomain = baseDomain.includes('.web.app');

    // Prioritize Cloudflare's original host header since Firebase Hosting overrides 'host' to .web.app
    const rawForwardedHost = request.headers.get('x-clicker-original-host') || request.headers.get('x-forwarded-host');
    const forwardedHost = (rawForwardedHost && !rawForwardedHost.includes('.web.app')) ? rawForwardedHost : null;

    let currentHost = forwardedHost || hostname;
    if (process.env.NODE_ENV === 'development') {
        // Handle localhost if needed, e.g. kasisehat.localhost:3000
        currentHost = currentHost.replace('.localhost:3000', `.${baseDomain}`);
    }

    // Check if subdomain
    const isSubdomain = currentHost.endsWith(`.${baseDomain}`) && currentHost !== `www.${baseDomain}`;

    if (isSubdomain) {
        const subdomain = currentHost.replace(`.${baseDomain}`, '');

        // Skip if special route is already in path (prevent double prefixing)
        // e.g. if path is /kasisehat/home, don't rewrite to /kasisehat/kasisehat/home
        // But if subdomain is 'admin', that's different.

        if (subdomain === 'admin' || subdomain === 'auth') {
            // Let explicit admin/auth logic handle it below or pass through
        } else if (segments.length >= 1 && specialRoutes.includes(segments[0])) {
            // SKIP REWRITE for special routes (api, admin, auth, etc.) on subdomains
            // This ensures kasisehat.clicker.id/api/upload/avatar stays as /api/upload/avatar
        } else {
            // REWRITE LOGIC
            // kasisehat.clicker.id/ -> /kasisehat
            // kasisehat.clicker.id/about -> /kasisehat/about

            // Avoid rewrite if path already starts with subdomain (unlikely from browser, but possible internally)
            if (!pathname.startsWith(`/${subdomain}`)) {
                const newPath = `/${subdomain}${pathname}`;
                const url = request.nextUrl.clone();
                url.pathname = newPath;
                return NextResponse.rewrite(url);
            }
        }
    }

    // ===================================
    // ROOT PATH: Static Landing Page (Main Domain Only)
    // ===================================
    if (pathname === '/' && !isSubdomain) {
        // No tenant - just pass through to static landing page
        // No x-site-id header needed
        return NextResponse.next();
    }

    // ===================================
    // SPECIAL ROUTES: Admin, Auth, etc.
    // ===================================
    if (segments.length >= 1 && specialRoutes.includes(segments[0])) {
        const requestHeaders = new Headers(request.headers);
        const subdomain = isSubdomain ? currentHost.replace(`.${baseDomain}`, '') : null;

        // Determine Site ID
        let siteId = 'platform';
        if (subdomain && subdomain !== 'www' && subdomain !== 'admin' && subdomain !== 'auth') {
            siteId = subdomain;
        }

        // For admin routes, read siteId from activeSite cookie (override subdomain if set)
        if (segments[0] === 'admin') {
            // Firebase Hosting only allows '__session' cookie
            const activeSite = request.cookies.get('__session')?.value;
            if (activeSite) siteId = activeSite;

            // Auth Gateway URL (centralized login)
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
            const tenantSlug = request.headers.get('x-tenant-slug');

            if (!gatewayUrl) {
                console.error('[Middleware] NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined');
                // Return a clear error instead of redirecting to prod
                return new NextResponse('Authentication Gateway Configuration Missing', { status: 500 });
            }

            // Explicitly signal subdomain status to Server Components
            if (forwardedHost && forwardedHost !== baseDomain && forwardedHost.endsWith(`.${baseDomain}`)) {
                requestHeaders.set('x-clicker-is-subdomain', 'true');
            }

            // Build full redirect URL with masked domain (not Firebase URL)
            const buildRedirectUrl = (path: string): string => {
                if (forwardedHost) {
                    // Use the actual masked domain
                    return `${protocol}://${forwardedHost}${path}`;
                } else if (tenantSlug && isFirebaseDefaultDomain) {
                    // Path-based for Firebase default domains (.web.app) — subdomains not supported.
                    // e.g. https://stg-clicker-core.web.app/stagging/admin
                    return `${protocol}://${baseDomain}/${tenantSlug}${path}`;
                } else if (tenantSlug) {
                    // Subdomain-based for custom domains (e.g. kasisehat.clicker.id/admin)
                    return `${protocol}://${tenantSlug}.${baseDomain}${path}`;
                }
                // Last fallback: just the path
                return path;
            };

            // If user tries to access /admin/login directly, redirect to Gateway
            if (pathname.startsWith('/admin/login')) {
                const returnPath = request.nextUrl.searchParams.get('redirect') || '/admin';
                const redirectBackUrl = buildRedirectUrl(returnPath);
                return NextResponse.redirect(`${gatewayUrl}?redirect=${encodeURIComponent(redirectBackUrl)}`);
            }

            // If no activeSite cookie and not on callback/claim pages, redirect to Gateway
            if (!activeSite && !pathname.startsWith('/admin/auth/callback') && !pathname.startsWith('/admin/claim-admin')) {
                const redirectBackUrl = buildRedirectUrl(pathname);
                return NextResponse.redirect(`${gatewayUrl}?redirect=${encodeURIComponent(redirectBackUrl)}`);
            }


            // STRICT MULTI-TENANT REDIRECT:
            // If we have an active site, but the URL is generic '/admin...',
            // Redirect to 'https://:siteId.clicker.id/admin...' to enforce tenant subdomain.
            // Exclude auth callbacks to prevent loops. Skip in local dev to stay on localhost.
            // SKIP for .web.app domains (Firebase default domains) — they don't support custom subdomains.
            // On .web.app, path-based routing is used instead (e.g. /stagging/admin).
            if (!isLocal && !isFirebaseDefaultDomain && activeSite && !pathname.startsWith('/admin/auth/')) {
                const targetHost = `${activeSite}.${baseDomain}`;
                if (currentHost !== targetHost) {
                    // Construct new URL
                    const newUrl = `${protocol}://${targetHost}${pathname}`;
                    return NextResponse.redirect(newUrl);
                }
            }

            requestHeaders.set('x-site-id', siteId);
        } else {
            // For other special routes (api, member, etc.), use the detected siteId
            requestHeaders.set('x-site-id', siteId);
        }

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    }

    // ===================================
    // 0. DOUBLE PREFIX SANITIZER (Safety Net)
    // ===================================
    // If path starts with /tenant/tenant (e.g. /hi-clicker/hi-clicker/...), redirect to the clean path
    if (segments.length >= 2 && segments[0] === segments[1]) {
        const url = request.nextUrl.clone();
        if (isSubdomain) {
            // Drop BOTH prefixes for the browser redirect on subdomain (e.g. /demo/demo/admin -> /admin)
            // Because Cloudflare will prepend the first one automatically
            url.pathname = '/' + segments.slice(2).join('/');
        } else {
            // Drop ONE prefix on root domain
            url.pathname = '/' + segments.slice(1).join('/');
        }
        return NextResponse.redirect(url);
    }

    // ===================================
    // TENANT ROUTES: /{tenant} or /{tenant}/{slug}
    // ===================================
    if (segments.length >= 1) {
        const tenant = segments[0];

        // Set tenant info in headers for Server Components to read
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set('x-tenant-slug', tenant);
        requestHeaders.set('x-site-id', tenant);

        // DETECT TENANT ADMIN ROUTE (e.g. /quattro/admin/...)
        // Need auth check before allowing access
        if (segments.length >= 2 && segments[1] === 'admin') {
            const activeSite = request.cookies.get('__session')?.value;
            const hostname = request.headers.get('host') || '';

            // CANONICAL REDIRECT:
            // If accessing via root domain (clicker.id/quattro/admin),
            // Redirect to subdomain (quattro.clicker.id/admin).
            // SKIP this on localhost if the user wants path-based routing (localhost:3000/demo/admin).
            // SKIP for .web.app domains (Firebase default domains) — they don't support custom subdomains.
            // On .web.app, path-based routing is used (e.g. stg-clicker-core.web.app/stagging/admin).
            if (!isLocal && !isFirebaseDefaultDomain && (hostname === baseDomain || hostname === `www.${baseDomain}`)) {
                const cleanPath = '/' + segments.slice(1).join('/'); // /admin/...
                const newUrl = `https://${tenant}.${baseDomain}${cleanPath}`;
                return NextResponse.redirect(newUrl);
            }

            // Auth Gateway URL
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;

            if (!gatewayUrl) {
                console.error('[Middleware] NEXT_PUBLIC_AUTH_GATEWAY_URL is not defined for tenant admin');
                return new NextResponse('Authentication Gateway Configuration Missing', { status: 500 });
            }

            // Use the top-level forwardedHost (which strips .web.app domains)

            // Build full redirect URL with masked domain
            const buildRedirectUrl = (path: string): string => {
                // Strip tenant prefix from path (e.g. /quattro/admin -> /admin)
                // because the masked domain (quattro.clicker.id) already implies the tenant
                let targetPath = path;
                if (path.startsWith(`/${tenant}`)) {
                    targetPath = path.replace(`/${tenant}`, '') || '/';
                }

                if (forwardedHost) {
                    return `${protocol}://${forwardedHost}${targetPath}`;
                } else if (isFirebaseDefaultDomain) {
                    // Path-based for Firebase default domains (.web.app) — subdomains not supported.
                    // e.g. https://stg-clicker-core.web.app/stagging/admin
                    return `${protocol}://${baseDomain}/${tenant}${targetPath}`;
                } else {
                    // Subdomain-based for custom domains (e.g. quattro.clicker.id/admin)
                    return `${protocol}://${tenant}.${baseDomain}${targetPath}`;
                }
            };

            // Skip auth check for callback routes
            const adminPath = '/' + segments.slice(1).join('/');
            const isCallbackRoute = adminPath.startsWith('/admin/auth/callback') || adminPath.startsWith('/admin/claim-admin');

            // If no session and not on callback, redirect to auth gateway
            if (!activeSite && !isCallbackRoute) {
                const currentPath = '/' + segments.join('/'); // Keep full path like /hi-clicker/admin
                const redirectBackUrl = buildRedirectUrl(currentPath);
                return NextResponse.redirect(`${gatewayUrl}?redirect=${encodeURIComponent(redirectBackUrl)}`);
            }

            // Rewrite to /admin/... so app/admin directory handles it
            // but keep the tenant context in headers.
            const newPath = '/' + segments.slice(1).join('/');
            const url = request.nextUrl.clone();
            url.pathname = newPath;

            // Explicitly signal subdomain status to Server Components
            // Since this block is only hit when Cloudflare rewrites a request from a subdomain
            // (e.g. clicker.id/admin hits the special routes block instead),
            // we can definitively set this to true, bypassing the unreliability of Firebase headers.
            requestHeaders.set('x-clicker-is-subdomain', 'true');

            return NextResponse.rewrite(url, {
                request: {
                    headers: requestHeaders,
                },
            });
        }


        // Let Next.js routing handle the path normally
        // [tenant]/page.tsx will handle /{tenant}
        // [tenant]/[...slug]/page.tsx will handle /{tenant}/{slug}
        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
    }

    // ===================================
    // FALLBACK
    // ===================================
    return NextResponse.next();
}
