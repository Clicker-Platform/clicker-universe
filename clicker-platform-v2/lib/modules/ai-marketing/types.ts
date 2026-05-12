'use client';

// AI Marketing Module — shared types

export type AgentId = 'visual_analyst' | 'creative_director' | 'strategist' | 'data_analyst';

export type SkillId =
  // Visual Analyst
  | 'analyze_model_photo' | 'analyze_background' | 'analyze_product'
  | 'generate_visual_prompt' | 'extract_brand_colors'
  // Creative Director
  | 'generate_ad_copy' | 'generate_caption' | 'generate_headline'
  | 'generate_cta' | 'adapt_tone' | 'generate_hashtags' | 'translate_content'
  // Strategist
  | 'plan_campaign' | 'define_target_audience' | 'suggest_platforms'
  | 'create_content_calendar' | 'suggest_budget_allocation'
  | 'competitive_analysis' | 'ab_test_ideas'
  // Data Analyst
  | 'analyze_performance' | 'identify_trends' | 'suggest_optimizations'
  | 'calculate_roi' | 'generate_report' | 'predict_outcomes' | 'benchmark_competitors';

export type AssetType = 'model' | 'background' | 'product';

export type ContentType =
  | 'ad_copy' | 'caption' | 'headline' | 'cta' | 'hashtags'
  | 'campaign_plan' | 'content_calendar' | 'report' | 'analysis';

export type CampaignStatus = 'draft' | 'planned' | 'active' | 'paused' | 'completed';

export interface BrandVoiceConfig {
  tone: 'professional' | 'casual' | 'friendly' | 'authoritative' | 'playful';
  style: 'conversational' | 'formal' | 'direct' | 'storytelling';
  languages: string[];
  description: string;
  targetAudience: string;
  keyMessages: string[];
}

export interface MarketingSettings {
  brandVoice: BrandVoiceConfig;
  defaultPlatforms: string[];
  updatedAt: any;
  updatedBy: string;
}

export interface AssetAnalysis {
  subject: Record<string, any>;
  composition: string;
  lighting: string;
  mood: string;
  colors: { hex: string; name: string; percentage: number }[];
  generatedPrompt: string;
  recommendedUseCases: string[];
  analyzedAt: any;
}

export interface MarketingAsset {
  id: string;
  type: AssetType;
  fileName: string;
  fileUrl: string;
  thumbnailUrl: string;
  fileSizeMB: number;
  mimeType: string;
  tags: string[];
  analysis: AssetAnalysis | null;
  analysisStatus: 'pending' | 'analyzing' | 'complete' | 'failed';
  createdAt: any;
  createdBy: string;
}

export interface GenerationInput {
  userPrompt: string;
  platform?: string;
  assetIds?: string[];
  formData?: Record<string, any>;
}

export interface GenerationOutput {
  content: string;
  variations?: string[];
  structured?: Record<string, any>;
}

export interface MarketingGeneration {
  id: string;
  skillId: SkillId;
  agentId: AgentId;
  flowId?: string;
  input: GenerationInput;
  output: GenerationOutput;
  model: string;
  creditsUsed?: number;
  status: 'generating' | 'complete' | 'failed';
  createdAt: any;
  createdBy: string;
}

export interface SavedContent {
  id: string;
  generationId: string;
  campaignId?: string;
  type: ContentType;
  content: string;
  platform?: string;
  tags: string[];
  createdAt: any;
  createdBy: string;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  platform: string;
  objective: string;
  status: CampaignStatus;
  strategy: {
    audiencePersonas: Record<string, any>[];
    budgetAllocation: Record<string, number>;
    contentCalendar: Record<string, any>[];
    successMetrics: Record<string, any>;
  } | null;
  savedContentIds: string[];
  assetIds: string[];
  performanceData: {
    metrics: Record<string, number>;
    lastAnalysis: Record<string, any> | null;
    lastAnalyzedAt: any | null;
  } | null;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface SkillDefinition {
  id: SkillId;
  label: string;
  description: string;
  agentId: AgentId;
  formFields: SkillFormField[];
}

export interface SkillFormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'file';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
}

export interface MultiSkillFlow {
  id: string;
  label: string;
  description: string;
  steps: { agent: AgentId; skill: SkillId; conditional?: string }[];
  estimatedCredits: number;
}
