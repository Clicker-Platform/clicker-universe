export function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) {
    h = h.split('').map(c => c + c).join('');
  }
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

export function pickContrastText(hex: string): '#000000' | '#ffffff' {
  const { r, g, b } = parseHex(hex);
  return relativeLuminance(r, g, b) > 0.179 ? '#000000' : '#ffffff';
}
