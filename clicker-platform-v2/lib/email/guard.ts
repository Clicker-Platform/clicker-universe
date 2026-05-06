import { getDevAllowlistSuffixes } from './config';

export function isAllowedInDev(to: string[]): boolean {
  if (process.env.NODE_ENV === 'production') return true;
  const suffixes = getDevAllowlistSuffixes();
  return to.every((addr) =>
    suffixes.some((suffix) => addr.toLowerCase().endsWith(suffix))
  );
}
