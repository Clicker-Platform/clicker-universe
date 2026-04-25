import { NextRequest, NextResponse } from "next/server";
import { generateSalesResponse, listAvailableModels } from "@/lib/modules/ai-sales-agent/server/gemini-client";
import { adminDb } from "@/lib/firebase-admin";
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const siteId = req.headers.get('x-site-id');
        if (!siteId) {
            return NextResponse.json({ error: "Site ID missing." }, { status: 400 });
        }

        // 1. Check if Module is Enabled
        const moduleId = "ai-sales-agent";
        const moduleDoc = await adminDb.doc(`sites/${siteId}/modules/${moduleId}`).get();
        if (!moduleDoc.exists || !moduleDoc.data()?.enabled) {
            return NextResponse.json({ error: "AI Sales Agent module is disabled." }, { status: 403 });
        }

        const config = moduleDoc.data() as any; // Cast to known type if available

        // 2. Parse payload
        const body = await req.json();
        const { history, newMessage } = body;

        if (!newMessage) {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        // 3. Construct System Prompt
        // Combine Master System Prompt + Business Context
        const masterPrompt = config.systemPrompt || "You are a helpful sales assistant.";
        const businessContext = config.businessContext || "";

        // --- DYNAMIC PRODUCT CONTEXT ---
        let productContext = "";
        try {
            const productsSnap = await adminDb.collection('sites').doc(siteId).collection('products').get();
            const products = productsSnap.docs
                .map(doc => {
                    const d = doc.data();
                    return {
                        name: d.name || d.title || 'Untitled',
                        price: d.price,
                        description: d.description,
                        isActive: d.isActive !== false // Default true
                    };
                })
                .filter(p => p.isActive);

            if (products.length > 0) {
                productContext = "AVAILABLE PRODUCTS/MENU:\n" + products.map(p =>
                    `- ${p.name} (${p.price}): ${p.description || 'No description'}`
                ).join('\n');
            }
        } catch (err) {
            // Continue without products if fetch fails
        }

        const fullSystemInstruction = `
${masterPrompt}

BUSINESS CONTEXT:
${businessContext}

${productContext}

INSTRUCTIONS:
- Be polite, professional, and helpful.
- Base your answers strictly on the Business Context and Available Products provided above.
- **LANGUAGE RULE**: Always answer in the SAME language as the User. If they ask in English, answer in English (translating the Indo knowledge base as needed). If they ask in Indo, answer in Indo.
- If unsure, ask for clarification or offer to collect contact info.
- Keep responses concise (under 3 sentences) unless detailed info is requested.
`;

        // 4. Transform History for Gemini (User/Model roles)
        // Gemini expects: { role: 'user' | 'model', parts: [{ text: string }] }
        const geminiHistory = history.map((msg: any) => ({
            role: msg.role === 'assistant' ? 'model' : msg.role, // normalize
            parts: [{ text: msg.text }]
        }));

        // Gemini Integrity Check: History must start with 'user'
        // If the first message is 'model' (e.g. greeting), remove it.
        if (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
            geminiHistory.shift();
        }

        // 5. Call Gemini with Fallback Strategy
        let responseText;
        const primaryModel = config.model || "gemini-2.0-flash";
        const debugLog: string[] = [];

        try {
            debugLog.push(`Attempting primary model: ${primaryModel}`);
            const resultResponse = await generateSalesResponse(
                primaryModel,
                fullSystemInstruction,
                geminiHistory,
                newMessage,
                siteId
            );

            // Check for function calls
            const functionCalls = resultResponse.functionCalls();

            if (functionCalls && functionCalls.length > 0) {
                const call = functionCalls[0];
                debugLog.push(`Function call detected: ${call.name}`);

                if (call.name === 'save_lead') {
                    const args = call.args;
                    // Save to Inbox Submissions
                    const submissionsRef = adminDb.collection('sites').doc(siteId).collection('submissions');
                    const submissionId = submissionsRef.doc().id;
                    await submissionsRef.doc(submissionId).set({
                        id: submissionId,
                        formId: 'ai-sales-agent',
                        formTitle: 'AI Sales Chat Lead',
                        data: args,
                        submittedAt: new Date().toISOString(),
                        status: 'new'
                    });
                    responseText = `I have securely saved your information. Someone from our team will contact you shortly at ${args.email || args.phone}.`;

                } else if (call.name === 'lookup_knowledge') {
                    debugLog.push(`Executing lookup_knowledge: ${call.args.query}`);

                    // 1. Fetch Knowledge from Firestore
                    const agentDoc = await adminDb.doc(`sites/${siteId}/modules/ai-sales-agent`).get();
                    const kbContent = agentDoc.data()?.knowledgeBaseContent || "No knowledge base content found.";

                    // 2. Simulate Multi-turn by updating history
                    // We must manually reconstruct the conversation so far so the model sees the tool output
                    geminiHistory.push({
                        role: 'model',
                        parts: [{ functionCall: { name: 'lookup_knowledge', args: call.args } }]
                    });

                    geminiHistory.push({
                        role: 'function',
                        parts: [{ functionResponse: { name: 'lookup_knowledge', response: { content: kbContent } } }]
                    });

                    // 3. Follow-up call to get the actual answer
                    // We send a "continue" signal. 
                    // Note: generateSalesResponse wraps the last arg as a User Message. 
                    // Asking it effectively prompts the model to interpret the function output.
                    const secondResult = await generateSalesResponse(
                        primaryModel,
                        fullSystemInstruction,
                        geminiHistory,
                        "(System: The knowledge has been retrieved above. Please answer the user's question based on it.)",
                        siteId
                    );
                    responseText = secondResult.text();
                } else {
                    responseText = resultResponse.text();
                }
            } else {
                responseText = resultResponse.text();
            }

        } catch (primaryError: any) {
            debugLog.push(`Primary error: ${primaryError.message}`);
            logger.warn('ai.primary.model.failed', { siteId, error: primaryError.message });

            // If explicit model failed (404), try the stable 'gemini-flash-latest'
            if (primaryError.message.includes('404') || primaryError.message.includes('not found')) {
                try {
                    debugLog.push("Attempting fallback: gemini-flash-latest");
                    const fallbackResult = await generateSalesResponse(
                        "gemini-flash-latest",
                        fullSystemInstruction,
                        geminiHistory,
                        newMessage,
                        siteId
                    );
                    responseText = fallbackResult.text();
                } catch (fallbackError: any) {
                    debugLog.push(`Fallback error: ${fallbackError.message}`);

                    // CRITICAL DEBUG: List what models ARE available
                    try {
                        const models = await listAvailableModels(siteId);
                        const modelNames = models.map((m: any) => m.name);
                        debugLog.push(`Available Models for this Key: ${JSON.stringify(modelNames)}`);
                    } catch (listError) {
                        debugLog.push("Could not list models.");
                    }

                    // Throw a combined error to be caught by outer block
                    throw new Error(`All models failed. Debug: ${JSON.stringify(debugLog)}`);
                }
            } else {
                throw primaryError;
            }
        }

        return NextResponse.json({
            response: responseText,
            timestamp: Date.now(),
            debug: debugLog
        });

    } catch (error: any) {
        logger.error('ai.chat.failed', { siteId: req.headers.get('x-site-id') ?? 'platform', error });
        return NextResponse.json({
            error: "Failed to generate response.",
            details: error.message
        }, { status: 500 });
    }
}
