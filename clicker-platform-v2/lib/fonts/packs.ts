import type { FontPack } from './types';

export const KNOWN_CSS_VARS = [
  '--font-inter',
  '--font-inter-tight',
  '--font-outfit',
  '--font-dm-sans',
  '--font-playfair',
  '--font-lora',
  '--font-fraunces',
  '--font-archivo',
  '--font-archivo-black',
  '--font-space-grotesk',
  '--font-dm-serif-display',
  '--font-quicksand',
  '--font-montserrat',
] as const;

export const FONT_PACKS: ReadonlyArray<FontPack> = Object.freeze([
  {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    category: 'sans',
    heading: { family: 'Inter', cssVar: '--font-inter', weights: [600, 700] },
    body: { family: 'Inter Tight', cssVar: '--font-inter-tight', weights: [400, 500] },
  },
  {
    id: 'modern-geometric',
    name: 'Modern Geometric',
    category: 'sans',
    heading: { family: 'Outfit', cssVar: '--font-outfit', weights: [600, 700] },
    body: { family: 'DM Sans', cssVar: '--font-dm-sans', weights: [400, 500] },
  },
  {
    id: 'editorial-serif',
    name: 'Editorial Serif',
    category: 'serif',
    heading: { family: 'Playfair Display', cssVar: '--font-playfair', weights: [600, 700] },
    body: { family: 'Lora', cssVar: '--font-lora', weights: [400, 500] },
  },
  {
    id: 'modern-magazine',
    name: 'Modern Magazine',
    category: 'mixed',
    heading: { family: 'Fraunces', cssVar: '--font-fraunces', weights: [600, 700] },
    body: { family: 'Inter', cssVar: '--font-inter', weights: [400, 500] },
  },
  {
    id: 'bold-display',
    name: 'Bold Display',
    category: 'display',
    heading: { family: 'Archivo Black', cssVar: '--font-archivo-black', weights: [400] },
    body: { family: 'Archivo', cssVar: '--font-archivo', weights: [400, 500] },
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    category: 'mixed',
    heading: { family: 'Space Grotesk', cssVar: '--font-space-grotesk', weights: [600, 700] },
    body: { family: 'Inter', cssVar: '--font-inter', weights: [400, 500] },
  },
  {
    id: 'warm-friendly',
    name: 'Warm Friendly',
    category: 'mixed',
    heading: { family: 'DM Serif Display', cssVar: '--font-dm-serif-display', weights: [400] },
    body: { family: 'DM Sans', cssVar: '--font-dm-sans', weights: [400, 500] },
  },
  {
    id: 'rounded-soft',
    name: 'Rounded Soft',
    category: 'sans',
    heading: { family: 'Quicksand', cssVar: '--font-quicksand', weights: [600, 700] },
    body: { family: 'Montserrat', cssVar: '--font-montserrat', weights: [400, 500] },
  },
]);

export const DEFAULT_PACK_ID = 'clean-minimal';

export function getPackById(id: string | null | undefined): FontPack | undefined {
  if (!id) return undefined;
  return FONT_PACKS.find(p => p.id === id);
}
