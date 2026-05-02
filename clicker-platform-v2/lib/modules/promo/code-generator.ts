import { VOUCHER_CODE_BLOCK_LENGTH } from './constants';

// Excludes ambiguous chars: 0/O/1/I/L
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBlock(len: number): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateVoucherCode(prefix: string): string {
  const cleanPrefix = (prefix || 'VCH').toUpperCase().slice(0, 5);
  const a = randomBlock(VOUCHER_CODE_BLOCK_LENGTH);
  const b = randomBlock(VOUCHER_CODE_BLOCK_LENGTH);
  return `${cleanPrefix}-${a}-${b}`;
}
