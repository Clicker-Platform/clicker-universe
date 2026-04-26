import { GoogleGenerativeAI } from '@google/generative-ai';
import { adminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { ScanResult, ItemCondition, CategoryCode } from '../types';
import { STOCKLENS_CONFIG, CATEGORY_CODES } from '../constants';

async function getApiKey(siteId: string): Promise<string | null> {
  try {
    const snap = await adminDb.doc(`sites/${siteId}/${STOCKLENS_CONFIG}`).get();
    if (snap.exists) return snap.data()?.apiKey || null;
    return process.env.GEMINI_API_KEY || null;
  } catch (e) {
    logger.error('stocklens.apikey.fetch.failed', { siteId, error: e });
    return null;
  }
}

const SCAN_PROMPT = `You are a product identification expert. Analyze this product image and use Google Search to find accurate product details.

Return ONLY a JSON object with these exact fields:
{
  "name": "Full product name including series/variant",
  "brand": "Brand or manufacturer name",
  "category": "One of: ELC, TOY, SHO, CLO, GAM, SPT, HOM, BOO, ACC, GEN",
  "sku": "Suggested SKU in format CAT-BRAND3-MODEL (e.g. TOY-HSB-BHEAD)",
  "series": "Product series if applicable, otherwise omit",
  "releasePrice": 0,
  "marketPrice": 0,
  "suggestedCondition": "One of: BNIB, BNOB, SECOND, BROKEN based on visual",
  "aiAnalysis": "Short product description in Bahasa Indonesia, 1-2 sentences"
}

Rules:
- releasePrice and marketPrice must be numbers in IDR (Indonesian Rupiah), no symbols
- category must be exactly one of the listed codes
- suggestedCondition: BNIB if sealed/new looking, BNOB if box opened, SECOND if used, BROKEN if damaged
- sku brand code: use first 3 letters of brand (Apple→APL, Nike→NKE, Hasbro→HSB, Sony→SNY)
- If you cannot identify the product, use best guess with low confidence values`;

export async function scanProductImage(
  siteId: string,
  imageBase64: string,
  mimeType: string
): Promise<ScanResult> {
  const apiKey = await getApiKey(siteId);
  if (!apiKey) throw new Error('Gemini API Key belum dikonfigurasi. Silakan atur di Settings.');

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({
    model: 'gemini-2.0-flash',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} } as any],
  });

  const result = await model.generateContent([
    SCAN_PROMPT,
    { inlineData: { data: imageBase64, mimeType } },
  ]);

  const text = result.response.text();

  // Strip markdown code fences if present
  const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    logger.error('stocklens.scan.parse.failed', { siteId, raw: text });
    return {
      name: '',
      brand: '',
      category: 'GEN',
      sku: '',
      releasePrice: 0,
      marketPrice: 0,
      suggestedCondition: 'SECOND',
      aiAnalysis: 'Produk tidak dapat diidentifikasi. Silakan isi manual.',
    };
  }

  const rawCategory = parsed.category as string;
  const category: CategoryCode = (CATEGORY_CODES as readonly string[]).includes(rawCategory)
    ? (rawCategory as CategoryCode)
    : 'GEN';

  const conditions: ItemCondition[] = ['BNIB', 'BNOB', 'SECOND', 'BROKEN'];
  const rawCondition = parsed.suggestedCondition as string;
  const suggestedCondition: ItemCondition = (conditions as string[]).includes(rawCondition)
    ? (rawCondition as ItemCondition)
    : 'SECOND';

  return {
    name: (parsed.name as string) || '',
    brand: (parsed.brand as string) || '',
    category,
    sku: (parsed.sku as string) || '',
    series: parsed.series as string | undefined,
    releasePrice: Number(parsed.releasePrice) || 0,
    marketPrice: Number(parsed.marketPrice) || 0,
    suggestedCondition,
    aiAnalysis: (parsed.aiAnalysis as string) || '',
  };
}
