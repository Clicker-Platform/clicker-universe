// Visual Analyst agent — prompt templates for image analysis
// Pure text templates, no SDK imports

import { AssetType } from '../types';

export interface VisualAnalystInput {
  assetType: AssetType;
  context?: string; // optional brand/product context
}

export function buildAnalyzePrompt(input: VisualAnalystInput): { system: string; user: string } {
  const system = `You are a Visual Analyst for a marketing team. Your job is to analyze marketing images and extract structured, actionable insights that will be used by a Creative Director and Strategist to generate compelling marketing content.

Always respond with a single valid JSON object — no markdown, no explanation, just raw JSON.`;

  const userPrompts: Record<AssetType, string> = {
    model: `Analyze this model/lifestyle photo for marketing use.

Return ONLY this JSON structure:
{
  "subject": {
    "person": "description of the model (approximate age, expression, pose, clothing style, accessories)",
    "action": "what the model is doing or conveying",
    "emotion": "the dominant emotion or mood projected"
  },
  "composition": "describe the framing, shot angle, and rule-of-thirds usage",
  "lighting": "describe the lighting setup (natural/studio, direction, softness, shadows)",
  "mood": "the overall mood and atmosphere of the image in 2–3 words",
  "colors": [
    { "hex": "#XXXXXX", "name": "color name", "percentage": 0–100 }
  ],
  "generatedPrompt": "A detailed text-to-image prompt that would recreate a similar image: [detailed prompt]",
  "recommendedUseCases": ["use case 1", "use case 2", "use case 3"]
}

${input.context ? `Brand context: ${input.context}` : ''}`,

    background: `Analyze this background/environment image for marketing use.

Return ONLY this JSON structure:
{
  "subject": {
    "setting": "describe the location or environment",
    "style": "interior/exterior, modern/rustic/urban/etc.",
    "notable_elements": ["element 1", "element 2"]
  },
  "composition": "describe the framing, depth, and spatial feel",
  "lighting": "describe the ambient lighting, time of day, or artificial lighting",
  "mood": "the overall mood and atmosphere in 2–3 words",
  "colors": [
    { "hex": "#XXXXXX", "name": "color name", "percentage": 0–100 }
  ],
  "generatedPrompt": "A detailed text-to-image prompt to recreate a similar background: [detailed prompt]",
  "recommendedUseCases": ["use case 1", "use case 2", "use case 3"]
}

${input.context ? `Brand context: ${input.context}` : ''}`,

    product: `Analyze this product photo for marketing use.

Return ONLY this JSON structure:
{
  "subject": {
    "product": "describe the product (category, appearance, materials, colors, key features visible)",
    "packaging": "describe the packaging if visible",
    "angles": "describe what angles/views are shown",
    "condition": "new/lifestyle/in-use/etc."
  },
  "composition": "describe the layout, background, props, and styling",
  "lighting": "describe how the product is lit (key light, fill, highlights, shadows)",
  "mood": "the brand positioning conveyed in 2–3 words",
  "colors": [
    { "hex": "#XXXXXX", "name": "color name", "percentage": 0–100 }
  ],
  "generatedPrompt": "A detailed text-to-image prompt to recreate a similar product shot: [detailed prompt]",
  "recommendedUseCases": ["use case 1", "use case 2", "use case 3"]
}

${input.context ? `Brand context: ${input.context}` : ''}`,
  };

  return { system, user: userPrompts[input.assetType] };
}

export function buildExtractColorsPrompt(): { system: string; user: string } {
  const system = `You are a color analyst. Extract the dominant color palette from images and respond with valid JSON only.`;
  const user = `Extract the dominant colors from this image.

Return ONLY this JSON:
{
  "colors": [
    { "hex": "#XXXXXX", "name": "descriptive color name", "percentage": 0–100 }
  ],
  "palette_mood": "2–3 word mood description",
  "suggested_complementary": ["#XXXXXX", "#XXXXXX"]
}

List 4–6 colors sorted by prominence (highest percentage first). Total percentages should sum to ~100.`;

  return { system, user };
}
