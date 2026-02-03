
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import * as cheerio from 'cheerio';

// Force dynamic to ensure no static optimization weirdness with file uploads
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const urlsString = formData.get('urls') as string;
        const pdfFile = formData.get('pdfFile') as File | null;

        console.log(`[Sync] Started. PDF: ${pdfFile ? pdfFile.name : 'None'}, URL Count: ${urlsString ? urlsString.split('\n').length : 0}`);

        let combinedText = "";

        // 1. Process URLs (Scraping)
        if (urlsString) {
            const urls = urlsString.split('\n').map(u => u.trim()).filter(u => u.length > 0);

            const scrapePromises = urls.map(async (url) => {
                try {
                    const response = await fetch(url, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        }
                    });

                    if (!response.ok) return `[FAILED TO FETCH: ${url}]`;

                    const html = await response.text();
                    const $ = cheerio.load(html);

                    // Remove noise
                    $('script').remove();
                    $('style').remove();
                    $('nav').remove();
                    $('footer').remove();
                    $('.cookie-banner').remove();
                    $('.ad').remove();

                    // Extract main content
                    let content = $('article').text() || $('main').text() || $('body').text();
                    content = content.replace(/\s+/g, ' ').trim();

                    return `
--- SOURCE: ${url} ---
${content}
----------------------
`;
                } catch (err: any) {
                    console.error(`Error scraping ${url}:`, err);
                    return `[ERROR SCRAPING ${url}: ${err.message}]`;
                }
            });

            const scrapedResults = await Promise.all(scrapePromises);
            combinedText += scrapedResults.join('\n\n');
        }

        if (pdfFile) {
            try {
                console.log(`[Sync] Processing PDF with Gemini Vision: ${pdfFile.name}...`);

                // Get siteId from request headers (set by middleware)
                const siteId = req.headers.get('x-site-id');
                if (!siteId) {
                    throw new Error('Site ID is required for knowledge sync');
                }

                // Get Gemini Client
                const { getGeminiClient } = await import("@/lib/modules/ai-sales-agent/server/gemini-client");
                const ai = await getGeminiClient(siteId);
                // Using Gemini 2.0 Flash (Experimental) as 1.5 might have alias issues or strict versioning
                const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

                // Convert PDF to Base64 for Gemini
                const arrayBuffer = await pdfFile.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64Pdf = buffer.toString('base64');

                // Prompt for extraction
                const prompt = `
                    You are an expert Data Extractor for the Indonesian Automotive Market. 
                    I have attached a PDF brochure. 
                    Please extract ALL detailed technical specifications, product features, promo details, and key selling points.
                    
                    IMPORTANT: Output the data in **Bahasa Indonesia** (Indonesian).
                    
                    Format the output clearly for a Knowledge Base:
                    - **Model Name**
                    - **Key Selling Points** (Poin Penjualan Utama)
                    - **Technical Specs** (Spesifikasi Teknis - e.g., Baterai, Jarak Tempuh, Dimensi, Mesin)
                    - **Features** (Fitur - Interior, Eksterior, Safety, Tech)
                    - **Warranty & Promo** (Garansi & Promo)
                    
                    Maintain English technical terms if commonly used (e.g., "Airbags", "Captain Seat"), but explain or context in Indo.
                    Do NOT summarize too much, keep strict details.
                `;

                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            data: base64Pdf,
                            mimeType: "application/pdf",
                        },
                    },
                ]);

                const response = await result.response;
                const text = response.text();

                console.log(`[Sync] PDF Processed. Extracted Chars: ${text.length}`);

                combinedText += `
\n
--- SOURCE: PDF BROCHURE (${pdfFile.name}) [Processed by Gemini Vision] ---
${text}
-------------------------------------------------------------------------
`;
            } catch (err: any) {
                console.error("Error processing PDF with Gemini:", err);
                combinedText += `\n[ERROR PROCESSING PDF: ${err.message}]`;
            }
        }

        // 3. Save to Firestore
        await adminDb.collection('modules').doc('ai-sales-agent').set({
            knowledgeBaseContent: combinedText,
            knowledgeUpdatedAt: new Date().toISOString()
        }, { merge: true });

        return NextResponse.json({
            success: true,
            message: "Knowledge synced successfully",
            preview: combinedText.substring(0, 500) + "..."
        });

    } catch (error: any) {
        console.error("Knowledge Sync Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
