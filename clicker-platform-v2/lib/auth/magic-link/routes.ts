import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { resolveTenantBaseUrl } from '@/lib/modules/digital_goods/server-api';
import { logger } from '@/lib/logger';
import { requestMagicLink } from './send';
import { verifyMagicLink } from './verify';
import { MagicLinkError } from './types';

const NO_STORE = { 'Cache-Control': 'private, no-store, max-age=0' };

export type MagicLinkRouteConfig = {
  module: string;
  defaultPurpose: string;
  // Returns a tenant-relative path. Caller MUST validate that the returned
  // string starts with `/` and does NOT start with `//` (open-redirect guard).
  getRedirectUrl: (next: string | null, tenant: string) => string;
  // Path (tenant-relative) that the magic link lands on. Must contain a
  // VerifyClient that POSTs to the /verify endpoint.
  // Example: `/store/login/verify`
  verifyPath: string;
};

function readTenant(req: NextRequest): string | null {
  return req.headers.get('x-site-id');
}

export function createMagicLinkRoutes(config: MagicLinkRouteConfig) {
  async function POST_request(req: NextRequest): Promise<Response> {
    const tenant = readTenant(req);
    if (!tenant) return NextResponse.json({ error: 'no_site' }, { status: 400, headers: NO_STORE });
    const siteId = tenant;

    let body: { email?: string; next?: string | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'bad_body' }, { status: 400, headers: NO_STORE });
    }

    const email = (body.email ?? '').trim();
    if (!email) {
      // Anti-enumeration: still respond 200, but skip the send.
      return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
    }

    const redirectUrl = config.getRedirectUrl(body.next ?? null, tenant);

    // Magic-link verify URL MUST land on the same deployment that issued the
    // token. In staging the tenant doc may carry a production custom domain
    // (e.g. go.clicker.id) that resolves to a different deployment running
    // older code, which would break the flow. The override env pins the
    // verify-link origin to the current deployment.
    const host = req.headers.get('host') ?? undefined;
    const override = process.env.MAGIC_LINK_BASE_URL_OVERRIDE;
    let baseUrl: string;
    if (override) {
      baseUrl = override.replace(/\/+$/, '');
    } else {
      baseUrl = await resolveTenantBaseUrl(siteId, host).catch(() => {
        const proto = host?.startsWith('localhost') ? 'http' : 'https';
        return host ? `${proto}://${host}` : 'https://clicker.id';
      });
    }

    const verifyUrl = `${baseUrl}/${tenant}${config.verifyPath}`;

    const tenantName = await resolveTenantName(siteId).catch(() => tenant);

    try {
      await requestMagicLink({
        email,
        siteId,
        module: config.module,
        purpose: config.defaultPurpose,
        redirectUrl,
        verifyUrl,
        tenantName,
      });
    } catch (e) {
      logger.error('magic_link.routes.request_failed', { siteId, module: config.module, error: e });
      // Still respond 200 — anti-enumeration.
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
  }

  async function POST_verify(req: NextRequest): Promise<Response> {
    const tenant = readTenant(req);
    if (!tenant) return NextResponse.json({ error: 'no_site' }, { status: 400, headers: NO_STORE });
    const siteId = tenant;

    let body: { token?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'bad_body' }, { status: 400, headers: NO_STORE });
    }

    const token = (body.token ?? '').trim();
    if (!token) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 400, headers: NO_STORE });
    }

    try {
      const result = await verifyMagicLink({ token, siteId, module: config.module });
      return NextResponse.json(result, { status: 200, headers: NO_STORE });
    } catch (e) {
      if (e instanceof MagicLinkError) {
        const status = e.code === 'user_create_failed' || e.code === 'unknown' ? 500 : 400;
        return NextResponse.json({ error: e.code }, { status, headers: NO_STORE });
      }
      logger.error('magic_link.routes.verify_unexpected', { siteId, module: config.module, error: e });
      return NextResponse.json({ error: 'unknown' }, { status: 500, headers: NO_STORE });
    }
  }

  return { POST_request, POST_verify };
}

async function resolveTenantName(siteId: string): Promise<string> {
  const snap = await adminDb.doc(`sites/${siteId}`).get();
  const data = snap.data() ?? {};
  return (data.name as string | undefined) ?? (data.businessName as string | undefined) ?? siteId;
}
