import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  WA_ROOT,
  WA_MAIN_DOC,
  WA_RAW_MESSAGES,
  WA_CUSTOMER_THREADS,
  WA_STAFF_COMMANDS,
  WA_CONTACTS,
} from './constants';
import { classifyActor } from './contact-classifier';
import type { MetaInboundMessage, MetaWebhookPayload, MetaContact } from './types';

export async function processIncomingMessage(
  siteId: string,
  payload: MetaWebhookPayload
): Promise<void> {
  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      const messages = value.messages ?? [];
      const contacts = value.contacts ?? [];

      for (const msg of messages) {
        // 1. Store raw message FIRST — before any processing (antifragility)
        await storeRawMessage(siteId, payload, msg);

        // 2. Classify actor
        const metaContact = contacts.find(c => c.wa_id === msg.from);
        const classification = await classifyActor(siteId, msg.from);

        // 3. Route based on actor type
        if (classification.type === 'owner' || classification.type === 'staff') {
          await routeToStaffCommands(siteId, msg, metaContact, classification.type);
        } else {
          // customer or unknown — both go to customer inbox
          const contactId = await ensureContact(siteId, msg.from, metaContact, classification);
          await routeToCustomerThread(siteId, msg, metaContact, contactId);
        }
      }
    }
  }
}

async function storeRawMessage(
  siteId: string,
  payload: MetaWebhookPayload,
  msg: MetaInboundMessage
): Promise<void> {
  const ref = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_RAW_MESSAGES);
  await addDoc(ref, {
    waMessageId: msg.id,
    from: msg.from,
    type: msg.type,
    content: extractContent(msg),
    rawPayload: JSON.stringify(payload),
    receivedAt: serverTimestamp(),
  });
}

async function ensureContact(
  siteId: string,
  phone: string,
  metaContact: MetaContact | undefined,
  classification: { type: string; contactId?: string }
): Promise<string> {
  if (classification.contactId) return classification.contactId;

  // Create new contact for unknown number
  const ref = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CONTACTS);
  const newDoc = await addDoc(ref, {
    phone,
    name: metaContact?.profile?.name ?? phone,
    type: 'customer',
    firstSeenAt: serverTimestamp(),
  });
  return newDoc.id;
}

async function routeToCustomerThread(
  siteId: string,
  msg: MetaInboundMessage,
  metaContact: MetaContact | undefined,
  contactId: string
): Promise<void> {
  const content = extractContent(msg);
  const threadId = contactId; // 1 thread per contact
  const threadRef = doc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId);
  const threadSnap = await getDoc(threadRef);

  if (!threadSnap.exists()) {
    await setDoc(threadRef, {
      contactId,
      contactName: metaContact?.profile?.name ?? msg.from,
      contactPhone: msg.from,
      lastMessage: content,
      lastMessageAt: serverTimestamp(),
      status: 'open',
      unreadCount: 1,
    });
  } else {
    await updateDoc(threadRef, {
      lastMessage: content,
      lastMessageAt: serverTimestamp(),
      status: 'open',
      unreadCount: (threadSnap.data().unreadCount ?? 0) + 1,
    });
  }

  // Add message to thread subcollection
  const messagesRef = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_CUSTOMER_THREADS, threadId, 'messages');
  await addDoc(messagesRef, {
    direction: 'inbound',
    content,
    type: msg.type,
    sentAt: serverTimestamp(),
    sentBy: 'customer',
    waMessageId: msg.id,
  });
}

async function routeToStaffCommands(
  siteId: string,
  msg: MetaInboundMessage,
  metaContact: MetaContact | undefined,
  actorType: 'owner' | 'staff'
): Promise<void> {
  const content = extractContent(msg);
  const threadId = msg.from; // thread per staff/owner number
  const threadRef = doc(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_STAFF_COMMANDS, threadId);

  const threadSnap = await getDoc(threadRef);
  if (!threadSnap.exists()) {
    await setDoc(threadRef, {
      phone: msg.from,
      name: metaContact?.profile?.name ?? msg.from,
      actorType,
      createdAt: serverTimestamp(),
    });
  }

  const messagesRef = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_STAFF_COMMANDS, threadId, 'messages');
  await addDoc(messagesRef, {
    command: content,
    response: null, // filled by message-router after processing
    processedAt: null,
    actor: msg.from,
    receivedAt: serverTimestamp(),
    waMessageId: msg.id,
  });

  // Trigger command processing (async — non-blocking)
  routeOwnerCommand(siteId, msg.from, content, threadId).catch(err =>
    console.error('[WA] Owner command routing failed:', err)
  );
}

async function routeOwnerCommand(
  siteId: string,
  actorPhone: string,
  command: string,
  threadId: string
): Promise<void> {
  const { routeCommand } = await import('./message-router');
  await routeCommand(siteId, actorPhone, command, threadId);
}

function extractContent(msg: MetaInboundMessage): string {
  if (msg.type === 'text') return msg.text?.body ?? '';
  if (msg.type === 'image') return `[Image]${msg.image?.caption ? ': ' + msg.image.caption : ''}`;
  if (msg.type === 'document') return `[Document: ${msg.document?.filename ?? 'file'}]`;
  return `[${msg.type}]`;
}
