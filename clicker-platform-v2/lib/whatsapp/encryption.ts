import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { getSecret } from '@/lib/secrets';

async function getKey(): Promise<Buffer> {
  const secret = await getSecret('WA_ENCRYPTION_KEY');
  return createHash('sha256').update(secret).digest();
}

export async function encryptToken(token: string): Promise<string> {
  const key = await getKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-cbc', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function decryptToken(encrypted: string): Promise<string> {
  const key = await getKey();
  const [ivHex, dataHex] = encrypted.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = createDecipheriv('aes-256-cbc', key, iv);
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}
