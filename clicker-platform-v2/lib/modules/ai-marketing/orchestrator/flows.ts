// Multi-skill flow definitions
// Each flow chains multiple skills sequentially, passing context between steps

import { MultiSkillFlow } from '../types';

export const MULTI_SKILL_FLOWS: Record<string, MultiSkillFlow> = {
  full_campaign: {
    id: 'full_campaign',
    label: 'Full Campaign Generation',
    description: 'Strategy + audience + copy in one complete campaign package',
    steps: [
      { agent: 'strategist',        skill: 'plan_campaign' },
      { agent: 'strategist',        skill: 'define_target_audience' },
      { agent: 'visual_analyst',    skill: 'analyze_model_photo', conditional: 'hasImages' },
      { agent: 'creative_director', skill: 'generate_ad_copy' },
      { agent: 'creative_director', skill: 'generate_headline' },
      { agent: 'creative_director', skill: 'generate_caption' },
    ],
    estimatedCredits: 28,
  },

  ad_copy_pack: {
    id: 'ad_copy_pack',
    label: 'Ad Copy Package',
    description: 'Complete set of ad copy, headlines, and CTAs for one campaign',
    steps: [
      { agent: 'creative_director', skill: 'generate_ad_copy' },
      { agent: 'creative_director', skill: 'generate_headline' },
      { agent: 'creative_director', skill: 'generate_cta' },
    ],
    estimatedCredits: 8,
  },

  performance_review: {
    id: 'performance_review',
    label: 'Performance Review',
    description: 'Full analysis: metrics → trends → optimization recommendations',
    steps: [
      { agent: 'data_analyst', skill: 'analyze_performance' },
      { agent: 'data_analyst', skill: 'identify_trends' },
      { agent: 'data_analyst', skill: 'suggest_optimizations' },
    ],
    estimatedCredits: 9,
  },

  social_content_pack: {
    id: 'social_content_pack',
    label: 'Social Content Pack',
    description: 'Caption, hashtags, and platform suggestions for one piece of content',
    steps: [
      { agent: 'creative_director', skill: 'generate_caption' },
      { agent: 'creative_director', skill: 'generate_hashtags' },
      { agent: 'strategist',        skill: 'suggest_platforms' },
    ],
    estimatedCredits: 7,
  },
};
