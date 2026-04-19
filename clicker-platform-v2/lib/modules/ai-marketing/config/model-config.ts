// Skill → model + credit cost mapping
// To change a model, update SKILL_MODEL_MAP. No other code needs to change.

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

export const SKILL_CREDIT_COST: Record<SkillId, number> = {
  generate_hashtags:         1,
  generate_cta:              1,
  calculate_roi:             2,
  generate_headline:         2,
  generate_caption:          3,
  adapt_tone:                3,
  translate_content:         3,
  generate_visual_prompt:    3,
  extract_brand_colors:      3,
  suggest_platforms:         3,
  suggest_budget_allocation: 3,
  ab_test_ideas:             3,
  analyze_performance:       3,
  identify_trends:           3,
  suggest_optimizations:     3,
  predict_outcomes:          3,
  benchmark_competitors:     3,
  analyze_model_photo:       5,
  analyze_background:        5,
  analyze_product:           5,
  generate_ad_copy:          5,
  define_target_audience:    5,
  competitive_analysis:      5,
  generate_report:           5,
  plan_campaign:             8,
  create_content_calendar:   8,
};
