import { SkillId } from '../types';

export const SKILL_MODEL_MAP: Record<SkillId, string> = {
  // Visual Analyst — Gemini (best vision price/quality)
  analyze_model_photo:    'google/gemini-2.0-flash',
  analyze_background:     'google/gemini-2.0-flash',
  analyze_product:        'google/gemini-2.0-flash',
  generate_visual_prompt: 'google/gemini-2.0-flash',
  extract_brand_colors:   'google/gemini-2.0-flash',

  // Creative Director — Claude for high-quality copy, mini for fast tasks
  generate_ad_copy:       'anthropic/claude-sonnet-4',
  plan_campaign:          'anthropic/claude-sonnet-4',
  competitive_analysis:   'anthropic/claude-sonnet-4',
  generate_caption:       'openai/gpt-4o-mini',
  generate_headline:      'openai/gpt-4o-mini',
  generate_cta:           'google/gemini-2.0-flash',
  adapt_tone:             'openai/gpt-4o-mini',
  generate_hashtags:      'google/gemini-2.0-flash',
  translate_content:      'openai/gpt-4o-mini',

  // Strategist
  define_target_audience:    'anthropic/claude-sonnet-4',
  suggest_platforms:         'openai/gpt-4o-mini',
  create_content_calendar:   'anthropic/claude-sonnet-4',
  suggest_budget_allocation: 'openai/gpt-4o-mini',
  ab_test_ideas:             'openai/gpt-4o-mini',

  // Data Analyst
  analyze_performance:   'openai/gpt-4o-mini',
  identify_trends:       'openai/gpt-4o-mini',
  suggest_optimizations: 'openai/gpt-4o-mini',
  calculate_roi:         'google/gemini-2.0-flash',
  generate_report:       'openai/gpt-4o',
  predict_outcomes:      'openai/gpt-4o-mini',
  benchmark_competitors: 'openai/gpt-4o-mini',
};
