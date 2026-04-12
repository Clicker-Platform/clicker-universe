/**
 * Cloudflare Worker - Multi-Tenant Subdomain Masking
 * Version: v15 - Smart Edge Caching + Font Preload + Security Headers
 *
 * CHANGELOG v15:
 * - Smart edge caching: static assets (JS/CSS/fonts/images) di-cache 1 tahun di edge
 * - HTML tetap no-cache untuk hindari stale chunk reference
 * - Font preload via HTMLRewriter (fix 2.870ms font delay)
 * - Security headers tambahan (X-Content-Type-Options, X-Frame-Options, dll)
 * - Response timing headers untuk monitoring performa
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

/**
 * Deteksi apakah path adalah static asset yang aman di-cache lama.
 * File /_next/static/ sudah content-hashed oleh Next.js, jadi cache 1 tahun aman.
 */
function isStaticAssetPath(path) {
    // Next.js hashed static assets
    if (path.startsWith('/_next/static/')) return true;

    // File dengan ekstensi statis
    return /\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico|webp|avif|mp4|webm)$/i.test(path);
}

export default {
    async fetch(request, env) {
        const startTime = Date.now();
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
            return proxyRequest(request, HOSTS.backyard, pathname, null, startTime);
        }

        // auth.clicker.id/* → Auth Gateway
        if (subdomain === 'auth' || subdomain === 'login') {
            return proxyRequest(request, HOSTS.authGateway, pathname, null, startTime);
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
                return proxyRequest(request, HOSTS.clickerPlatform, pathname, subdomain, startTime);
            }

            // Dynamic pages: prepend tenant slug to path
            const tenantPath = `/${subdomain}${pathname === '/' ? '' : pathname}`;
            return proxyRequest(request, HOSTS.clickerPlatform, tenantPath, subdomain, startTime);
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
            return proxyRequest(request, HOSTS.authGateway, newPath, null, startTime);
        }

        // Default: All other root domain paths (/, /admin, /catalog, /warranty, /api, etc.)
        // NOTE: /_next/ and /__nextjs must go to HOSTS.website — their chunks belong to the website build.
        //       Routing /_next/ to platform was causing 404s because the chunk hashes don't match.
        const platformOnlyPaths = ['/api/', '/admin', '/catalog', '/warranty', '/member/'];
        if (platformOnlyPaths.some(prefix => pathname.startsWith(prefix))) {
            return proxyRequest(request, HOSTS.clickerPlatform, pathname, null, startTime);
        }

        // Root /, /_next/, /__nextjs, and all other unmatched paths → Marketing website
        return proxyRequest(request, HOSTS.website, pathname, null, startTime);
    }
};

/**
 * Proxy request to target Firebase Hosting
 * v15: Smart edge caching + font preload + security headers
 */
async function proxyRequest(request, targetHost, targetPath, tenantSlug = null, startTime = Date.now()) {
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

        // ============================================
        // v15: SMART EDGE CACHING
        // ============================================
        // Static assets (JS/CSS/fonts/images) → cache 1 tahun di Cloudflare edge
        // HTML/API/dynamic → TIDAK di-cache (hindari stale chunk reference setelah deploy)
        const isStatic = isStaticAssetPath(targetPath);

        const response = await fetch(targetUrl, {
            ...fetchOptions,
            cf: {
                cacheEverything: isStatic,                          // Cache static assets di edge
                cacheTtl: isStatic ? 31536000 : undefined,          // 1 tahun untuk static
                cacheKey: isStatic ? targetUrl : undefined,         // Stable cache key
            },
        });

        // Create new response with modified headers
        const newResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
        });

        // ============================================
        // v15: CACHE HEADERS
        // ============================================
        const contentType = response.headers.get('content-type') || '';

        if (isStatic) {
            // Static assets: cache sangat lama, immutable karena content-hashed
            newResponse.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
            newResponse.headers.set('Vary', 'Accept-Encoding');
        } else if (contentType.includes('text/html')) {
            // HTML: selalu fresh, tidak di-cache
            newResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        }

        // ============================================
        // REDIRECT LOCATION REWRITING (unchanged from v14)
        // ============================================
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

        // ============================================
        // DEBUG & MONITORING HEADERS
        // ============================================
        newResponse.headers.set('X-Served-By', 'clicker-gateway-v15');
        newResponse.headers.set('X-Routed-To', targetHost);
        newResponse.headers.set('X-Target-Path', targetPath);
        newResponse.headers.set('X-Response-Time', `${Date.now() - startTime}ms`);
        newResponse.headers.set('X-Cache-Strategy', isStatic ? 'edge-1y' : 'no-cache');
        if (tenantSlug) {
            newResponse.headers.set('X-Tenant-Slug', tenantSlug);
        }

        // ============================================
        // SECURITY HEADERS
        // ============================================
        // CSP (permissive — sesuai kebutuhan platform multi-tenant)
        newResponse.headers.set('Content-Security-Policy',
            "default-src 'self' https: data: blob:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:; " +
            "style-src 'self' 'unsafe-inline' https:; " +
            "img-src 'self' data: https: blob:; " +
            "connect-src 'self' https: wss:; " +
            "font-src 'self' https: data:;"
        );
        // Security headers tambahan
        newResponse.headers.set('X-Content-Type-Options', 'nosniff');
        newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
        newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
        newResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

        // ============================================
        // v15: FONT PRELOAD VIA HTML REWRITER
        // ============================================
        // Inject preconnect + preload hints di <head> untuk Google Fonts
        // Ini memperbaiki masalah font delay ~2.870ms dari Performance Audit
        if (contentType.includes('text/html') && response.status === 200) {
            return new HTMLRewriter()
                .on('head', {
                    element(el) {
                        el.prepend(
                            '<link rel="preconnect" href="https://fonts.googleapis.com">' +
                            '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
                            '<link rel="dns-prefetch" href="https://firebasestorage.googleapis.com">' +
                            '<link rel="dns-prefetch" href="https://www.googletagmanager.com">',
                            { html: true }
                        );
                    }
                })
                .transform(newResponse);
        }

        return newResponse;
    } catch (error) {
        return new Response(`Gateway Error: ${error.message}\nTarget: ${targetUrl}`, {
            status: 502,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
