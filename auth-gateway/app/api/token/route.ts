import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    try {
        const { uid } = await request.json();
        if (!uid || typeof uid !== 'string') {
            return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
        }

        const token = await adminAuth.createCustomToken(uid);
        return NextResponse.json({ token });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
