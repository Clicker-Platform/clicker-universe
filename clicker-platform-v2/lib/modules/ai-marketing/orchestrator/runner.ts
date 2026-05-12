// Orchestrator runner — server-side only (imported by API routes)
// Handles single skill calls and multi-skill flows with context passing

import { invokeAI, invokeVision, getModel } from '@/lib/ai';
import { SKILL_MODEL_MAP } from '../config/model-config';
import { MULTI_SKILL_FLOWS } from './flows';
import { BrandVoiceConfig, SkillId, AgentId } from '../types';

// Agent prompt builders
import { buildAnalyzePrompt } from '../agents/visual-analyst';
import {
  buildAdCopyPrompt, buildCaptionPrompt, buildHeadlinePrompt,
  buildHashtagsPrompt, buildTranslatePrompt, buildAdaptTonePrompt,
} from '../agents/creative-director';
import {
  buildCampaignPlanPrompt, buildTargetAudiencePrompt,
  buildContentCalendarPrompt, buildBudgetAllocationPrompt,
} from '../agents/strategist';
import {
  buildAnalyzePerformancePrompt, buildIdentifyTrendsPrompt,
  buildOptimizationsPrompt, buildROIPrompt, buildReportPrompt,
} from '../agents/data-analyst';

export interface RunnerInput {
  siteId: string;
  uid: string;
  skillId: SkillId;
  formData: Record<string, any>;
  brandVoice: BrandVoiceConfig;
  priorContext?: Record<string, any>; // outputs from previous steps in a flow
}

export interface RunnerOutput {
  content: string;
  variations?: string[];
  structured?: Record<string, any>;
  model: string;
}

/**
 * Builds the prompt for a given skill using the appropriate agent template.
 */
function buildPrompt(skillId: SkillId, input: RunnerInput): { system: string; user: string } {
  const { formData, brandVoice, priorContext } = input;

  switch (skillId) {
    // Visual Analyst
    case 'analyze_model_photo':
      return buildAnalyzePrompt({ assetType: 'model', context: formData.context });
    case 'analyze_background':
      return buildAnalyzePrompt({ assetType: 'background', context: formData.context });
    case 'analyze_product':
      return buildAnalyzePrompt({ assetType: 'product', context: formData.context });

    // Creative Director
    case 'generate_ad_copy':
      return buildAdCopyPrompt({
        brandVoice,
        platform: formData.platform ?? 'Meta',
        objective: formData.objective ?? 'Awareness',
        product: formData.product ?? '',
        visualContext: priorContext?.analyze_model_photo?.mood ?? formData.visualContext,
      });
    case 'generate_caption':
      return buildCaptionPrompt({
        brandVoice,
        platform: formData.platform ?? 'Instagram',
        contentContext: formData.contentContext ?? formData.product ?? '',
        includeHashtags: formData.includeHashtags ?? true,
      });
    case 'generate_headline':
      return buildHeadlinePrompt({
        brandVoice,
        product: formData.product ?? '',
        campaignContext: priorContext?.plan_campaign?.executive_summary ?? formData.campaignContext,
      });
    case 'generate_hashtags':
      return buildHashtagsPrompt({
        contentContext: formData.contentContext ?? '',
        platform: formData.platform ?? 'Instagram',
        count: formData.count ?? 15,
      });
    case 'translate_content':
      return buildTranslatePrompt({
        content: formData.content ?? '',
        targetLanguage: formData.targetLanguage ?? 'id',
        brandVoice,
      });
    case 'adapt_tone':
      return buildAdaptTonePrompt({
        content: formData.content ?? '',
        targetTone: formData.targetTone ?? 'casual',
        targetStyle: formData.targetStyle ?? 'conversational',
      });
    case 'generate_cta':
      return {
        system: `You are a conversion copywriter. Generate compelling CTAs. Respond with valid JSON only.`,
        user: `Generate 5 CTAs for: ${formData.product ?? ''}, objective: ${formData.objective ?? 'purchase'}.\nReturn ONLY: { "ctas": ["CTA 1", "CTA 2", "CTA 3", "CTA 4", "CTA 5"] }`,
      };

    // Strategist
    case 'plan_campaign':
      return buildCampaignPlanPrompt({
        brandVoice,
        objective: formData.objective ?? '',
        product: formData.product ?? '',
        budget: formData.budget ?? 'Not specified',
        duration: formData.duration ?? '30 days',
        platforms: formData.platforms ?? ['Meta', 'Instagram'],
      });
    case 'define_target_audience':
      return buildTargetAudiencePrompt({
        brandVoice,
        product: formData.product ?? '',
        existingData: formData.existingData,
      });
    case 'create_content_calendar':
      return buildContentCalendarPrompt({
        campaignPlan: priorContext?.plan_campaign ? JSON.stringify(priorContext.plan_campaign) : formData.campaignSummary ?? '',
        duration: formData.duration ?? '30 days',
        platforms: formData.platforms ?? ['Instagram'],
        postsPerWeek: formData.postsPerWeek ?? 5,
      });
    case 'suggest_budget_allocation':
      return buildBudgetAllocationPrompt({
        totalBudget: formData.budget ?? '',
        platforms: formData.platforms ?? ['Meta'],
        objective: formData.objective ?? '',
        duration: formData.duration ?? '30 days',
      });
    case 'suggest_platforms':
      return {
        system: `You are a marketing channel strategist. Recommend optimal platforms. Respond with valid JSON only.`,
        user: `Recommend platforms for: ${brandVoice.targetAudience ?? 'general audience'}, budget: ${formData.budget ?? 'not specified'}, objective: ${formData.objective ?? 'awareness'}.\nReturn ONLY: { "platforms": [{ "name": "...", "priority": 1–5, "rationale": "...", "estimated_reach": "..." }] }`,
      };
    case 'competitive_analysis':
      return {
        system: `You are a marketing strategist. Analyze competitive landscape. Respond with valid JSON only.`,
        user: `Competitive analysis for: ${formData.industry ?? ''}, competitors: ${formData.competitors ?? 'general market'}.\nReturn ONLY: { "market_overview": "...", "competitors": [{ "name": "...", "strengths": [], "weaknesses": [] }], "opportunities": [], "threats": [], "recommendations": [] }`,
      };
    case 'ab_test_ideas':
      return {
        system: `You are a CRO specialist. Generate actionable A/B test hypotheses. Respond with valid JSON only.`,
        user: `A/B test ideas for: ${formData.currentPerformance ?? ''}, goals: ${formData.goals ?? ''}.\nReturn ONLY: { "tests": [{ "hypothesis": "...", "element": "...", "variants": ["A", "B"], "expected_lift": "...", "priority": "high/medium/low" }] }`,
      };

    // Data Analyst
    case 'analyze_performance':
      return buildAnalyzePerformancePrompt({
        metrics: formData.metrics ?? '',
        period: formData.period ?? 'Last 30 days',
        platform: formData.platform,
      });
    case 'identify_trends':
      return buildIdentifyTrendsPrompt({
        data: formData.data ?? formData.metrics ?? '',
        period: formData.period ?? 'Last 90 days',
      });
    case 'suggest_optimizations':
      return buildOptimizationsPrompt({
        performanceData: formData.performanceData ?? formData.metrics ?? '',
        currentStrategy: formData.currentStrategy,
        goals: formData.goals ?? '',
      });
    case 'calculate_roi':
      return buildROIPrompt({
        spend: formData.spend ?? '',
        revenue: formData.revenue ?? '',
        period: formData.period ?? '',
        channel: formData.channel,
      });
    case 'generate_report':
      return buildReportPrompt({
        metrics: formData.metrics ?? '',
        period: formData.period ?? '',
        goals: formData.goals ?? '',
        brandName: formData.brandName,
      });
    case 'predict_outcomes':
      return {
        system: `You are a marketing data scientist. Forecast campaign outcomes. Respond with valid JSON only.`,
        user: `Predict outcomes based on: ${formData.historicalData ?? ''}, planned changes: ${formData.plannedChanges ?? ''}.\nReturn ONLY: { "predictions": [{ "metric": "...", "current": "...", "projected": "...", "confidence": "high/medium/low", "assumptions": "..." }], "overall_outlook": "..." }`,
      };
    case 'benchmark_competitors':
      return {
        system: `You are a competitive intelligence analyst. Benchmark marketing performance. Respond with valid JSON only.`,
        user: `Benchmark analysis: my metrics: ${formData.myMetrics ?? ''}, industry: ${formData.industry ?? ''}.\nReturn ONLY: { "benchmarks": [{ "metric": "...", "my_value": "...", "industry_avg": "...", "top_performers": "...", "gap": "..." }], "summary": "...", "priority_gaps": [] }`,
      };

    default:
      return {
        system: 'You are a marketing AI assistant. Respond helpfully.',
        user: formData.userPrompt ?? 'Help me with my marketing.',
      };
  }
}

/**
 * Run a single skill invocation.
 */
export async function runSkill(input: RunnerInput): Promise<RunnerOutput> {
  const { skillId, siteId, uid } = input;

  const { system, user } = buildPrompt(skillId, input);

  // Vision skills: use getModel('vision') from Backyard; text skills: use SKILL_MODEL_MAP
  let raw: string;
  let resolvedModel: string;
  if (input.formData.imageBase64) {
    resolvedModel = await getModel('vision');
    raw = await invokeVision(
      {
        model: resolvedModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${system}\n\n${user}` },
            { type: 'image_url', image_url: { url: `data:image/webp;base64,${input.formData.imageBase64}` } },
          ],
        }],
        max_tokens: 2048,
        temperature: 0.7,
      },
      { siteId, moduleId: 'ai_marketing', skillId, uid }
    );
  } else {
    resolvedModel = SKILL_MODEL_MAP[skillId] ?? 'openai/gpt-4o-mini';
    raw = await invokeAI(
      {
        model: resolvedModel,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        max_tokens: 2048,
        temperature: 0.7,
      },
      { siteId, moduleId: 'ai_marketing', skillId, uid }
    );
  }

  // Try to parse as JSON, fallback to raw text
  let structured: Record<string, any> | undefined;
  try {
    const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    structured = JSON.parse(jsonStr);
  } catch {
    // Not JSON — return as plain content
  }

  return {
    content: raw,
    structured,
    model: resolvedModel,
  };
}

/**
 * Run a multi-skill flow — executes steps sequentially, passing outputs as context.
 */
export async function runFlow(
  flowId: string,
  input: Omit<RunnerInput, 'skillId'>
): Promise<{ stepOutputs: Record<string, RunnerOutput> }> {
  const flow = MULTI_SKILL_FLOWS[flowId];
  if (!flow) throw new Error(`Unknown flow: ${flowId}`);

  const stepOutputs: Record<string, RunnerOutput> = {};
  const priorContext: Record<string, any> = {};

  for (const step of flow.steps) {
    // Skip conditional steps if condition not met
    if (step.conditional === 'hasImages' && !input.formData.imageBase64) {
      continue;
    }

    const result = await runSkill({
      ...input,
      skillId: step.skill,
      priorContext,
    });

    stepOutputs[step.skill] = result;

    // Pass structured output as context to next steps
    if (result.structured) {
      priorContext[step.skill] = result.structured;
    }
  }

  return { stepOutputs };
}
