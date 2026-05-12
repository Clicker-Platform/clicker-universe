import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { invokeWithTools, getModel } from '@/lib/ai';
import type { ToolDefinition } from '@/lib/ai';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'save_lead',
      description: 'Save potential customer contact information (lead) to the database.',
      parameters: {
        type: 'object',
        properties: {
          name:  { type: 'string', description: "Customer's name" },
          email: { type: 'string', description: "Customer's email address" },
          phone: { type: 'string', description: "Customer's phone number" },
          note:  { type: 'string', description: "Summary of customer's needs or inquiry" },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_knowledge',
      description: 'Find detailed company information, promotions, or specifications from the knowledge base.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The specific topic or question to look up' },
        },
        required: ['query'],
      },
    },
  },
];

export async function POST(req: NextRequest) {
  try {
    const siteId = req.headers.get('x-site-id');
    if (!siteId) return NextResponse.json({ error: 'Site ID missing.' }, { status: 400 });

    const moduleDoc = await adminDb.doc(`sites/${siteId}/modules/ai-sales-agent`).get();
    if (!moduleDoc.exists || !moduleDoc.data()?.enabled) {
      return NextResponse.json({ error: 'AI Sales Agent module is disabled.' }, { status: 403 });
    }

    const config = moduleDoc.data() as Record<string, unknown>;
    const body = await req.json();
    const { history, newMessage } = body as { history: { role: string; text: string }[]; newMessage: string };

    if (!newMessage) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    const masterPrompt = (config.systemPrompt as string) || 'You are a helpful sales assistant.';
    const businessContext = (config.businessContext as string) || '';

    let productContext = '';
    try {
      const productsSnap = await adminDb.collection('sites').doc(siteId).collection('products').get();
      const products = productsSnap.docs
        .map(doc => {
          const d = doc.data();
          return { name: d.name || d.title || 'Untitled', price: d.price, description: d.description, isActive: d.isActive !== false };
        })
        .filter(p => p.isActive);
      if (products.length > 0) {
        productContext = 'AVAILABLE PRODUCTS:\n' + products.map(p => `- ${p.name} (${p.price}): ${p.description || ''}`).join('\n');
      }
    } catch { /* continue without products */ }

    let kbContent = '';
    try {
      const kbDoc = await adminDb.doc(`sites/${siteId}/modules/ai-sales-agent`).get();
      kbContent = (kbDoc.data()?.knowledgeBaseContent as string) || '';
    } catch { /* continue without KB */ }

    const systemPrompt = `${masterPrompt}\n\nBUSINESS CONTEXT:\n${businessContext}\n\n${productContext}\n\nINSTRUCTIONS:\n- Be polite, professional, and helpful.\n- Base answers strictly on the Business Context and Available Products provided.\n- LANGUAGE RULE: Always answer in the SAME language as the user.\n- Keep responses concise (under 3 sentences) unless detailed info is requested.`;

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
        content: msg.text,
      })),
      { role: 'user', content: newMessage },
    ];

    const model = await getModel('tools');
    const result = await invokeWithTools(
      { model, messages, tools: TOOLS, max_tokens: 500, temperature: 0.7 },
      { siteId, moduleId: 'ai_sales_agent', skillId: 'chat', creditCost: 1, uid: 'public' }
    );

    if (result.finishReason === 'tool_calls' && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];
      let toolResult = '';

      if (toolCall.function.name === 'save_lead') {
        const args = JSON.parse(toolCall.function.arguments) as Record<string, string>;
        await adminDb.collection(`sites/${siteId}/leads`).add({
          ...args,
          source: 'ai_chat',
          capturedAt: Date.now(),
        });
        toolResult = 'Lead saved successfully.';
      } else if (toolCall.function.name === 'lookup_knowledge') {
        toolResult = kbContent || 'No knowledge base content available.';
      }

      const followUpMessages = [
        ...messages,
        { role: 'assistant' as const, content: result.content ?? '' },
        { role: 'tool' as const, content: toolResult, tool_call_id: toolCall.id, name: toolCall.function.name },
      ];

      const followUp = await invokeWithTools(
        { model, messages: followUpMessages as never, tools: TOOLS, max_tokens: 500, temperature: 0.7 },
        { siteId, moduleId: 'ai_sales_agent', skillId: 'chat_followup', creditCost: 1, uid: 'public' }
      );

      return NextResponse.json({ response: followUp.content ?? '', timestamp: Date.now() });
    }

    return NextResponse.json({ response: result.content ?? '', timestamp: Date.now() });
  } catch (error: unknown) {
    const siteId = req.headers.get('x-site-id') ?? 'platform';
    logger.error('ai.chat.failed', { siteId, error });
    return NextResponse.json({ error: 'Failed to generate response.' }, { status: 500 });
  }
}
