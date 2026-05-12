import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import * as cheerio from 'cheerio';
import { logger } from '@/lib/logger';
import { requireAuthedMember } from '@/lib/api-auth';
import { invokeVision, getModel } from '@/lib/ai';

export const dynamic = 'force-dynamic';

const PDF_PROMPT = `You are an expert Data Extractor for the Indonesian Automotive Market.
I have attached a PDF brochure.
Please extract ALL detailed technical specifications, product features, promo details, and key selling points.

IMPORTANT: Output the data in Bahasa Indonesia (Indonesian).

Format the output clearly for a Knowledge Base:
- **Model Name**
- **Key Selling Points** (Poin Penjualan Utama)
- **Technical Specs** (Spesifikasi Teknis - e.g., Baterai, Jarak Tempuh, Dimensi, Mesin)
- **Features** (Fitur - Interior, Eksterior, Safety, Tech)
- **Warranty & Promo** (Garansi & Promo)

Maintain English technical terms if commonly used (e.g., "Airbags", "Captain Seat"), but explain or context in Indo.
Do NOT summarize too much, keep strict details.`;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthedMember(req);
    if (!auth.ok) return auth.res;
    const { siteId } = auth.session;

    const formData = await req.formData();
    const urlsString = formData.get('urls') as string;
    const pdfFile = formData.get('pdfFile') as File | null;

    let combinedText = '';

    // Process URLs (scraping)
    if (urlsString) {
      const urls = urlsString.split('\n').map(u => u.trim()).filter(u => u.length > 0);

      const scrapePromises = urls.map(async (url) => {
        try {
          const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ClickerBot/1.0)' },
          });
          if (!response.ok) return `[FAILED TO FETCH: ${url}]`;

          const html = await response.text();
          const $ = cheerio.load(html);
          $('script, style, nav, footer, .cookie-banner, .ad').remove();
          let content = $('article').text() || $('main').text() || $('body').text();
          content = content.replace(/\s+/g, ' ').trim();

          return `\n--- SOURCE: ${url} ---\n${content}\n----------------------\n`;
        } catch (err: unknown) {
          return `[ERROR SCRAPING ${url}: ${err instanceof Error ? err.message : String(err)}]`;
        }
      });

      const scrapedResults = await Promise.all(scrapePromises);
      combinedText += scrapedResults.join('\n\n');
    }

    // Process PDF
    if (pdfFile) {
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64Pdf = Buffer.from(arrayBuffer).toString('base64');

        const visionModel = await getModel('vision');
        const text = await invokeVision(
          {
            model: visionModel,
            messages: [{
              role: 'user',
              content: [
                { type: 'text', text: PDF_PROMPT },
                { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64Pdf}` } },
              ],
            }],
            max_tokens: 4096,
            temperature: 0.1,
          },
          { siteId, moduleId: 'ai_sales_agent', skillId: 'pdf_extraction', creditCost: 5, uid: 'system' }
        );

        combinedText += `\n\n--- SOURCE: PDF BROCHURE (${pdfFile.name}) ---\n${text}\n---\n`;
      } catch (err: unknown) {
        logger.error('knowledge.sync.pdf.failed', { siteId, error: err });
        combinedText += `\n[ERROR PROCESSING PDF: ${err instanceof Error ? err.message : String(err)}]`;
      }
    }

    await adminDb
      .collection('sites')
      .doc(siteId)
      .collection('modules')
      .doc('ai-sales-agent')
      .set({ knowledgeBaseContent: combinedText, knowledgeUpdatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({
      success: true,
      message: 'Knowledge synced successfully',
      preview: combinedText.substring(0, 500) + '...',
    });
  } catch (error: unknown) {
    logger.error('knowledge.sync.failed', { error });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
