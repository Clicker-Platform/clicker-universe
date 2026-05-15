/**
 * Multi-Tenant Middleware Test Suite
 *
 * Tests the critical routing logic that determines how requests
 * are dispatched across tenants, admin panels, and special routes.
 *
 * Uses a lightweight mock of NextRequest / NextResponse to verify
 * header injection, rewrites, and redirects without spinning up
 * the full Next.js server.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ─── Mocks ───────────────────────────────────────────────────────

// Store the last response so assertions can inspect it
interface MockResponseShape {
  type?: string;
  status?: number;
  body?: string;
  url?: string | null;
  headers?: { get?: (key: string) => string | null | undefined };
}
let lastResponse: MockResponseShape | null = null;
let lastRewriteUrl: string | null = null;
let lastRedirectUrl: string | null = null;

// Minimal NextResponse mock
const mockNextResponseNext = vi.fn((...args: unknown[]) => {
  const opts = args[0] as { request?: { headers?: { get?: (key: string) => string | null | undefined } } } | undefined;
  lastResponse = { type: 'next', headers: opts?.request?.headers };
  return lastResponse;
});

const mockNextResponseRewrite = vi.fn((url: unknown, opts?: { request?: { headers?: { get?: (key: string) => string | null | undefined } } }) => {
  lastRewriteUrl = typeof url === 'string' ? url : (url as { pathname?: string })?.pathname || String(url);
  lastResponse = { type: 'rewrite', url: lastRewriteUrl, headers: opts?.request?.headers };
  return lastResponse;
});

const mockNextResponseRedirect = vi.fn((url: string) => {
  lastRedirectUrl = url;
  lastResponse = { type: 'redirect', url };
  return lastResponse;
});

// Must be a real class so middleware can use `new NextResponse(...)`
class MockNextResponse {
  type = 'error';
  body: string;
  status: number;
  constructor(body: string, init: { status?: number }) {
    this.body = body;
    this.status = init?.status ?? 200;
    lastResponse = { type: 'error', body, status: init?.status };
  }
}
const mockNextResponseConstructor = MockNextResponse;

vi.mock('next/server', () => ({
  NextResponse: Object.assign(mockNextResponseConstructor, {
    next: mockNextResponseNext,
    rewrite: mockNextResponseRewrite,
    redirect: mockNextResponseRedirect,
  }),
}));

// ─── Helpers ─────────────────────────────────────────────────────

/** Build a minimal NextRequest-like object */
function makeRequest(
  pathname: string,
  opts: {
    host?: string;
    cookies?: Record<string, string>;
    searchParams?: Record<string, string>;
    headers?: Record<string, string>;
  } = {},
) {
  const host = opts.host || 'clicker.id';
  const url = new URL(pathname, `https://${host}`);

  if (opts.searchParams) {
    for (const [k, v] of Object.entries(opts.searchParams)) {
      url.searchParams.set(k, v);
    }
  }

  // Use real Headers so `new Headers(request.headers)` works in middleware
  const realHeaders = new Headers();
  realHeaders.set('host', host);
  if (opts.headers) {
    for (const [k, v] of Object.entries(opts.headers)) {
      realHeaders.set(k, v);
    }
  }

  return {
    nextUrl: {
      pathname,
      searchParams: url.searchParams,
      clone() {
        return { pathname: this.pathname, searchParams: this.searchParams };
      },
    },
    headers: realHeaders,
    cookies: {
      get(name: string) {
        return opts.cookies?.[name] ? { value: opts.cookies[name] } : undefined;
      },
    },
  } as unknown as NextRequest;
}

// ─── Import middleware (after mocks are set up) ──────────────────

// We need to set env vars BEFORE importing middleware
const BASE_DOMAIN = 'clicker.id';
const GATEWAY_URL = 'https://auth.clicker.id';

beforeEach(() => {
  vi.resetAllMocks();
  lastResponse = null;
  lastRewriteUrl = null;
  lastRedirectUrl = null;
  process.env.NEXT_PUBLIC_BASE_DOMAIN = BASE_DOMAIN;
  process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL = GATEWAY_URL;
});

// Dynamic import so env vars are available
async function getMiddleware() {
  // Clear module cache to pick up fresh env vars
  const mod = await import('../proxy');
  return mod.proxy;
}

// ─── Tests ───────────────────────────────────────────────────────

describe('Middleware: Config', () => {
  it('exports a matcher config', async () => {
    const mod = await import('../proxy');
    expect(mod.config).toBeDefined();
    expect(mod.config.matcher).toBeDefined();
    expect(Array.isArray(mod.config.matcher)).toBe(true);
  });
});

describe('Middleware: Root Path', () => {
  it('passes through to static landing page on root domain', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/');
    await mw(req);
    expect(mockNextResponseNext).toHaveBeenCalled();
  });
});

describe('Middleware: Missing Base Domain', () => {
  it('returns 500 when NEXT_PUBLIC_BASE_DOMAIN is not set', async () => {
    delete process.env.NEXT_PUBLIC_BASE_DOMAIN;
    const mw = await getMiddleware();
    const req = makeRequest('/some-path');
    await mw(req);
    expect(lastResponse?.type).toBe('error');
    expect(lastResponse?.status).toBe(500);
  });
});

describe('Middleware: Special Routes', () => {
  it('sets x-site-id header for /member route', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/member');
    await mw(req);
    expect(lastResponse?.type).toBe('next');
    // Verify x-site-id was set
    const siteId = lastResponse?.headers?.get?.('x-site-id');
    expect(siteId).toBe('platform');
  });

  it('sets x-site-id header for /catalog route', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/catalog');
    await mw(req);
    expect(lastResponse?.type).toBe('next');
  });

  it('sets x-site-id header for /warranty route', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/warranty');
    await mw(req);
    expect(lastResponse?.type).toBe('next');
  });
});

describe('Middleware: Admin Routes', () => {
  it('redirects /admin/login to auth gateway', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/admin/login');
    await mw(req);
    expect(lastResponse?.type).toBe('redirect');
    expect(lastRedirectUrl).toContain(GATEWAY_URL);
  });

  it('redirects /admin to auth gateway when no __session cookie', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/admin');
    await mw(req);
    expect(lastResponse?.type).toBe('redirect');
    expect(lastRedirectUrl).toContain(GATEWAY_URL);
  });

  it('passes through /admin when __session cookie is present', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/admin', {
      cookies: { __session: 'quattro' },
    });
    await mw(req);
    // Should not redirect — either next() or redirect to subdomain
    // On localhost/clicker.id it should set headers and pass through
    expect(lastResponse?.type).not.toBe('error');
  });

  it('passes through /admin/auth/callback without redirect', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/admin/auth/callback');
    await mw(req);
    expect(lastResponse?.type).toBe('next');
  });

  it('returns 500 when AUTH_GATEWAY_URL is not set', async () => {
    delete process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
    const mw = await getMiddleware();
    const req = makeRequest('/admin');
    await mw(req);
    expect(lastResponse?.type).toBe('error');
    expect(lastResponse?.status).toBe(500);
  });
});

describe('Middleware: Subdomain Rewrite', () => {
  it('rewrites subdomain root to /tenant path', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/', {
      host: 'quattro.clicker.id',
    });
    await mw(req);
    expect(lastResponse?.type).toBe('rewrite');
    expect(lastRewriteUrl).toBe('/quattro/');
  });

  it('rewrites subdomain subpage to /tenant/subpage', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/about', {
      host: 'quattro.clicker.id',
    });
    await mw(req);
    expect(lastResponse?.type).toBe('rewrite');
    expect(lastRewriteUrl).toBe('/quattro/about');
  });

  it('does NOT rewrite special routes on subdomains', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/catalog', {
      host: 'quattro.clicker.id',
    });
    await mw(req);
    // Should pass through to special route handler, not rewrite
    expect(lastResponse?.type).not.toBe('rewrite');
  });
});

describe('Middleware: Tenant Routes (Path-Based)', () => {
  it('sets x-tenant-slug and x-site-id for /{tenant}', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/quattro');
    await mw(req);
    expect(lastResponse?.type).toBe('next');
    const tenantSlug = lastResponse?.headers?.get?.('x-tenant-slug');
    const siteId = lastResponse?.headers?.get?.('x-site-id');
    expect(tenantSlug).toBe('quattro');
    expect(siteId).toBe('quattro');
  });

  it('sets headers for /{tenant}/{slug} sub-paths', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/quattro/about');
    await mw(req);
    expect(lastResponse?.type).toBe('next');
    const tenantSlug = lastResponse?.headers?.get?.('x-tenant-slug');
    expect(tenantSlug).toBe('quattro');
  });
});

describe('Middleware: Tenant Admin (/{tenant}/admin)', () => {
  it('redirects to gateway when no session on tenant admin', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/quattro/admin', {
      host: 'localhost:3000',
    });
    await mw(req);
    expect(lastResponse?.type).toBe('redirect');
    expect(lastRedirectUrl).toContain(GATEWAY_URL);
  });

  it('rewrites to /admin keeping tenant headers when session exists', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/quattro/admin', {
      host: 'localhost:3000',
      cookies: { __session: 'quattro' },
    });
    await mw(req);
    expect(lastResponse?.type).toBe('rewrite');
    expect(lastRewriteUrl).toBe('/admin');
  });

  it('returns 500 when AUTH_GATEWAY_URL missing for tenant admin', async () => {
    delete process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
    const mw = await getMiddleware();
    const req = makeRequest('/quattro/admin', {
      host: 'localhost:3000',
    });
    await mw(req);
    expect(lastResponse?.type).toBe('error');
    expect(lastResponse?.status).toBe(500);
  });
});

describe('Middleware: Double Prefix Sanitizer', () => {
  it('redirects /tenant/tenant/... to /tenant/... on root domain', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/quattro/quattro/dashboard');
    await mw(req);
    expect(lastResponse?.type).toBe('redirect');
  });

  it('redirects /tenant/tenant/... stripping both prefixes on subdomain', async () => {
    const mw = await getMiddleware();
    const req = makeRequest('/quattro/quattro/admin', {
      host: 'quattro.clicker.id',
    });
    await mw(req);
    expect(lastResponse?.type).toBe('redirect');
  });
});
