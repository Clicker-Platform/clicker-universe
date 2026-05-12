import { getSecret } from '@/lib/secrets';
import type { AIRequest, VisionRequest, ToolRequest, ToolCall } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

async function callOpenRouter(body: Record<string, unknown>): Promise<Response> {
  const apiKey = await getSecret('OPENROUTER_API_KEY');
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://clicker.id',
      'X-Title': 'Clicker Platform',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${errorBody}`);
  }
  return res;
}

export interface AIResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function callText(request: AIRequest): Promise<AIResult> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens ?? 2048,
    temperature: request.temperature ?? 0.7,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty response');

  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 2048) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 2048);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }

  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    inputTokens,
    outputTokens,
    model: request.model,
  };
}

export async function callVision(request: VisionRequest): Promise<AIResult> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    max_tokens: request.max_tokens ?? 2048,
    temperature: request.temperature ?? 0.2,
  });

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty vision response');

  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 2048) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 2048);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }

  return {
    content: typeof content === 'string' ? content : JSON.stringify(content),
    inputTokens,
    outputTokens,
    model: request.model,
  };
}

export interface AIToolResult {
  content: string | null;
  toolCalls: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length';
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export async function callWithTools(request: ToolRequest): Promise<AIToolResult> {
  const res = await callOpenRouter({
    model: request.model,
    messages: request.messages,
    tools: request.tools,
    tool_choice: request.tool_choice ?? 'auto',
    max_tokens: request.max_tokens ?? 1024,
    temperature: request.temperature ?? 0.7,
  });

  const data = await res.json();
  const choice = data.choices?.[0];
  if (!choice) throw new Error('OpenRouter returned empty tools response');

  const inputTokens = data.usage?.prompt_tokens
    ?? Math.ceil((request.max_tokens ?? 1024) * 0.3);
  const outputTokens = data.usage?.completion_tokens
    ?? (request.max_tokens ?? 1024);
  if (!data.usage?.prompt_tokens) {
    console.warn('[ai/client] usage missing for model:', request.model);
  }

  return {
    content: choice.message?.content ?? null,
    toolCalls: choice.message?.tool_calls ?? [],
    finishReason: choice.finish_reason ?? 'stop',
    inputTokens,
    outputTokens,
    model: request.model,
  };
}
