// Creative Director agent — prompt templates for marketing copy generation

import { BrandVoiceConfig } from '../types';

function brandVoiceContext(bv: BrandVoiceConfig): string {
  return `Brand Voice:
- Tone: ${bv.tone}
- Style: ${bv.style}
- Description: ${bv.description || 'Not specified'}
- Target Audience: ${bv.targetAudience || 'Not specified'}
- Key Messages: ${bv.keyMessages?.length ? bv.keyMessages.join(', ') : 'Not specified'}
- Languages: ${bv.languages?.join(', ') || 'en'}`;
}

export function buildAdCopyPrompt(input: {
  brandVoice: BrandVoiceConfig;
  platform: string;
  objective: string;
  product: string;
  visualContext?: string;
}): { system: string; user: string } {
  const system = `You are a Creative Director specializing in performance marketing copy. You create compelling, conversion-focused ad copy for digital platforms. Always respond with valid JSON only — no markdown, no preamble.`;

  const user = `Create ad copy for the following brief:

${brandVoiceContext(input.brandVoice)}

Platform: ${input.platform}
Campaign Objective: ${input.objective}
Product/Service: ${input.product}
${input.visualContext ? `Visual Context: ${input.visualContext}` : ''}

Return ONLY this JSON:
{
  "headlines": ["headline 1", "headline 2", "headline 3"],
  "primary_texts": [
    { "variation": "A", "text": "full ad copy variant A" },
    { "variation": "B", "text": "full ad copy variant B" }
  ],
  "ctas": ["CTA 1", "CTA 2", "CTA 3"],
  "hooks": ["scroll-stopping hook 1", "hook 2"],
  "notes": "brief strategic notes on the copy approach"
}`;

  return { system, user };
}

export function buildCaptionPrompt(input: {
  brandVoice: BrandVoiceConfig;
  platform: string;
  contentContext: string;
  includeHashtags?: boolean;
}): { system: string; user: string } {
  const system = `You are a Social Media Creative Director. Write engaging captions optimized for each platform. Respond with valid JSON only.`;

  const user = `Write a social media caption for:

${brandVoiceContext(input.brandVoice)}

Platform: ${input.platform}
Content Context: ${input.contentContext}
Include Hashtags: ${input.includeHashtags ? 'Yes' : 'No'}

Return ONLY this JSON:
{
  "caption": "the main caption text",
  "caption_short": "shortened version (under 100 chars)",
  "hashtags": ["#tag1", "#tag2"],
  "emojis_suggested": ["emoji suggestions for the caption"]
}`;

  return { system, user };
}

export function buildHeadlinePrompt(input: {
  brandVoice: BrandVoiceConfig;
  product: string;
  campaignContext?: string;
}): { system: string; user: string } {
  const system = `You are a Creative Director. Generate compelling headlines for marketing campaigns. Respond with valid JSON only.`;

  const user = `Generate 8 marketing headlines for:

${brandVoiceContext(input.brandVoice)}

Product/Service: ${input.product}
${input.campaignContext ? `Campaign Context: ${input.campaignContext}` : ''}

Return ONLY this JSON:
{
  "headlines": [
    { "text": "headline text", "type": "benefit/question/urgency/social_proof/curiosity" }
  ]
}`;

  return { system, user };
}

export function buildHashtagsPrompt(input: {
  contentContext: string;
  platform: string;
  count?: number;
}): { system: string; user: string } {
  const system = `You are a social media strategist. Generate relevant, effective hashtags. Respond with valid JSON only.`;

  const user = `Generate hashtags for:

Platform: ${input.platform}
Content: ${input.contentContext}
Count: ${input.count ?? 15}

Return ONLY this JSON:
{
  "hashtags": ["#tag1", "#tag2"],
  "categories": {
    "broad": ["#broad1", "#broad2"],
    "niche": ["#niche1", "#niche2"],
    "branded": ["#branded1"]
  }
}`;

  return { system, user };
}

export function buildTranslatePrompt(input: {
  content: string;
  targetLanguage: string;
  brandVoice: BrandVoiceConfig;
}): { system: string; user: string } {
  const system = `You are a multilingual marketing copywriter. Translate marketing content while preserving tone, style, and brand voice. Respond with valid JSON only.`;

  const user = `Translate this marketing content to ${input.targetLanguage}:

${brandVoiceContext(input.brandVoice)}

Content to translate:
"${input.content}"

Return ONLY this JSON:
{
  "translation": "translated content",
  "notes": "any localization notes or cultural adaptations made"
}`;

  return { system, user };
}

export function buildAdaptTonePrompt(input: {
  content: string;
  targetTone: string;
  targetStyle: string;
}): { system: string; user: string } {
  const system = `You are a Creative Director. Rewrite marketing content in a different tone and style while preserving the core message. Respond with valid JSON only.`;

  const user = `Rewrite this content:

Original:
"${input.content}"

Target Tone: ${input.targetTone}
Target Style: ${input.targetStyle}

Return ONLY this JSON:
{
  "rewritten": "the adapted content",
  "changes_made": "brief description of tone/style changes applied"
}`;

  return { system, user };
}
