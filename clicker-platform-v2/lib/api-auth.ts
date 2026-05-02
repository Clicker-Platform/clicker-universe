// lib/api-auth.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export interface AuthedSession {
    uid: string;
    email: string;
    siteId: string;
    role: 'owner' | 'staff';
    isOwner: boolean;
}

type AuthResult =
    | { ok: true; session: AuthedSession }
    | { ok: false; res: NextResponse };

async function resolveSession(req: NextRequest): Promise<AuthResult> {
    // x-site-id is injected by Next.js middleware from the __session cookie — not user-controllable.
    const siteId = req.headers.get('x-site-id');
    if (!siteId) {
        return { ok: false, res: NextResponse.json({ error: 'Missing x-site-id' }, { status: 400 }) };
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { ok: false, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    let decoded: { uid: string; email?: string };
    try {
        decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) };
    }

    try {
        const siteDoc = await adminDb.collection('sites').doc(siteId).get();
        if (!siteDoc.exists) {
            return { ok: false, res: NextResponse.json({ error: 'Site not found' }, { status: 404 }) };
        }
        const siteData = siteDoc.data()!;

        // Owner check: UID is the canonical identity. ownerEmail is a migration fallback
        // for sites where ownerId was not set. Safe because Firebase enforces email
        // uniqueness per project and verifyIdToken already validates project membership.
        const isOwner =
            siteData.ownerId === decoded.uid || siteData.ownerEmail === decoded.email;

        if (isOwner) {
            return {
                ok: true,
                session: {
                    uid: decoded.uid,
                    email: decoded.email ?? '',
                    siteId,
                    role: 'owner',
                    isOwner: true,
                },
            };
        }

        const memberDoc = await adminDb
            .collection('sites').doc(siteId)
            .collection('members').doc(decoded.uid)
            .get();

        if (!memberDoc.exists || memberDoc.data()?.status !== 'active') {
            return { ok: false, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
        }

        return {
            ok: true,
            session: {
                uid: decoded.uid,
                email: decoded.email ?? '',
                siteId,
                role: 'staff',
                isOwner: false,
            },
        };
    } catch {
        return { ok: false, res: NextResponse.json({ error: 'Internal server error' }, { status: 500 }) };
    }
}

export async function requireOwner(req: NextRequest): Promise<AuthResult> {
    const result = await resolveSession(req);
    if (!result.ok) return result;
    if (!result.session.isOwner) {
        return { ok: false, res: NextResponse.json({ error: 'Owner access required' }, { status: 403 }) };
    }
    return result;
}

export async function requireAuthedMember(req: NextRequest): Promise<AuthResult> {
    return resolveSession(req);
}
