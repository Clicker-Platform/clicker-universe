// Platform-level AI types — shared across all AI modules

export interface AIRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  max_tokens?: number;
  temperature?: number;
}

export interface VisionRequest {
  model: string;
  messages: {
    role: 'user';
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'image_url'; image_url: { url: string } }
    >;
  }[];
  max_tokens?: number;
  temperature?: number;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required?: string[];
    };
  };
}

export interface ToolRequest {
  model: string;
  messages: { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }[];
  tools: ToolDefinition[];
  tool_choice?: 'auto' | 'none';
  max_tokens?: number;
  temperature?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolResponse {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
}

export interface AICallOptions {
  siteId: string;
  moduleId: string;
  skillId: string;
  uid: string;
}

export interface AIUsageResult {
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  model: string;
}

export interface CreditBalance {
  balance: number;
  lifetimeUsed: number;
}

export interface CreditLedgerEntry {
  type: 'topup' | 'debit' | 'refund';
  amount: number;
  balanceAfter: number;
  moduleId: string;
  skillId: string;
  description?: string;
  performedBy: string;
  createdAt: FirebaseFirestore.Timestamp;
  metadata?: Record<string, unknown>;
}

export interface ModelConfig {
  chat: string;
  vision: string;
  tools: string;
  fast: string;
  quality: string;
  rag: string;
}

export interface TenantContext {
  businessName: string;
  businessType: string;
  tone: string;
  language: string;
  knowledgeBase: string;
  activeModules: string[];
}

export interface ContextEnrichment {
  products?: { name: string; price?: number; description?: string }[];
  custom?: string;
}
