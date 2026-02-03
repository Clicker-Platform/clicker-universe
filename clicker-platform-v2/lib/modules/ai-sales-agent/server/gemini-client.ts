import { GoogleGenerativeAI, SchemaType, Content, Tool } from "@google/generative-ai";
import { adminDb } from "@/lib/firebase-admin";

// Key for the secure configuration document
const CONFIG_DOC_PATH = "modules/ai-sales-agent/private/config";

/**
 * Retrieves the Gemini API Key from the secure Firestore document.
 * This is a server-side only operation using Firebase Admin SDK.
 */
export async function getGeminiApiKey(siteId: string): Promise<string | null> {
    try {
        // Try Site-Specific Config first
        const siteDoc = await adminDb.doc(`sites/${siteId}/modules/ai-sales-agent/private/config`).get();
        if (siteDoc.exists) {
            return siteDoc.data()?.apiKey || null;
        }

        // Fallback to Global/Platform Config
        const doc = await adminDb.doc(CONFIG_DOC_PATH).get();
        if (doc.exists) {
            return doc.data()?.apiKey || null;
        }
        // Fallback to Env if not in DB (for dev convenience)
        return process.env.GEMINI_API_KEY || null;
    } catch (error) {
        console.error("Error fetching Gemini API Key:", error);
        return null;
    }
}

let geminiClient: GoogleGenerativeAI | null = null;

export async function getGeminiClient(siteId: string): Promise<GoogleGenerativeAI> {
    // If client is already initialized with a key, verify validity (omitted for simple MVP singleton)
    // Note: Since Key can change at runtime via Admin UI, we might want to re-fetch or cache with TTL.
    // For MVP, we'll fetch key on every request to ensure freshness, 
    // OR we can rely on a lightweight check.

    // Better approach: Instantiate fresh client per request to guarantee latest key is used if changed.
    const apiKey = await getGeminiApiKey(siteId);

    if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure it in AI Sales Agent settings.");
    }

    return new GoogleGenerativeAI(apiKey);
}

export async function generateSalesResponse(
    modelName: string,
    systemPrompt: string,
    history: Content[],
    newMessage: string,
    siteId: string
): Promise<any> {
    const ai = await getGeminiClient(siteId);

    // Define the lead capture tool
    const leadTool: any = {
        functionDeclarations: [
            {
                name: "save_lead",
                description: "Save potential customer contact information (lead) to the database.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        name: { type: SchemaType.STRING, description: "Customer's name" },
                        email: { type: SchemaType.STRING, description: "Customer's email address" },
                        phone: { type: SchemaType.STRING, description: "Customer's phone number" },
                        note: { type: SchemaType.STRING, description: "Summary of customer's needs or inquiry" }
                    },
                    required: ["name"]
                }
            },
            {
                name: "lookup_knowledge",
                description: "Use this tool to find detailed company information, promotions, or technical specifications (e.g., battery, chassis, mileage) from the knowledge base.",
                parameters: {
                    type: SchemaType.OBJECT,
                    properties: {
                        query: {
                            type: SchemaType.STRING,
                            description: "The specific topic or question to look up (e.g., 'Aletra L8 battery specs', 'Current promotions')"
                        }
                    },
                    required: ["query"]
                }
            }
        ]
    };

    const model = ai.getGenerativeModel({
        model: modelName || "gemini-2.0-flash",
        systemInstruction: systemPrompt,
        tools: [leadTool]
    });

    const chat = model.startChat({
        history: history,
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.7,
        },
    });

    const result = await chat.sendMessage(newMessage);
    const response = await result.response;
    // Return the full response object to handle function calls in route.ts
    return response;
}

export async function listAvailableModels(siteId: string) {
    const apiKey = await getGeminiApiKey(siteId);
    if (!apiKey) return [];

    // Direct fetch to list models since SDK might hide it or require different instantiation
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.models || [];
    } catch (e) {
        console.error("Failed to list models", e);
        return [];
    }
}
