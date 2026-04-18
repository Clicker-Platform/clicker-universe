// POST /api/admin/modules/ai-marketing/assets/analyze
// Runs vision analysis on an uploaded asset using OpenRouter + Gemini

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, Timestamp } from '@/lib/firebase-admin';
import { invokeAI } from '@/lib/ai/openrouter-client';
import { buildAnalyzePrompt } from '@/lib/modules/ai-marketing/agents/visual-analyst';
import { AssetType } from '@/lib/modules/ai-marketing/types';
import { COLLECTION_ASSETS } from '@/lib/modules/ai-marketing/constants';

export const dynamic = 'force-dynamic';

const CREDIT_COST = 5; // vision analysis
const MODEL = 'google/gemini-2.0-flash';

export async function POST(req: NextRequest) {
  const siteId = req.headers.get('x-site-id');
  const authHeader = req.headers.get('authorization');
  if (!siteId || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);
    uid = decoded.uid;
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { assetId, assetType, imageBase64, context } = await req.json();
  if (!assetId || !assetType || !imageBase64) {
    return NextResponse.json({ error: 'assetId, assetType, imageBase64 are required' }, { status: 400 });
  }

  const assetRef = adminDb.doc(`sites/${siteId}/${COLLECTION_ASSETS}/${assetId}`);

  // Mark as analyzing
  await assetRef.update({ analysisStatus: 'analyzing' });

  try {
    const { system, user } = buildAnalyzePrompt({ assetType: assetType as AssetType, context });

    const raw = await invokeAI(
      {
        model: MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${system}\n\n${user}` },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${imageBase64}` } },
          ],
        }],
        max_tokens: 1024,
        temperature: 0.2,
      },
      { siteId, moduleId: 'ai_marketing', skillId: 'analyze_' + assetType, creditCost: CREDIT_COST, uid }
    );

    // Parse JSON response
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const analysis = JSON.parse(jsonStr);

    await assetRef.update({
      analysis: {
        ...analysis,
        analyzedAt: Timestamp.now(),
        creditsUsed: CREDIT_COST,
      },
      analysisStatus: 'complete',
    });

    return NextResponse.json({ ok: true, analysis });
  } catch (err: any) {
    await assetRef.update({ analysisStatus: 'failed' });

    // Check for insufficient credits
    if (err.message?.startsWith('insufficient_credits:')) {
      const [, balance, required] = err.message.split(':');
      return NextResponse.json(
        { error: 'insufficient_credits', balance: Number(balance), required: Number(required) },
        { status: 402 }
      );
    }

    console.error('[analyze] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
