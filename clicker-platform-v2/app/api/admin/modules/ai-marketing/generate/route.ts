// POST /api/admin/modules/ai-marketing/generate
// Core generation endpoint — handles single skills and multi-skill flows

import { NextRequest, NextResponse } from 'next/server';
import { adminDb, Timestamp } from '@/lib/firebase-admin';
import { requireAuthedMember } from '@/lib/api-auth';
import { runSkill, runFlow } from '@/lib/modules/ai-marketing/orchestrator/runner';
import { getMarketingSettings } from '@/lib/modules/ai-marketing/api-server';
import { COLLECTION_GENERATIONS } from '@/lib/modules/ai-marketing/constants';
import { DEFAULT_BRAND_VOICE } from '@/lib/modules/ai-marketing/constants';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAuthedMember(req);
  if (!auth.ok) return auth.res;

  const { siteId, uid } = auth.session;

  const body = await req.json();
  const { skillId, flowId, formData } = body;

  if (!skillId && !flowId) {
    return NextResponse.json({ error: 'skillId or flowId is required' }, { status: 400 });
  }

  // Load brand voice settings
  const settings = await getMarketingSettings(siteId);
  const brandVoice = settings?.brandVoice ?? DEFAULT_BRAND_VOICE;

  try {
    if (flowId) {
      // Multi-skill flow
      const { stepOutputs } = await runFlow(flowId, {
        siteId,
        uid,
        formData: formData ?? {},
        brandVoice,
      });

      // Save flow generation record
      const docRef = adminDb.collection(`sites/${siteId}/${COLLECTION_GENERATIONS}`).doc();
      await docRef.set({
        skillId: flowId,
        agentId: 'orchestrator',
        flowId,
        input: { formData: formData ?? {} },
        output: {
          content: Object.entries(stepOutputs)
            .map(([k, v]) => `## ${k}\n${v.content}`)
            .join('\n\n'),
          structured: Object.fromEntries(
            Object.entries(stepOutputs).map(([k, v]) => [k, v.structured ?? v.content])
          ),
        },
        model: 'multi',
        status: 'complete',
        createdAt: Timestamp.now(),
        createdBy: uid,
      });

      return NextResponse.json({ ok: true, generationId: docRef.id, stepOutputs });
    } else {
      // Single skill
      const result = await runSkill({
        siteId,
        uid,
        skillId,
        formData: formData ?? {},
        brandVoice,
      });

      // Save generation record
      const docRef = adminDb.collection(`sites/${siteId}/${COLLECTION_GENERATIONS}`).doc();
      await docRef.set({
        skillId,
        agentId: getAgentForSkill(skillId),
        input: { formData: formData ?? {} },
        output: {
          content: result.content,
          structured: result.structured,
        },
        model: result.model,
        status: 'complete',
        createdAt: Timestamp.now(),
        createdBy: uid,
      });

      return NextResponse.json({ ok: true, generationId: docRef.id, ...result });
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    if (errMsg?.startsWith('insufficient_credits:')) {
      const [, balance, required] = errMsg.split(':');
      return NextResponse.json(
        { error: 'insufficient_credits', balance: Number(balance), required: Number(required) },
        { status: 402 }
      );
    }
    logger.error('ai.marketing.generate.failed', { siteId, error: errMsg });
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

function getAgentForSkill(skillId: string): string {
  if (['analyze_model_photo','analyze_background','analyze_product','generate_visual_prompt','extract_brand_colors'].includes(skillId)) return 'visual_analyst';
  if (['generate_ad_copy','generate_caption','generate_headline','generate_cta','adapt_tone','generate_hashtags','translate_content'].includes(skillId)) return 'creative_director';
  if (['plan_campaign','define_target_audience','suggest_platforms','create_content_calendar','suggest_budget_allocation','competitive_analysis','ab_test_ideas'].includes(skillId)) return 'strategist';
  return 'data_analyst';
}
