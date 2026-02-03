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

    // ===================================
    // ROOT PATH: Static Landing Page
    // ===================================
    if (pathname === '/') {
        // No tenant - just pass through to static landing page
        // No x-site-id header needed
        return NextResponse.next();
    }

    // ===================================
    // SPECIAL ROUTES: Admin, Auth, etc.
    // ===================================
    if (segments.length >= 1 && specialRoutes.includes(segments[0])) {
        const requestHeaders = new Headers(request.headers);

        // For admin routes, read siteId from activeSite cookie
        if (segments[0] === 'admin') {
            const activeSite = request.cookies.get('activeSite')?.value;

            // Auth Gateway URL (centralized login)
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL || 'http://localhost:3012';

            // If user tries to access /admin/login directly, redirect to Gateway
            if (pathname.startsWith('/admin/login')) {
                const returnPath = request.nextUrl.searchParams.get('redirect') || '/admin';
                return NextResponse.redirect(`${gatewayUrl}?redirect=${encodeURIComponent(returnPath)}`);
            }

            // If no activeSite cookie and not on callback/claim pages, redirect to Gateway
            if (!activeSite && !pathname.startsWith('/admin/auth/callback') && !pathname.startsWith('/admin/claim-admin')) {
                return NextResponse.redirect(`${gatewayUrl}?redirect=${encodeURIComponent(pathname)}`);
            }

            // Set siteId from cookie (or 'pending' for login/claim pages)
            requestHeaders.set('x-site-id', activeSite || 'pending');
        } else {
            // Other special routes (auth, member, etc.) - platform level
            requestHeaders.set('x-site-id', 'platform');
        }

        return NextResponse.next({
            request: {
                headers: requestHeaders,
            },
        });
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
