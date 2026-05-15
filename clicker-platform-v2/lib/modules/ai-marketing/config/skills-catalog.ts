// Complete skill catalog — defines all skills available in the Generate page UI

import { SkillDefinition } from '../types';
import { PLATFORM_OPTIONS, TONE_OPTIONS, STYLE_OPTIONS } from '../constants';

export const SKILLS_CATALOG: SkillDefinition[] = [
  // ── Creative Director ────────────────────────────────────────────────────
  {
    id: 'generate_ad_copy',
    label: 'Ad Copy',
    description: 'Generate Meta/TikTok/Google ad copy with multiple variations',
    agentId: 'creative_director',

    formFields: [
      { name: 'product', label: 'Product / Service', type: 'text', placeholder: 'e.g. Premium skincare serum', required: true },
      { name: 'platform', label: 'Platform', type: 'select', options: PLATFORM_OPTIONS, required: true },
      { name: 'objective', label: 'Campaign Objective', type: 'select', options: [
        { value: 'awareness', label: 'Brand Awareness' },
        { value: 'consideration', label: 'Consideration / Traffic' },
        { value: 'conversion', label: 'Conversions / Sales' },
        { value: 'engagement', label: 'Engagement' },
      ], required: true },
      { name: 'visualContext', label: 'Visual Context', type: 'textarea', placeholder: 'Describe the image or creative concept...' },
    ],
  },
  {
    id: 'generate_caption',
    label: 'Social Caption',
    description: 'Create engaging social media captions with hashtags',
    agentId: 'creative_director',
    formFields: [
      { name: 'contentContext', label: 'Content Description', type: 'textarea', placeholder: 'Describe what the post is about...', required: true },
      { name: 'platform', label: 'Platform', type: 'select', options: PLATFORM_OPTIONS, required: true },
      { name: 'includeHashtags', label: 'Include Hashtags', type: 'select', options: [
        { value: 'true', label: 'Yes' },
        { value: 'false', label: 'No' },
      ] },
    ],
  },
  {
    id: 'generate_headline',
    label: 'Headlines',
    description: 'Generate 8 compelling headline variations',
    agentId: 'creative_director',
    formFields: [
      { name: 'product', label: 'Product / Service', type: 'text', placeholder: 'e.g. Online coaching program', required: true },
      { name: 'campaignContext', label: 'Campaign Context', type: 'textarea', placeholder: 'Optional: brief campaign context...' },
    ],
  },
  {
    id: 'generate_cta',
    label: 'Call to Action',
    description: 'Generate 5 CTA variations for your campaign',
    agentId: 'creative_director',
    formFields: [
      { name: 'product', label: 'Product / Service', type: 'text', required: true },
      { name: 'objective', label: 'Action You Want', type: 'select', options: [
        { value: 'purchase', label: 'Purchase / Order Now' },
        { value: 'signup', label: 'Sign Up / Register' },
        { value: 'learn_more', label: 'Learn More' },
        { value: 'download', label: 'Download' },
        { value: 'book', label: 'Book / Reserve' },
        { value: 'contact', label: 'Contact Us' },
      ] },
    ],
  },
  {
    id: 'generate_hashtags',
    label: 'Hashtags',
    description: 'Generate relevant hashtag sets (broad + niche + branded)',
    agentId: 'creative_director',
    formFields: [
      { name: 'contentContext', label: 'Content Description', type: 'textarea', placeholder: 'Describe the content topic...', required: true },
      { name: 'platform', label: 'Platform', type: 'select', options: PLATFORM_OPTIONS },
    ],
  },
  {
    id: 'translate_content',
    label: 'Translate Content',
    description: 'Translate marketing content while preserving brand tone',
    agentId: 'creative_director',
    formFields: [
      { name: 'content', label: 'Content to Translate', type: 'textarea', placeholder: 'Paste the content to translate...', required: true },
      { name: 'targetLanguage', label: 'Target Language', type: 'select', options: [
        { value: 'id', label: 'Indonesian (Bahasa)' },
        { value: 'en', label: 'English' },
        { value: 'ms', label: 'Malay' },
      ] },
    ],
  },
  {
    id: 'adapt_tone',
    label: 'Adapt Tone',
    description: 'Rewrite existing content in a different brand voice',
    agentId: 'creative_director',
    formFields: [
      { name: 'content', label: 'Original Content', type: 'textarea', placeholder: 'Paste the content to rewrite...', required: true },
      { name: 'targetTone', label: 'Target Tone', type: 'select', options: TONE_OPTIONS },
      { name: 'targetStyle', label: 'Target Style', type: 'select', options: STYLE_OPTIONS },
    ],
  },

  // ── Strategist ───────────────────────────────────────────────────────────
  {
    id: 'plan_campaign',
    label: 'Campaign Plan',
    description: 'Full campaign plan with strategy, phases, and KPIs',
    agentId: 'strategist',
    formFields: [
      { name: 'product', label: 'Product / Service', type: 'text', required: true },
      { name: 'objective', label: 'Campaign Objective', type: 'text', placeholder: 'e.g. Launch new product, increase sales by 30%', required: true },
      { name: 'budget', label: 'Budget', type: 'text', placeholder: 'e.g. Rp 10,000,000 / month' },
      { name: 'duration', label: 'Duration', type: 'select', options: [
        { value: '2 weeks', label: '2 Weeks' },
        { value: '30 days', label: '1 Month' },
        { value: '3 months', label: '3 Months' },
        { value: '6 months', label: '6 Months' },
      ] },
      { name: 'platforms', label: 'Platforms', type: 'text', placeholder: 'e.g. Instagram, TikTok, Google' },
    ],
  },
  {
    id: 'define_target_audience',
    label: 'Target Audience',
    description: 'Define detailed audience personas with demographics and messaging angles',
    agentId: 'strategist',
    formFields: [
      { name: 'product', label: 'Product / Service', type: 'text', required: true },
      { name: 'existingData', label: 'Existing Customer Data (optional)', type: 'textarea', placeholder: 'Describe what you know about your current customers...' },
    ],
  },
  {
    id: 'suggest_platforms',
    label: 'Platform Recommendations',
    description: 'Get ranked platform recommendations for your audience and objective',
    agentId: 'strategist',
    formFields: [
      { name: 'objective', label: 'Campaign Objective', type: 'text', required: true },
      { name: 'budget', label: 'Monthly Budget', type: 'text' },
    ],
  },
  {
    id: 'create_content_calendar',
    label: 'Content Calendar',
    description: 'Generate a day-by-day content schedule for your campaign',
    agentId: 'strategist',
    formFields: [
      { name: 'campaignSummary', label: 'Campaign Summary', type: 'textarea', placeholder: 'Brief description of your campaign goal and product...', required: true },
      { name: 'duration', label: 'Duration', type: 'select', options: [
        { value: '2 weeks', label: '2 Weeks' },
        { value: '30 days', label: '1 Month' },
        { value: '3 months', label: '3 Months' },
      ] },
      { name: 'postsPerWeek', label: 'Posts per Week', type: 'select', options: [
        { value: '3', label: '3 posts' },
        { value: '5', label: '5 posts' },
        { value: '7', label: '7 posts (daily)' },
      ] },
    ],
  },
  {
    id: 'suggest_budget_allocation',
    label: 'Budget Allocation',
    description: 'Get recommended budget split across platforms with rationale',
    agentId: 'strategist',
    formFields: [
      { name: 'budget', label: 'Total Budget', type: 'text', placeholder: 'e.g. Rp 5,000,000', required: true },
      { name: 'platforms', label: 'Platforms to Consider', type: 'text', placeholder: 'e.g. Meta, TikTok, Google' },
      { name: 'objective', label: 'Primary Objective', type: 'text', required: true },
      { name: 'duration', label: 'Campaign Duration', type: 'text', placeholder: 'e.g. 30 days' },
    ],
  },

  // ── Data Analyst ─────────────────────────────────────────────────────────
  {
    id: 'analyze_performance',
    label: 'Performance Analysis',
    description: 'Analyze campaign metrics and extract KPI insights',
    agentId: 'data_analyst',
    formFields: [
      { name: 'metrics', label: 'Metrics Data', type: 'textarea', placeholder: 'Paste your metrics data (CSV or plain text):\nImpressions: 10,000\nClicks: 500\nCTR: 5%\n...', required: true },
      { name: 'period', label: 'Reporting Period', type: 'text', placeholder: 'e.g. Jan 1 – Jan 31, 2025' },
      { name: 'platform', label: 'Platform', type: 'text', placeholder: 'e.g. Meta Ads, TikTok Ads' },
    ],
  },
  {
    id: 'calculate_roi',
    label: 'ROI Calculator',
    description: 'Calculate ROI, ROAS, and profitability metrics',
    agentId: 'data_analyst',
    formFields: [
      { name: 'spend', label: 'Total Ad Spend', type: 'text', placeholder: 'e.g. Rp 2,000,000', required: true },
      { name: 'revenue', label: 'Revenue Generated', type: 'text', placeholder: 'e.g. Rp 8,000,000', required: true },
      { name: 'period', label: 'Period', type: 'text', placeholder: 'e.g. Last 30 days' },
      { name: 'channel', label: 'Channel', type: 'text', placeholder: 'e.g. Meta Ads' },
    ],
  },
  {
    id: 'suggest_optimizations',
    label: 'Optimization Recommendations',
    description: 'Get prioritized action items to improve campaign performance',
    agentId: 'data_analyst',
    formFields: [
      { name: 'performanceData', label: 'Current Performance Data', type: 'textarea', placeholder: 'Describe or paste your current performance metrics...', required: true },
      { name: 'goals', label: 'Goals', type: 'text', placeholder: 'e.g. Reduce CPA, increase ROAS', required: true },
      { name: 'currentStrategy', label: 'Current Strategy (optional)', type: 'textarea' },
    ],
  },
  {
    id: 'generate_report',
    label: 'Performance Report',
    description: 'Create an executive-ready marketing performance report',
    agentId: 'data_analyst',
    formFields: [
      { name: 'metrics', label: 'Performance Data', type: 'textarea', placeholder: 'Paste all metrics and channel data...', required: true },
      { name: 'period', label: 'Reporting Period', type: 'text', required: true },
      { name: 'goals', label: 'Campaign Goals', type: 'text', placeholder: 'e.g. 100 sales, 50K reach' },
      { name: 'brandName', label: 'Brand Name', type: 'text' },
    ],
  },
];

export const AGENT_LABELS: Record<string, { label: string; color: string }> = {
  creative_director: { label: 'Creative Director', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  strategist:        { label: 'Strategist',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
  data_analyst:      { label: 'Data Analyst',      color: 'bg-green-100 text-green-700 border-green-200' },
  visual_analyst:    { label: 'Visual Analyst',    color: 'bg-orange-100 text-orange-700 border-orange-200' },
};
