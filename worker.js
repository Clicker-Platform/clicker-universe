/**
 * Cloudflare Worker - Multi-Tenant Subdomain Masking
 * Version: v16 - Apex Domain as "go" Tenant + www Marketing
 *
 * CHANGELOG v16:
 * - clicker.id (apex) sekarang serve tenant "go" (clickerapps.web.app/go/*)
 * - go.clicker.id/* → 301 redirect ke clicker.id/* (preserve path + query)
 * - www.clicker.id → marketing website (clicker-universe.web.app)
 * - Hapus rule "clicker.id/{slug} → {slug}.clicker.id" (apex sudah jadi tenant)
 * - Tenant lain hanya akses via subdomain (e.g. quattro.clicker.id)
 *
 * CHANGELOG v15:
 * - Smart edge caching: static assets (JS/CSS/fonts/images) di-cache 1 tahun di edge
 * - HTML tetap no-cache untuk hindari stale chunk reference
 * - Font preload via HTMLRewriter (REMOVED in v16: caused 17x duplicate injection via streaming SSR)
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
 * - Add CNAME record: www → <worker-name>.<account>.workers.dev (Proxied)
 * - Add CNAME record: go → <worker-name>.<account>.workers.dev (Proxied)
 */

const HOSTS = {
    website: 'clicker-universe.web.app',             // Marketing/Landing website (clicker-website repo)
    authGateway: 'clicker-auth-gateway.web.app',     // Auth Gateway
    clickerPlatform: 'clickerapps.web.app',          // Main multi-tenant app
    backyard: 'clicker-backyard-app.web.app',        // Backyard Admin
};

// Apex domain (clicker.id) sekarang adalah tenant "go"
const APEX_TENANT_SLUG = 'go';

// Subdomains that should NOT be treated as tenant slugs
const RESERVED_SUBDOMAINS = ['www', 'backyard', 'admin', 'api', 'staging', 'app', 'auth', 'login', 'go'];

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
    async fetch(request, _env) {
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
        // LEGACY REDIRECT: go.clicker.id → clicker.id (v16)
        // ============================================
        // Tenant "go" sekarang berada di apex domain.
        // 301 redirect untuk preserve SEO dan backward-compat bookmark user.
        if (subdomain === 'go') {
            const redirectUrl = `https://clicker.id${pathname}${url.search}`;
            return Response.redirect(redirectUrl, 301);
        }

        // ============================================
        // RESERVED SUBDOMAINS (Special Routing)
        // ============================================

        // www.clicker.id → Marketing website (v16)
        if (subdomain === 'www') {
            return proxyRequest(request, HOSTS.website, pathname, null, startTime);
        }

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

        if (subdomain && !RESERVED_SUBDOMAINS.includes(subdomain)) {
            // IMPORTANT: Don't prefix static assets and special routes with tenant slug.
            // These paths should pass through as-is to Firebase.
            // SYNC: Keep this list in sync with middleware.ts `specialRoutes` and apex paths below.
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
        // APEX DOMAIN (clicker.id/*) — TENANT "go" (v16)
        // ============================================
        // Apex sekarang serve tenant "go". Semua path di-prefix dengan /go
        // KECUALI reserved paths (api, auth, static assets) yang tetap di-route khusus.

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

        // Static assets & special platform paths yang TIDAK perlu prefix tenant.
        // Paths ini pass-through ke platform tanpa diubah.
        const apexPassThroughPaths = [
            '/_next/', '/__nextjs', '/seed/',
            '/favicon', '/robots', '/sitemap', '/manifest',
            '/api/',
            '/member/',
            '/catalog',
            '/warranty',
        ];
        const isApexPassThrough = apexPassThroughPaths.some(prefix => pathname.startsWith(prefix));

        if (isApexPassThrough) {
            return proxyRequest(request, HOSTS.clickerPlatform, pathname, APEX_TENANT_SLUG, startTime);
        }

        // Safety: clicker.id/go atau clicker.id/go/anything → strip /go prefix, 301 redirect.
        // Mencegah double-prefix loop: worker akan prefix /go lagi → /go/go/... → loop.
        if (pathname === `/${APEX_TENANT_SLUG}` || pathname.startsWith(`/${APEX_TENANT_SLUG}/`)) {
            const strippedPath = pathname.slice(`/${APEX_TENANT_SLUG}`.length) || '/';
            return Response.redirect(`https://clicker.id${strippedPath}${url.search}`, 301);
        }

        // Default apex: prefix path dengan /go dan proxy ke platform.
        // clicker.id/        → clickerapps.web.app/go
        // clicker.id/promo   → clickerapps.web.app/go/promo
        // clicker.id/admin   → clickerapps.web.app/go/admin
        // clicker.id/about   → clickerapps.web.app/go/about
        const tenantPath = `/${APEX_TENANT_SLUG}${pathname === '/' ? '' : pathname}`;
        return proxyRequest(request, HOSTS.clickerPlatform, tenantPath, APEX_TENANT_SLUG, startTime);
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
        // Always request identity (no compression) from origin so we can read/modify the body.
        // Cloudflare automatically re-compresses the response to the browser.
        headers.set('Accept-Encoding', 'identity');
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
        // REDIRECT LOCATION REWRITING (v16 — apex tenant aware)
        // ============================================
        // CRITICAL: Rewrite Location header for redirects to use masked domains
        // Without this, middleware 302 redirects expose raw .web.app URLs to the browser
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('Location');
            if (location) {
                let maskedLocation = location
                    .replace('https://clicker-auth-gateway.web.app', 'https://auth.clicker.id')
                    .replace('https://clicker-backyard-app.web.app', 'https://backyard.clicker.id')
                    .replace('https://clicker-universe.web.app', 'https://www.clicker.id'); // marketing now on www

                // Tenant-aware rewriting for platform redirects.
                // e.g. clickerapps.web.app/quattro/admin → quattro.clicker.id/admin
                //      clickerapps.web.app/go/admin     → clicker.id/admin (apex tenant)
                if (maskedLocation.includes('https://clickerapps.web.app')) {
                    const platformPath = maskedLocation.replace('https://clickerapps.web.app', '');
                    if (tenantSlug) {
                        const pathSegments = platformPath.split('?')[0].split('/').filter(Boolean);
                        const queryString = platformPath.includes('?') ? '?' + platformPath.split('?')[1] : '';

                        // v16: Apex tenant "go" → rewrite ke clicker.id (tanpa subdomain)
                        if (tenantSlug === APEX_TENANT_SLUG) {
                            if (pathSegments[0] === APEX_TENANT_SLUG) {
                                // Strip tenant prefix — apex sudah implies tenant "go"
                                const remainingPath = '/' + pathSegments.slice(1).join('/');
                                maskedLocation = `https://clicker.id${remainingPath === '/' ? '' : remainingPath}${queryString}`;
                            } else {
                                maskedLocation = `https://clicker.id${platformPath}`;
                            }
                        } else {
                            // Tenant biasa → subdomain
                            if (pathSegments[0] === tenantSlug) {
                                const remainingPath = '/' + pathSegments.slice(1).join('/');
                                maskedLocation = `https://${tenantSlug}.clicker.id${remainingPath === '/' ? '' : remainingPath}${queryString}`;
                            } else {
                                maskedLocation = `https://${tenantSlug}.clicker.id${platformPath}`;
                            }
                        }
                    } else {
                        // No tenant context — default ke apex (tenant "go")
                        maskedLocation = `https://clicker.id${platformPath}`;
                    }
                }

                newResponse.headers.set('Location', maskedLocation);
            }
        }

        // ============================================
        // DEBUG & MONITORING HEADERS
        // ============================================
        newResponse.headers.set('X-Served-By', 'clicker-gateway-v16');
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

        return newResponse;
    } catch (error) {
        return new Response(`Gateway Error: ${error.message}\nTarget: ${targetUrl}`, {
            status: 502,
            headers: { 'Content-Type': 'text/plain' }
        });
    }
}
