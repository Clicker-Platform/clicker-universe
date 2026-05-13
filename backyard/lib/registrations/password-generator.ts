const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGIT = '23456789';
const SYMBOL = '-_+=!@#$%&';
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

function pick(charset: string): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return charset[buf[0] % charset.length];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generatePassword(length = 8): string {
  if (length < 4) {
    throw new Error('Password length must be at least 4 to satisfy charset requirements');
  }
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL));
  return shuffle([...required, ...rest]).join('');
}
