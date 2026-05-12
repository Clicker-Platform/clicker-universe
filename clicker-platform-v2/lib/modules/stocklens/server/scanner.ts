import { invokeVision, getModel } from '@/lib/ai';
import type { ScanResult, ItemCondition, CategoryCode } from '../types';
import { CATEGORY_CODES } from '../constants';
import { logger } from '@/lib/logger';

const SCAN_PROMPT = `You are a product identification and pricing expert. Analyze this product image.

Return ONLY a valid JSON object with these exact fields (no markdown, no extra text):
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

Pricing rules (CRITICAL — never return 0):
- releasePrice = official retail price in IDR when this product first launched
- marketPrice = current estimated retail price in IDR for brand new stock
- If price is in USD, convert to IDR (1 USD ≈ 16000 IDR)
- Both must be realistic non-zero integers

Other rules:
- category must be exactly one of the listed codes
- suggestedCondition: BNIB if sealed/new, BNOB if box opened unused, SECOND if visibly used, BROKEN if damaged
- sku brand code: first 3 uppercase letters of brand (Apple→APL, Nike→NKE, Hasbro→HSB, Sony→SNY)
- If product cannot be identified, make your best guess — never leave prices as 0`;

export async function scanProductImage(
  siteId: string,
  imageBase64: string,
  mimeType: string
): Promise<ScanResult> {
  const model = await getModel('vision');

  const raw = await invokeVision(
    {
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: SCAN_PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      }],
      max_tokens: 512,
      temperature: 0.1,
    },
    { siteId, moduleId: 'stocklens', skillId: 'scan_product', uid: 'system' }
  );

  const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    logger.error('stocklens.scan.parse.failed', { siteId, raw });
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
