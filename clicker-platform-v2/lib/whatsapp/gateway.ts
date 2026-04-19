import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { META_MESSAGES_ENDPOINT, WA_ROOT, WA_MAIN_DOC, WA_CONFIG_DOC, WA_CUSTOMER_THREADS } from './constants';
import type { OutboundMessage, WAConfig, WAThread } from './types';

export interface MessagingGateway {
  send(message: OutboundMessage): Promise<void>;
  getThread(threadId: string): Promise<WAThread | null>;
  markRead(waMessageId: string): Promise<void>;
}

export async function getWAConfig(siteId: string): Promise<WAConfig | null> {
  if (!siteId || siteId === 'default' || siteId === 'pending') return null;
  const ref = doc(db, 'sites', siteId, WA_ROOT, WA_CONFIG_DOC);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as WAConfig;
}

export class WhatsAppGateway implements MessagingGateway {
  private siteId: string;
  private config: WAConfig;

  constructor(siteId: string, config: WAConfig) {
    this.siteId = siteId;
    this.config = config;
  }

  async send(message: OutboundMessage): Promise<void> {
    // SAFEGUARD: never auto-send to customer without explicit human trigger
    const isCustomerTarget = !this.isOwnerOrStaff(message.to);
    if (isCustomerTarget && !message.human_triggered) {
      throw new Error(
        'Cannot send to customer without human_triggered: true. ' +
        'This safeguard prevents accidental business data leaks to customers.'
      );
    }

    const url = META_MESSAGES_ENDPOINT(this.config.phoneNumberId);
    const body = buildMetaPayload(message);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Meta API error: ${res.status} ${JSON.stringify(err)}`);
    }
  }

  async getThread(threadId: string): Promise<WAThread | null> {
    const { doc: fsDoc, getDoc: fsGetDoc, collection } = await import('firebase/firestore');
    const ref = fsDoc(db, 'sites', this.siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
    const snap = await fsGetDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as WAThread;
  }

  async markRead(waMessageId: string): Promise<void> {
    const url = META_MESSAGES_ENDPOINT(this.config.phoneNumberId);
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: waMessageId,
      }),
    });
  }

  private isOwnerOrStaff(phone: string): boolean {
    const norm = phone.replace(/\D/g, '');
    const ownerNorm = (this.config.ownerPhone ?? '').replace(/\D/g, '');
    const staffNorms = (this.config.staffPhones ?? []).map(p => p.replace(/\D/g, ''));
    return norm === ownerNorm || staffNorms.includes(norm);
  }
}

function buildMetaPayload(message: OutboundMessage): object {
  const base = {
    messaging_product: 'whatsapp',
    to: message.to,
  };

  if (message.type === 'template') {
    return {
      ...base,
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: message.templateLanguage ?? 'id' },
        components: message.templateParams?.length
          ? [
              {
                type: 'body',
                parameters: message.templateParams.map(text => ({ type: 'text', text })),
              },
            ]
          : [],
      },
    };
  }

  return {
    ...base,
    type: 'text',
    text: { body: message.content ?? '' },
  };
}
