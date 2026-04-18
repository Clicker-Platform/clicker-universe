export interface WAConfig {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string; // encrypted at rest, decrypted server-side only
  webhookVerifyToken: string;
  ownerPhone: string;
  staffPhones?: string[];
  status: 'connected' | 'disconnected' | 'error';
  connectedAt?: Date;
}

export interface WAContact {
  id: string;
  phone: string;
  name: string;
  type: 'customer' | 'staff' | 'owner';
  linkedCrmId?: string;
  firstSeenAt: Date;
}

export interface WAMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  content: string;
  type: 'text' | 'image' | 'document' | 'template';
  sentAt: Date;
  sentBy: 'customer' | `staff:${string}` | 'agent';
  waMessageId?: string; // Meta's message ID
}

export interface WAThread {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: Date;
  status: 'open' | 'resolved';
  unreadCount?: number;
}

export interface WACommand {
  id: string;
  command: string;
  response: string;
  processedAt: Date;
  actor: string; // userId
}

export interface WATemplate {
  id: string;
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: WATemplateComponent[];
}

export interface WATemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  text?: string;
  parameters?: WATemplateParam[];
}

export interface WATemplateParam {
  type: 'text' | 'image' | 'document';
  text?: string;
}

export type WAActorType = 'owner' | 'staff' | 'customer' | 'unknown';

export interface OutboundMessage {
  to: string;
  type: 'text' | 'template';
  content?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: string[];
  human_triggered?: boolean; // REQUIRED true to send to a customer number
}

export interface MetaWebhookPayload {
  object: string;
  entry: MetaWebhookEntry[];
}

export interface MetaWebhookEntry {
  id: string;
  changes: MetaWebhookChange[];
}

export interface MetaWebhookChange {
  value: MetaWebhookValue;
  field: string;
}

export interface MetaWebhookValue {
  messaging_product: string;
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: MetaContact[];
  messages?: MetaInboundMessage[];
  statuses?: MetaMessageStatus[];
}

export interface MetaContact {
  profile: { name: string };
  wa_id: string;
}

export interface MetaInboundMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video' | 'sticker';
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; mime_type: string; filename?: string; caption?: string };
}

export interface MetaMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
}

export interface WAClassificationResult {
  type: WAActorType;
  contactId?: string;
  contactName?: string;
}
