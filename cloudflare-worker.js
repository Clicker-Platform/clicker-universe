// Cloudflare Worker for Subdomain → Path Rewriting
// Deploy this to Cloudflare Workers & Pages
// Route: *.clicker.id/*

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const hostname = url.hostname;

        // Configuration
        const rootDomain = 'clicker.id';
        const platformDomain = 'clickerapps.web.app';
        const authDomain = 'clicker-auth-gateway.web.app';

        // Special case: auth.clicker.id → clicker-auth-gateway.web.app
        if (hostname === `auth.${rootDomain}`) {
            const newUrl = `https://${authDomain}${url.pathname}${url.search}`;

            console.log(`[Worker] Auth Rewrite: ${url.href} → ${newUrl}`);

            const response = await fetch(newUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                redirect: 'manual'
            });

            const newResponse = new Response(response.body, response);
            newResponse.headers.set('X-Worker-Rewrite', 'auth-gateway');

            return newResponse;
        }

        // Tenant subdomains: tenant.clicker.id → clickerapps.web.app/tenant
        if (hostname.endsWith(`.${rootDomain}`) && hostname !== rootDomain && hostname !== `auth.${rootDomain}`) {
            // Extract subdomain: quattro.clicker.id → "quattro"
            const tenant = hostname.replace(`.${rootDomain}`, '');

            // Rewrite URL: quattro.clicker.id/about → clickerapps.web.app/quattro/about
            const newUrl = `https://${platformDomain}/${tenant}${url.pathname}${url.search}`;

            console.log(`[Worker] Tenant Rewrite: ${url.href} → ${newUrl}`);

            // Fetch from Firebase Hosting
            const response = await fetch(newUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
                redirect: 'manual'
            });

            // Clone response to modify headers if needed
            const newResponse = new Response(response.body, response);

            // Add debug header to verify Worker is running
            newResponse.headers.set('X-Worker-Rewrite', `tenant:${tenant}`);

            return newResponse;
        }

        // For main domain (clicker.id) or non-matching, pass through
        // Could also redirect to docs/landing page
        if (hostname === rootDomain) {
            return new Response('Clicker Platform - Use tenant.clicker.id to access your site', {
                status: 200,
                headers: { 'Content-Type': 'text/plain' }
            });
        }

        return fetch(request);
    }
}
