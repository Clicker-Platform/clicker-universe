import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;
  const { siteId } = auth.session;

  const diagnostic: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    layers: {} as Record<string, unknown>,
    overallStatus: 'UNKNOWN',
  };
  const layers = diagnostic.layers as Record<string, unknown>;

  try {
    // Layer 1: Database Products
    try {
      const productsSnap = await adminDb.collection('products').where('isActive', '==', true).get();
      layers.database = {
        status: 'OK',
        message: `Found ${productsSnap.size} active products.`,
        sample: productsSnap.docs.length > 0 ? productsSnap.docs[0].data().name : 'None',
      };
    } catch (e: unknown) {
      layers.database = { status: 'ERROR', message: e instanceof Error ? e.message : String(e) };
    }

    const agentDoc = await adminDb.doc('modules/ai-sales-agent').get();
    const agentData = agentDoc.data() ?? {};
    const kbContent = (agentData.knowledgeBaseContent as string) ?? '';

    // Layer 4: Manual Context
    if (agentData.businessContext && (agentData.businessContext as string).length > 5) {
      layers.manualContext = {
        status: 'OK',
        length: (agentData.businessContext as string).length,
        preview: (agentData.businessContext as string).substring(0, 50) + '...',
      };
    } else {
      layers.manualContext = { status: 'WARNING', message: 'Business Context is empty or too short.' };
    }

    // Layer 2: Web Scraping
    const hasWebSource = kbContent.includes('--- SOURCE: http');
    layers.webScraping = {
      status: hasWebSource ? 'OK' : 'WARNING',
      message: hasWebSource ? 'Web content markers found.' : 'No web source markers found in Knowledge Base.',
    };

    // Layer 3: PDF Knowledge
    const hasPdfSource = kbContent.includes('--- SOURCE: PDF');
    layers.pdfKnowledge = {
      status: hasPdfSource ? 'OK' : 'WARNING',
      message: hasPdfSource ? 'PDF content found.' : 'No PDF source markers found.',
    };

    // AI Engine: check OpenRouter key via lib/secrets
    try {
      const { getSecret } = await import('@/lib/secrets');
      const key = await getSecret('OPENROUTER_API_KEY');
      layers.aiEngine = {
        status: key ? 'OK' : 'ERROR',
        message: key ? 'OpenRouter API key configured.' : 'OpenRouter API key missing.',
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown';
      layers.aiEngine = { status: 'ERROR', message: 'Cannot access OpenRouter key: ' + msg };
    }

    // Suppress unused variable warning
    void siteId;

    const allOk = Object.values(layers).every((l) => (l as Record<string, string>).status === 'OK');
    diagnostic.overallStatus = allOk ? 'ALL SYSTEMS GO' : 'ISSUES DETECTED';

    return NextResponse.json(diagnostic, { status: 200 });
  } catch (error: unknown) {
    return NextResponse.json({
      status: 'CRITICAL_ERROR',
      message: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
