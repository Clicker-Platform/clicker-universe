// AI Marketing Module — path constants
// Never hardcode these strings elsewhere — always import from here

export const MODULE_ID = 'ai_marketing';

// Firestore collection paths (relative to sites/{siteId}/)
export const COLLECTION_SETTINGS    = 'modules/ai_marketing/settings';
export const COLLECTION_ASSETS      = 'modules/ai_marketing/assets';
export const COLLECTION_GENERATIONS = 'modules/ai_marketing/generations';
export const COLLECTION_SAVED       = 'modules/ai_marketing/saved_content';
export const COLLECTION_CAMPAIGNS   = 'modules/ai_marketing/campaigns';

// Settings document ID
export const SETTINGS_DOC_ID = 'default';

// Storage
export const STORAGE_FOLDER  = 'marketing-assets';
export const MAX_STORAGE_MB  = 100;
export const MAX_STORAGE_BYTES = MAX_STORAGE_MB * 1024 * 1024;

// Admin route paths
export const ROUTES = {
  dashboard:      '/admin/marketing/dashboard',
  generate:       '/admin/marketing/generate',
  assets:         '/admin/marketing/assets',
  assetDetail:    '/admin/marketing/assets/detail',
  campaigns:      '/admin/marketing/campaigns',
  campaignDetail: '/admin/marketing/campaigns/detail',
  analytics:      '/admin/marketing/analytics',
  settings:       '/admin/marketing/settings',
} as const;

// API route paths
export const API = {
  generate:  '/api/admin/modules/ai-marketing/generate',
  assets: {
    upload:  '/api/admin/modules/ai-marketing/assets/upload',
    analyze: '/api/admin/modules/ai-marketing/assets/analyze',
  },
  campaigns: '/api/admin/modules/ai-marketing/campaigns',
  saved:     '/api/admin/modules/ai-marketing/saved',
  config:    '/api/admin/modules/ai-marketing/config',
  export:    '/api/admin/modules/ai-marketing/export',
  credits:   '/api/admin/ai/credits',
} as const;

// Default brand voice
export const DEFAULT_BRAND_VOICE = {
  tone: 'professional' as const,
  style: 'conversational' as const,
  languages: ['id', 'en'],
  description: '',
  targetAudience: '',
  keyMessages: [],
};

// Default platforms
export const PLATFORM_OPTIONS = [
  { value: 'meta',      label: 'Meta (Facebook/Instagram)' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'google',    label: 'Google Ads' },
  { value: 'linkedin',  label: 'LinkedIn' },
  { value: 'twitter',   label: 'X (Twitter)' },
  { value: 'youtube',   label: 'YouTube' },
];

export const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual',       label: 'Casual' },
  { value: 'friendly',     label: 'Friendly' },
  { value: 'authoritative',label: 'Authoritative' },
  { value: 'playful',      label: 'Playful' },
];

export const STYLE_OPTIONS = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'formal',         label: 'Formal' },
  { value: 'direct',         label: 'Direct' },
  { value: 'storytelling',   label: 'Storytelling' },
];
