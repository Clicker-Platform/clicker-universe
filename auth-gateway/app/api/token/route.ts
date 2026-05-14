import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
        const token = await adminAuth.createCustomToken(decoded.uid);
        return NextResponse.json({ token });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 401 });
    }
}
