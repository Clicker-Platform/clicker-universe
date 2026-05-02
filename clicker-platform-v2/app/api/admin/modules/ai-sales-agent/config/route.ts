import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { logger } from '@/lib/logger';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;

    const { siteId } = auth.session;

    try {
        const body = await req.json();
        const { apiKey } = body;

        if (!apiKey) {
            return NextResponse.json({ error: "API Key required" }, { status: 400 });
        }

        // Write to Secure Doc
        await adminDb.doc('modules/ai-sales-agent/private/config').set({
            apiKey: apiKey,
            updatedAt: Date.now()
        }, { merge: true });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        logger.error('ai.agent.config.failed', { siteId, error });
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
