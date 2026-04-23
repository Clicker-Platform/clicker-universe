import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

function getKey(): Buffer {
  const secret = process.env.WA_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error('WA_ENCRYPTION_KEY or NEXTAUTH_SECRET must be set');
  return createHash('sha256').update(secret).digest();
}

export function encryptToken(token: string): string {
  const key = getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decryptToken(encrypted: string): string {
  const key = getKey();
  const [ivHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
