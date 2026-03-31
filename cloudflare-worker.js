/**
 * Cloudflare Worker - Multi-Tenant Subdomain Masking
 * Version: v14 - Prevent HTML caching to avoid stale chunk reference 404s
 *
 * DEPLOYMENT:
 * 1. Go to Cloudflare Dashboard → Workers & Pages
 * 2. Create/Edit your worker
 * 3. Paste this code
 * 4. Deploy
 *
 * DNS SETUP:
 * - Add CNAME record: * → <worker-name>.<account>.workers.dev (Proxied)
 * - Add CNAME record: @ → <worker-name>.<account>.workers.dev (Proxied)
 */

const HOSTS = {
    website: 'clicker-universe.web.app',             // Marketing/Landing website (clicker-website repo)
    authGateway: 'clicker-auth-gateway.web.app',     // Auth Gateway
    clickerPlatform: 'clickerapps.web.app',          // Main multi-tenant app
    backyard: 'clicker-backyard-app.web.app',        // Backyard Admin
};

// Subdomains that should NOT be treated as tenant slugs
const RESERVED_SUBDOMAINS = ['www', 'backyard', 'admin', 'api', 'staging', 'app', 'auth', 'login'];

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const hostname = url.hostname;
        const pathname = url.pathname;

        // Extract subdomain from hostname
        const parts = hostname.split('.');
        let subdomain = null;

        // Handle workers.dev testing domain
        if (hostname.endsWith('workers.dev')) {
            // Format: <subdomain>.<worker>.<account>.workers.dev
            if (parts.length > 4) {
                subdomain = parts.slice(0, -4).join('.');
            }
        } else {
            // Standard custom domain: <subdomain>.clicker.id
            if (parts.length > 2) {
                subdomain = parts.slice(0, -2).join('.');
            }
        }

        // ============================================
        // RESERVED SUBDOMAINS (Special Routing)
        // ============================================

        // backyard.clicker.id → Backyard Admin Console
        if (subdomain === 'backyard') {
            return proxyRequest(request, HOSTS.backyard, pathname);
        }

        // auth.clicker.id/* → Auth Gateway
        if (subdomain === 'auth' || subdomain === 'login') {
            return proxyRequest(request, HOSTS.authGateway, pathname);
        }

        // ============================================
        // TENANT SUBDOMAINS (Dynamic Routing)
        // ============================================
        // quattro.clicker.id/* → clickerapps.web.app/quattro/*
        // hi-clicker.clicker.id/admin → clickerapps.web.app/hi-clicker/admin

        if (subdomain && subdomain !== 'www' && !RESERVED_SUBDOMAINS.includes(subdomain)) {
            // IMPORTANT: Don't prefix static assets and special routes with tenant slug.
            // These paths should pass through as-is to Firebase.
            // SYNC: Keep this list in sync with middleware.ts `specialRoutes` and rootReservedPaths below.
            const staticPaths = [
                '/_next/', '/favicon', '/robots', '/sitemap', '/manifest', '/__nextjs', '/seed/',
                '/api/',
                '/member/',
                '/catalog',   // Public catalog page — not tenant-specific
                '/warranty',  // Public warranty card page — not tenant-specific
            ];
            const isStaticPath = staticPaths.some(prefix => pathname.startsWith(prefix));


            if (isStaticPath) {
                // Static assets: pass through without tenant prefix
                return proxyRequest(request, HOSTS.clickerPlatform, pathname, subdomain);
            }

            // Dynamic pages: prepend tenant slug to path
            const tenantPath = `/${subdomain}${pathname === '/' ? '' : pathname}`;
            return proxyRequest(request, HOSTS.clickerPlatform, tenantPath, subdomain);
        }


        // ============================================
        // ROOT DOMAIN PATHS (clicker.id/*)
        // ============================================

        // Known non-tenant first-path-segments on the root domain.
        // Everything NOT in this list is treated as a tenant slug → 301 redirect to subdomain.
        // SYNC: When adding a new top-level route to the app, add it here too.
        const rootReservedPaths = [
            '/_next/', '/__nextjs',
            '/api/',
            '/admin',
            '/login',
            '/auth',
            '/catalog',
            '/warranty',
            '/member/',
            '/seed/',
            '/favicon', '/robots', '/sitemap', '/manifest',
        ];

        const firstSegment = pathname.split('/').filter(Boolean)[0];
        const isRootReservedPath = rootReservedPaths.some(prefix => pathname.startsWith(prefix));

        // TENANT SLUG DETECTION:
        // If path has a first segment that is not a known reserved path,
        // treat it as a tenant slug and 301-redirect to the canonical subdomain URL.
        // e.g. clicker.id/mrb → mrb.clicker.id
        //      clicker.id/quattro/about → quattro.clicker.id/about
        if (!isRootReservedPath && firstSegment) {
            const remainingSegments = pathname.split('/').filter(Boolean).slice(1);
            const restOfPath = remainingSegments.length > 0 ? '/' + remainingSegments.join('/') : '';
            const redirectUrl = `https://${firstSegment}.clicker.id${restOfPath}${url.search}`;
            return Response.redirect(redirectUrl, 301);
        }

        // /login → Redirect to auth.clicker.id (NOT proxy)
        // IMPORTANT: Must redirect, not proxy, because proxying causes _next/static
        // assets to be fetched from clicker.id (which routes to platform, not auth-gateway)
        // resulting in 404s due to mismatched build chunk hashes.
        if (pathname.startsWith('/login')) {
            const searchParams = url.search || '';
            return Response.redirect(`https://auth.clicker.id${searchParams}`, 302);
        }

        // /auth/* → Auth Gateway (strip /auth prefix)
        if (pathname.startsWith('/auth')) {
            const newPath = pathname.replace('/auth', '') || '/';
            return proxyRequest(request, HOSTS.authGateway, newPath);
        }

        // Default: All other root domain paths (/, /admin, /catalog, /warranty, /api, etc.)
        // NOTE: /_next/ and /__nextjs must go to HOSTS.website — their chunks belong to the website build.
        //       Routing /_next/ to platform was causing 404s because the chunk hashes don't match.
        const platformOnlyPaths = ['/api/', '/admin', '/catalog', '/warranty', '/member/'];
        if (platformOnlyPaths.some(prefix => pathname.startsWith(prefix))) {
            return proxyRequest(request, HOSTS.clickerPlatform, pathname);
        }

        // Root /, /_next/, /__nextjs, and all other unmatched paths → Marketing website
        return proxyRequest(request, HOSTS.website, pathname);
    }
};

/**
 * Proxy request to target Firebase Hosting
 * Simplified version - uses direct fetch
 */
async function proxyRequest(request, targetHost, targetPath, tenantSlug = null) {
    // Build the target URL
    const originalUrl = new URL(request.url);
    const targetUrl = `https://${targetHost}${targetPath}${originalUrl.search}`;

    try {
        // Construct headers from original request so we don't lose Content-Type, Authorization, etc.
        const headers = new Headers(request.headers);
        headers.set('Host', targetHost);
        headers.set('X-Forwarded-Host', request.headers.get('Host') || '');
        headers.set('X-Clicker-Original-Host', request.headers.get('Host') || ''); // Custom header to bypass Firebase overwrites
        headers.set('X-Forwarded-Proto', 'https');
        if (tenantSlug) {
            headers.set('X-Tenant-Slug', tenantSlug);
        }

        const fetchOptions = {
            method: request.method,
            headers: headers,
            redirect: 'manual',
        };

        // Forward the request body for methods that support it
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            fetchOptions.body = request.body;
            // Cloudflare Workers requires duplex: 'half' when streaming the request body
            fetchOptions.duplex = 'half';
        }

        // Use direct fetch with constructed options
        // cf.cacheEverything: false ensures Cloudflare doesn't cache HTML pages.
        // Static assets (_next/static/) are still cached by Cloudflare's default rules.
        const response = await fetch(targetUrl, {
            ...fetchOptions,
            cf: {
                // Don't cache HTML — prevents stale chunk-hash references after redeploy
                cacheEverything: false,
            },
        });

        // Create new response with modified headers
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });

        // Force no-cache on HTML responses so browsers always get fresh chunk references
        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
            newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }

        // CRITICAL: Rewrite Location header for redirects to use masked domains
        // Without this, middleware 302 redirects expose raw .web.app URLs to the browser
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            if (location) {
                let maskedLocation = location
                    .replace('https://clicker-auth-gateway.web.app', 'https://auth.clicker.id')
                    .replace('https://clicker-backyard-app.web.app', 'https://backyard.clicker.id')
                    .replace('https://clicker-universe.web.app', 'https://clicker.id'); // legacy stub

                // Tenant-aware rewriting for platform redirects.
                // e.g. clickerapps.web.app/quattro/admin → quattro.clicker.id/admin (not clicker.id/quattro/admin)
                if (maskedLocation.includes('https://clickerapps.web.app')) {
                    const platformPath = maskedLocation.replace('https://clickerapps.web.app', '');
                    if (tenantSlug) {
                        const pathSegments = platformPath.split('?')[0].split('/').filter(Boolean);
                        const queryString = platformPath.includes('?') ? '?' + platformPath.split('?')[1] : '';
                        if (pathSegments[0] === tenantSlug) {
                            // Strip the tenant prefix — subdomain already implies the tenant
                            // e.g. /quattro/admin → quattro.clicker.id/admin
                            const remainingPath = '/' + pathSegments.slice(1).join('/');
                            maskedLocation = `https://${tenantSlug}.clicker.id${remainingPath === '/' ? '' : remainingPath}${queryString}`;
                        } else {
                            // No tenant prefix in path — keep path on tenant subdomain
                            maskedLocation = `https://${tenantSlug}.clicker.id${platformPath}`;
                        }
                    } else {
                        // No tenant context — use root domain
                        maskedLocation = `https://clicker.id${platformPath}`;
                    }
                }

                newResponse.headers.set('Location', maskedLocation);
            }
        }

        // Add debug headers
        newResponse.headers.set('X-Served-By', 'clicker-gateway-v13');
        newResponse.headers.set('X-Routed-To', targetHost);
        newResponse.headers.set('X-Target-Path', targetPath);
        if (tenantSlug) {
            newResponse.headers.set('X-Tenant-Slug', tenantSlug);
        }

        // Add permissive CSP
        newResponse.headers.set('Content-Security-Policy',
            "default-src 'self' https: data: blob:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; " +
            "style-src 'self' 'unsafe-inline' https:; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' https: wss:; " +
            "font-src 'self' https: data:;"
        );

        return newResponse;
    } catch (error) {
        return new Response(`Gateway Error: ${error.message}\nTarget: ${targetUrl}`, {
            status: 502,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}

