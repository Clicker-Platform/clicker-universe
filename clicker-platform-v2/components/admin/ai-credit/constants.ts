/**
 * Constants for the AI credit indicator system.
 *
 * AI_CONSUMER_MODULE_IDS: any tenant with ≥1 of these modules enabled will see
 * the credit indicator. When a new AI-consuming module is added (knowledge sync,
 * future modules), append its ID here.
 *
 * Thresholds are absolute-fallback values, used when no per-tenant baseline
 * (last topup or monthly grant) is recoverable. See spec §States.
 */

export const AI_CONSUMER_MODULE_IDS = [
  'ai_sales_agent',
  'stocklens',
  // 'knowledge_sync', // add when shipped
] as const;

// Percent thresholds (of recovered baseline) for color states.
export const PCT_WARN = 0.50;
export const PCT_CRITICAL = 0.10;

// Absolute-USD fallback thresholds, used when no baseline is available.
export const USD_WARN_FALLBACK = 5.0;    // 500 credits
export const USD_CRITICAL_FALLBACK = 1.0; // 100 credits
