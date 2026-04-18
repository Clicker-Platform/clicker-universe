// Strategist agent — campaign planning, targeting, and strategy prompts

import { BrandVoiceConfig } from '../types';

function brandVoiceContext(bv: BrandVoiceConfig): string {
  return `Brand Context:
- Tone: ${bv.tone}, Style: ${bv.style}
- Description: ${bv.description || 'Not specified'}
- Target Audience: ${bv.targetAudience || 'Not specified'}`;
}

export function buildCampaignPlanPrompt(input: {
  brandVoice: BrandVoiceConfig;
  objective: string;
  product: string;
  budget: string;
  duration: string;
  platforms: string[];
}): { system: string; user: string } {
  const system = `You are a Senior Marketing Strategist with expertise in digital campaign planning. Create comprehensive, actionable campaign plans. Respond with valid JSON only.`;

  const user = `Create a complete marketing campaign plan:

${brandVoiceContext(input.brandVoice)}

Campaign Brief:
- Objective: ${input.objective}
- Product/Service: ${input.product}
- Budget: ${input.budget}
- Duration: ${input.duration}
- Platforms: ${input.platforms.join(', ')}

Return ONLY this JSON:
{
  "campaign_name": "creative campaign name",
  "executive_summary": "2-3 sentence overview",
  "strategy": {
    "positioning": "brand positioning statement",
    "key_message": "the single most important message",
    "differentiation": "what makes this campaign unique"
  },
  "phases": [
    {
      "name": "phase name",
      "duration": "X weeks",
      "objective": "phase goal",
      "tactics": ["tactic 1", "tactic 2"]
    }
  ],
  "kpis": [
    { "metric": "KPI name", "target": "target value", "measurement": "how to measure" }
  ],
  "budget_split": {
    "awareness": 30,
    "consideration": 40,
    "conversion": 30
  },
  "risks": ["risk 1", "risk 2"],
  "success_criteria": "definition of success for this campaign"
}`;

  return { system, user };
}

export function buildTargetAudiencePrompt(input: {
  brandVoice: BrandVoiceConfig;
  product: string;
  existingData?: string;
}): { system: string; user: string } {
  const system = `You are a Marketing Strategist specializing in audience segmentation. Define detailed, actionable audience personas. Respond with valid JSON only.`;

  const user = `Define target audience segments for:

${brandVoiceContext(input.brandVoice)}

Product/Service: ${input.product}
${input.existingData ? `Existing Customer Data: ${input.existingData}` : ''}

Return ONLY this JSON:
{
  "primary_persona": {
    "name": "persona name",
    "age_range": "X–Y",
    "gender": "demographic info",
    "income": "income range",
    "location": "geographic focus",
    "pain_points": ["pain 1", "pain 2"],
    "goals": ["goal 1", "goal 2"],
    "platforms_used": ["platform 1", "platform 2"],
    "messaging_angle": "how to speak to this persona"
  },
  "secondary_personas": [
    {
      "name": "persona name",
      "description": "brief description",
      "why_relevant": "why this segment matters"
    }
  ],
  "segments_to_exclude": ["segment 1"],
  "targeting_recommendations": ["recommendation 1", "recommendation 2"]
}`;

  return { system, user };
}

export function buildContentCalendarPrompt(input: {
  campaignPlan: string;
  duration: string;
  platforms: string[];
  postsPerWeek: number;
}): { system: string; user: string } {
  const system = `You are a Content Strategist. Create detailed, varied content calendars that maintain brand consistency while keeping audiences engaged. Respond with valid JSON only.`;

  const user = `Create a content calendar based on this campaign plan:

Campaign Context:
${input.campaignPlan}

Specifications:
- Duration: ${input.duration}
- Platforms: ${input.platforms.join(', ')}
- Posts per week: ${input.postsPerWeek}

Return ONLY this JSON:
{
  "calendar": [
    {
      "week": 1,
      "theme": "weekly theme",
      "posts": [
        {
          "day": "Monday",
          "platform": "platform name",
          "type": "post type (image/video/carousel/story)",
          "content_idea": "specific content idea",
          "caption_notes": "key points for caption",
          "cta": "call to action"
        }
      ]
    }
  ],
  "content_pillars": ["pillar 1", "pillar 2", "pillar 3"],
  "notes": "editorial notes and strategy tips"
}`;

  return { system, user };
}

export function buildBudgetAllocationPrompt(input: {
  totalBudget: string;
  platforms: string[];
  objective: string;
  duration: string;
}): { system: string; user: string } {
  const system = `You are a Paid Media Strategist. Recommend optimal budget allocations based on campaign objectives and platform strengths. Respond with valid JSON only.`;

  const user = `Recommend budget allocation:

Total Budget: ${input.totalBudget}
Platforms: ${input.platforms.join(', ')}
Objective: ${input.objective}
Duration: ${input.duration}

Return ONLY this JSON:
{
  "allocation": [
    {
      "platform": "platform name",
      "percentage": 0–100,
      "amount": "calculated amount",
      "rationale": "why this allocation",
      "expected_results": "what to expect"
    }
  ],
  "phase_split": {
    "testing": "X% for first 2 weeks",
    "scaling": "Y% for weeks 3-end"
  },
  "recommendations": ["recommendation 1", "recommendation 2"],
  "warning": "any budget concerns or risks"
}`;

  return { system, user };
}
