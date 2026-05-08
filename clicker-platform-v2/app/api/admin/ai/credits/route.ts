// GET /api/admin/ai/credits → returns { balance, lifetimeUsed } for current tenant
// Uses Firebase REST APIs instead of firebase-admin to avoid Turbopack bundling issues.
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!;

export async function GET(req: NextRequest) {
  try {
    const siteId = req.headers.get('x-site-id');
    if (!siteId) return NextResponse.json({ error: 'Site ID required' }, { status: 400 });

    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const idToken = authHeader.split('Bearer ')[1];

    // Verify token via Firebase Auth REST API
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) }
    );
    if (!verifyRes.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Read Firestore via REST API
    const docRes = await fetch(
      `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/sites/${siteId}/platform/aiCredits`,
      { headers: { Authorization: `Bearer ${idToken}` } }
    );

    if (docRes.status === 404) return NextResponse.json({ balance: 0, lifetimeUsed: 0 });
    if (!docRes.ok) return NextResponse.json({ balance: 0, lifetimeUsed: 0 });

    const doc = await docRes.json();
    const fields = doc.fields ?? {};
    return NextResponse.json({
      balance: fields.balance?.integerValue ?? fields.balance?.doubleValue ?? 0,
      lifetimeUsed: fields.lifetimeUsed?.integerValue ?? fields.lifetimeUsed?.doubleValue ?? 0,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
