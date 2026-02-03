
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { listAvailableModels } from "@/lib/modules/ai-sales-agent/server/gemini-client";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const diagnostic: any = {
        timestamp: new Date().toISOString(),
        layers: {},
        overallStatus: "UNKNOWN"
    };

    try {
        // --- LAYER 1: DATABASE PRODUCTS ---
        try {
            const productsSnap = await adminDb.collection('products').where('isActive', '==', true).get();
            diagnostic.layers.database = {
                status: "OK",
                message: `Found ${productsSnap.size} active products.`,
                sample: productsSnap.docs.length > 0 ? productsSnap.docs[0].data().name : "None"
            };
        } catch (e: any) {
            diagnostic.layers.database = { status: "ERROR", message: e.message };
        }

        // --- FETCH AGENT CONFIG FOR LAYERS 2, 3, 4 ---
        const agentDoc = await adminDb.doc('modules/ai-sales-agent').get();
        const agentData = agentDoc.data() || {};
        const kbContent = agentData.knowledgeBaseContent || "";

        // --- LAYER 4: MANUAL CONTEXT ---
        if (agentData.businessContext && agentData.businessContext.length > 5) {
            diagnostic.layers.manualContext = {
                status: "OK",
                length: agentData.businessContext.length,
                preview: agentData.businessContext.substring(0, 50) + "..."
            };
        } else {
            diagnostic.layers.manualContext = { status: "WARNING", message: "Business Context is empty or too short." };
        }

        // --- LAYER 2: WEB SCRAPING ---
        const hasWebSource = kbContent.includes("--- SOURCE: http");
        diagnostic.layers.webScraping = {
            status: hasWebSource ? "OK" : "WARNING",
            message: hasWebSource ? "Web content markers found." : "No web source markers found in Knowledge Base."
        };

        // --- LAYER 3: PDF KNOWLEDGE ---
        const hasPdfSource = kbContent.includes("--- SOURCE: PDF");
        const isGeminiProcessed = kbContent.includes("Processed by Gemini Vision");

        diagnostic.layers.pdfKnowledge = {
            status: hasPdfSource ? "OK" : "WARNING",
            message: hasPdfSource
                ? (isGeminiProcessed ? "Smart PDF (Gemini Vision) content found." : "Legacy PDF content found.")
                : "No PDF source markers found.",
            extractionMethod: isGeminiProcessed ? "Gemini Vision" : "Legacy Parser"
        };

        // --- GEMINI CONNECTIVITY ---
        try {
            const siteId = req.headers.get('x-site-id') || 'default';
            const models = await listAvailableModels(siteId);
            diagnostic.layers.aiEngine = {
                status: models.length > 0 ? "OK" : "ERROR",
                message: models.length > 0 ? "Gemini API connected." : "No models returned.",
                availableModels: models.map((m: any) => m.name).slice(0, 3) // Show first 3
            };
        } catch (e: any) {
            diagnostic.layers.aiEngine = { status: "ERROR", message: "Failed to connect to Gemini: " + e.message };
        }

        // --- OVERALL STATUS ---
        const allOk = Object.values(diagnostic.layers).every((l: any) => l.status === "OK");
        diagnostic.overallStatus = allOk ? "ALL SYSTEMS GO 🟢" : "ISSUES DETECTED 🟡";

        return NextResponse.json(diagnostic, { status: 200 });

    } catch (error: any) {
        return NextResponse.json({
            status: "CRITICAL_ERROR",
            message: error.message
        }, { status: 500 });
    }
}
