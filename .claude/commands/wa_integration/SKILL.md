---
name: wa_integration
description: >
  Work with the Clicker Platform WhatsApp Cloud API integration — core infrastructure
  for messaging, inbox, owner commands, and module bridges. Use this skill when building
  the WA gateway, webhook processor, contact classifier, admin inbox UI, or wiring WA
  triggers into existing modules (POS, Reservation, CRM, Service Records).
  Trigger on: "whatsapp", "WA integration", "WA Core", "wa inbox", "webhook wa",
  "owner command", "contact classifier", "MessagingGateway", "wa_integration",
  or any request touching lib/whatsapp/ or components/admin/wa/.
---

> **Architecture Reference:** Always read [`clicker-platform-v2/Docs/WA_INTEGRATION_BRIEF.md`](../../../clicker-platform-v2/Docs/WA_INTEGRATION_BRIEF.md) and [`clicker-platform-v2/Docs/ARCHITECTURE.md`](../../../clicker-platform-v2/Docs/ARCHITECTURE.md) before making any changes.

# /wa_integration — Clicker Platform WhatsApp Integration Skill

You are helping build and maintain the WhatsApp Cloud API integration for the Clicker Platform.

WA is **core infrastructure** — not a module. It lives in `lib/whatsapp/` (not `lib/modules/`), is hardcoded in the admin sidebar like Canvas Studio, and cannot be toggled off once connected.

This skill is invoked as `/wa_integration [action]`

---

## Actions

| Action | Usage | Purpose |
|--------|-------|---------|
| `audit` | `/wa_integration audit` | Verify file structure, Firestore paths, and registration |
| `build-phase` | `/wa_integration build-phase {0\|1\|2\|3\|4\|5}` | Implement a specific roadmap phase |
| `integrate` | `/wa_integration integrate {moduleId}` | Wire WA triggers into an existing module |
| `debug` | `/wa_integration debug` | Diagnose webhook, classification, or send failures |
| `add-command` | `/wa_integration add-command` | Add a new owner command handler |

---

## Core Architecture

### WA is NOT a Module

| Dimension | Module (e.g. inventory) | WA Core |
|---|---|---|
| Location | `lib/modules/{name}/` | `lib/whatsapp/` |
| Toggle | Per-tenant opt-in | Always-on if connected |
| Firestore root | `sites/{siteId}/modules/{name}/` | `sites/{siteId}/wa/` |
| Sidebar | `STATIC_MODULE_DEFINITIONS` | Hardcoded in `allCoreItems[]` |
| Registration | `lib/modules/definitions.ts` | Not registered as module |

### 3 Operation Modes

**Mode 1 — Manual:** Message → Customer Inbox → Staff reads & replies from dashboard
**Mode 2 — Semi-Auto:** Message → Rule engine → Auto-route to module + optional template reply
**Mode 3 — Full Auto:** Message → AI Sales Agent → Generate + send response (with supervisor mode)

---

## File Structure

```
clicker-platform-v2/
│
├── lib/whatsapp/                              ← CORE (not lib/modules/)
│   ├── types.ts                         ← WAMessage, WAThread, WAConfig, WAContact, WACommand
│   ├── constants.ts                     ← Firestore paths, Meta API endpoints
│   ├── gateway.ts                       ← WhatsAppGateway implements MessagingGateway
│   ├── webhook-processor.ts             ← Parse & route incoming messages
│   ├── contact-classifier.ts            ← Actor classification: customer/owner/staff/unknown
│   ├── message-router.ts                ← Rule engine: intent → module action
│   └── agent-bridge.ts                  ← Connect to AI Sales Agent module (Phase 4)
│
├── app/api/webhooks/wa/
│   └── route.ts                         ← GET: verify Meta webhook challenge
│                                        ← POST: receive & process incoming messages
│
└── components/admin/wa/
    ├── WAInbox.tsx                      ← List all customer threads
    ├── WAConversation.tsx               ← Read + reply per thread
    ├── WASetupWizard.tsx                ← Self-service connect WA account
    └── WASettings.tsx                   ← Manage credentials + usage monitoring
```

---

## Firestore Schema

```
sites/{siteId}/wa/
│
├── config                               ← WA connection config
│   ├── phoneNumberId: string
│   ├── wabaId: string
│   ├── accessToken: string              ← ENCRYPTED — decrypt server-side only
│   ├── webhookVerifyToken: string
│   ├── status: "connected" | "disconnected" | "error"
│   └── connectedAt: timestamp
│
├── customer_threads/{threadId}/
│   ├── contactId: string
│   ├── contactName: string
│   ├── contactPhone: string
│   ├── lastMessage: string
│   ├── lastMessageAt: timestamp
│   ├── status: "open" | "resolved"
│   └── messages/{msgId}
│       ├── direction: "inbound" | "outbound"
│       ├── content: string
│       ├── type: "text" | "image" | "document" | "template"
│       ├── sentAt: timestamp
│       └── sentBy: "customer" | "staff:{userId}" | "agent"
│
├── staff_commands/{threadId}/
│   └── messages/{msgId}
│       ├── command: string
│       ├── response: string
│       ├── processedAt: timestamp
│       └── actor: string (userId)
│
├── contacts/{contactId}
│   ├── phone: string
│   ├── name: string
│   ├── type: "customer" | "staff" | "owner"
│   ├── linkedCrmId?: string
│   └── firstSeenAt: timestamp
│
└── templates/{templateId}
    ├── name: string
    ├── language: string
    ├── category: "MARKETING" | "UTILITY" | "AUTHENTICATION"
    └── components: array
```

---

## Action: `audit`

Read the following files and check each point. Report pass/fail with exact file path.

**Checklist:**

1. `lib/whatsapp/` exists with: `types.ts`, `constants.ts`, `gateway.ts`, `webhook-processor.ts`, `contact-classifier.ts`, `message-router.ts`

2. `app/api/webhooks/wa/route.ts` exists with:
   - `GET` handler: verify `hub.mode === 'subscribe'` + `hub.verify_token` matches config → return `hub.challenge`
   - `POST` handler: verify `X-Hub-Signature-256` header → call `processIncomingMessage()`

3. `components/admin/wa/WAInbox.tsx` exists with `'use client'` directive

4. `lib/whatsapp/constants.ts` exports:
   - `WA_CONFIG_PATH = 'wa/config'`
   - `WA_CUSTOMER_THREADS_PATH = 'wa/customer_threads'`
   - `WA_STAFF_COMMANDS_PATH = 'wa/staff_commands'`
   - `WA_CONTACTS_PATH = 'wa/contacts'`

5. `WASetupWizard.tsx` does NOT write `accessToken` directly to Firestore client-side — must go via server action or Cloud Function for encryption

6. No `firebase-admin` imports in `lib/whatsapp/gateway.ts` (client SDK only for reads; sends go via Meta REST API)

7. `lib/whatsapp/contact-classifier.ts` classifies ALL three actor types before any processing:
   - `owner/staff` → staff_commands channel
   - known contact → customer_threads
   - unknown → new contact → customer_threads

8. Outbound routing in `gateway.ts` has safeguard: `customer_wa` type requires explicit `human_triggered: true` flag — never auto-send to customer without it

9. WA link in admin sidebar is in `allCoreItems[]`, NOT in module sidebar entries

10. `accessToken` is encrypted in Firestore — never stored in plaintext

---

## Action: `build-phase`

### Phase 0 — Foundation (no UI)

Build in this order:

**1. `lib/whatsapp/types.ts`**
```typescript
export interface WAConfig {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string; // encrypted at rest
  webhookVerifyToken: string;
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
}

export interface WAThread {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  lastMessageAt: Date;
  status: 'open' | 'resolved';
}

export interface WACommand {
  id: string;
  command: string;
  response: string;
  processedAt: Date;
  actor: string;
}

export type WAActorType = 'owner' | 'staff' | 'customer' | 'unknown';

export interface OutboundMessage {
  to: string;
  type: 'text' | 'template';
  content: string;
  templateName?: string;
  templateParams?: string[];
  human_triggered?: boolean; // REQUIRED true to send to customer
}
```

**2. `lib/whatsapp/constants.ts`**
```typescript
export const WA_CONFIG_PATH = 'wa/config';
export const WA_CUSTOMER_THREADS_PATH = 'wa/customer_threads';
export const WA_STAFF_COMMANDS_PATH = 'wa/staff_commands';
export const WA_CONTACTS_PATH = 'wa/contacts';
export const WA_TEMPLATES_PATH = 'wa/templates';

export const META_API_BASE = 'https://graph.facebook.com/v19.0';
```

**3. `lib/whatsapp/contact-classifier.ts`**
```typescript
// Classify actor type from incoming phone number
// Priority: owner/staff list → known contacts → unknown
export async function classifyActor(
  siteId: string,
  phone: string
): Promise<{ type: WAActorType; contactId?: string }> { ... }
```

**4. `lib/whatsapp/gateway.ts`** — `WhatsAppGateway implements MessagingGateway`
```typescript
interface MessagingGateway {
  send(to: string, message: OutboundMessage): Promise<void>;
  getThread(threadId: string): Promise<WAThread>;
  markRead(messageId: string): Promise<void>;
}

// SAFEGUARD: always enforce in send()
if (message.to_type === 'customer' && !message.human_triggered) {
  throw new Error('Cannot send to customer without explicit human trigger');
}
```

**5. `lib/whatsapp/webhook-processor.ts`** — parse Meta payload → classify → route
```typescript
export async function processIncomingMessage(
  siteId: string,
  payload: MetaWebhookPayload
): Promise<void> {
  // 1. Store raw message FIRST (before any processing)
  // 2. Classify actor
  // 3. Route to customer_threads or staff_commands
}
```

**6. `app/api/webhooks/wa/route.ts`**
```typescript
// GET: Meta webhook verification
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');
  // verify token matches config → return challenge
}

// POST: incoming messages
export async function POST(req: Request) {
  // 1. Verify X-Hub-Signature-256 (HMAC SHA256 of raw body)
  // 2. Parse body
  // 3. Identify siteId from phoneNumberId lookup
  // 4. Call processIncomingMessage(siteId, payload)
  return Response.json({ ok: true }); // Always return 200 to Meta
}
```

---

### Phase 1 — Core Inbox (MVP)

Build admin UI components in `components/admin/wa/`:

- `WASetupWizard.tsx` — 5-step wizard: Meta credentials input → webhook URL display → connection test → save
- `WAInbox.tsx` — real-time list of customer threads via `onSnapshot`
- `WAConversation.tsx` — message thread view + reply input
- `WASettings.tsx` — show credentials (masked), status, usage stats, disconnect button

Register WA in admin sidebar `allCoreItems[]`:
```typescript
{
  key: 'wa',
  label: 'WhatsApp',
  icon: MessageCircle,
  href: '/admin/wa',
}
```

---

### Phase 2 — Owner Command Mode ✅ IMPLEMENTED

**Status:** Live in `lib/whatsapp/message-router.ts`

**COMMAND_MAP** uses regex patterns — owner sends text to WA business number, Clicker replies:

| Keyword Pattern | Handler | Module API |
|---|---|---|
| `laporan penjualan / laporan harian` | `handleSalesReport` | `byod_pos/api-reports.ts → getDailyReport + generateReportSummary` |
| `stok / stock / inventory / gudang` | `handleStockQuery` | `inventory/api.ts → getInventory` — shows low-stock + top items |
| `booking / reservasi / jadwal` | `handleBookingQuery` | `reservation/api.ts → getBookingsForDay` — today's schedule |
| `member / poin / loyalty` | `handleMemberQuery` | `membership/api.ts → getPaginatedMembers + getMembershipSettings` |

**To add a new command:**
1. Add entry to `COMMAND_MAP` array in `message-router.ts`
2. Create `async function handle{Name}(siteId, rawCmd): Promise<string>` — return WA-formatted string
3. Always guard with `isModuleEnabled('{module}')` before dynamic import
4. Use `*bold*` and `_italic_` for WA markdown formatting in response strings

**Response format helpers** (in `message-router.ts`):
```typescript
formatRp(amount)   // → "Rp 1.500.000"
formatDate(date)   // → "Senin, 18 April 2026"
capitalize(str)    // → "Cash"
```

**Env var required:** `WA_ENCRYPTION_KEY` in `.env.local` — used for AES-256 token encryption/decryption in `/api/admin/whatsapp/connect` and `/send`.

---

### Phase 3 — Module Integration

Each module integration follows this pattern in `lib/whatsapp/message-router.ts`:

```typescript
// Detect intent → emit to module without direct import
async function routeIntent(siteId: string, message: string, contactId: string) {
  const intent = detectIntent(message); // 'reservation' | 'order' | 'complaint' | 'membership'

  if (intent === 'reservation') {
    const { createDraftBooking } = await import('@/lib/modules/reservation/api');
    // ...
  }
}
```

**Module integration map:**

| WA Message Intent | Module | Action |
|---|---|---|
| "mau booking / pesan / jadwal" | reservation | Create draft booking |
| "mau order / beli" | byod_pos | Create draft order |
| "komplain / rusak / servis" | service_records | Create service record |
| "member / poin / loyalty" | membership | Check member status |
| "chat baru dari nomor unknown" | core_crm | Create CRM contact |

---

### Phase 4 — AI Agent Bridge

```typescript
// lib/whatsapp/agent-bridge.ts
export async function processWithAgent(
  siteId: string,
  thread: WAThread,
  message: WAMessage
): Promise<{ draft: string; confidence: number }> {
  const agentEnabled = await isModuleEnabled('ai_sales_agent');
  if (!agentEnabled) return { draft: '', confidence: 0 };

  const { generateResponse } = await import('@/lib/modules/ai_sales_agent/api');
  return generateResponse(siteId, thread, message);
}
```

Supervisor mode: draft saved to thread, staff approves before send.

---

### Phase 5 — Broadcast & Templates

- Template management UI in `WASettings.tsx`
- Broadcast composer with contact segment targeting
- Campaign analytics stored in `sites/{siteId}/wa/campaigns/`

---

## Action: `integrate`

To wire WA notifications into module `{moduleId}`:

### Step 1 — Guard

```typescript
// Check WA is connected before sending
const { getWAConfig } = await import('@/lib/whatsapp/gateway');
const config = await getWAConfig(siteId);
if (config?.status !== 'connected') return;
```

### Step 2 — Send Notification (owner/staff only by default)

```typescript
const { WhatsAppGateway } = await import('@/lib/whatsapp/gateway');
const gateway = new WhatsAppGateway(siteId);

// Notify owner — always safe
await gateway.send(config.ownerPhone, {
  to: config.ownerPhone,
  type: 'text',
  content: `New ${moduleId} event: ${summary}`,
});
```

### Step 3 — Send to Customer (requires explicit trigger)

```typescript
// ONLY when staff explicitly clicks "Notify Customer" button
await gateway.send(customerPhone, {
  to: customerPhone,
  type: 'template',
  templateName: 'booking_confirmation',
  templateParams: [customerName, bookingTime],
  human_triggered: true, // REQUIRED — never omit
});
```

### NEVER do this from a module

```typescript
// ❌ WRONG — auto-sending to customer without human trigger
await gateway.send(customerPhone, { content: reportData });

// ❌ WRONG — sending business data to customer
await gateway.send(customerPhone, { content: salesReport });
```

---

## Action: `add-command`

To add a new owner command (Phase 2+):

1. Add intent keyword to `OWNER_COMMANDS` map in `message-router.ts`
2. Create handler function:
```typescript
async function handle{CommandName}(
  siteId: string,
  params: string[]
): Promise<string> {
  // Query the relevant module API
  // Format response as plain text for WA
  // Return string (will be sent back to owner via WA)
}
```
3. Add to command history log: `sites/{siteId}/wa/staff_commands/{ownerId}/messages/`
4. Test: owner sends "keyword" to WA business number → verify correct response received

---

## Action: `debug`

Ask user which symptom they're seeing.

---

### Symptom: Webhook not receiving messages

1. Check Meta webhook registration — URL must be publicly accessible (not localhost)
2. Verify `GET /api/webhooks/wa` returns `hub.challenge` correctly — Meta tests this on registration
3. Check `webhookVerifyToken` in Firestore matches what was set in Meta Developer Console
4. Inspect `X-Hub-Signature-256` verification in POST handler — if wrong secret, requests silently fail

### Symptom: Messages going to wrong inbox (customer → staff_commands or vice versa)

1. Check `sites/{siteId}/wa/contacts/` — verify phone number has correct `type` field
2. `classifyActor()` in `contact-classifier.ts` reads contacts collection — stale data causes misclassification
3. New unknown numbers default to `customer` type and `customer_threads` — this is correct behavior

### Symptom: Cannot send message to customer

1. `human_triggered: true` must be set on the `OutboundMessage` — check the call site
2. Check `gateway.send()` safeguard — it throws if customer target without `human_triggered`
3. Verify `accessToken` is valid — test with Meta Graph API Explorer

### Symptom: Access token expired

System User tokens from Meta do NOT expire if created correctly. Check:
1. Was a **System User** token used (not a personal user token)?
2. Token has `whatsapp_business_messaging` permission
3. Check token validity: `GET https://graph.facebook.com/debug_token?input_token={token}`

### Symptom: Messages stored but not appearing in inbox

1. Firestore real-time listener in `WAInbox.tsx` uses `onSnapshot` — check browser console for Firestore permission errors
2. Verify Firestore security rules allow authenticated admin reads on `sites/{siteId}/wa/customer_threads/`
3. Check `status` field on thread — inbox may filter by `status: 'open'` only

---

## Security Rules (Critical)

```
// NEVER violate these:
1. accessToken MUST be encrypted in Firestore — never plaintext
2. accessToken MUST only be decrypted server-side (Cloud Function or Server Action)
3. customer WA sends MUST require human_triggered: true
4. Business reports/data MUST NEVER be auto-sent to customer numbers
5. Webhook POST MUST verify X-Hub-Signature-256 before processing
6. Raw message MUST be stored in Firestore BEFORE processing (for audit + antifragility)
```

---

## Critical File Paths

```
WA CORE (clicker-platform-v2/lib/whatsapp/):
  types.ts                    ← WAMessage, WAThread, WAConfig, WAContact, OutboundMessage
  constants.ts                ← WA_CONFIG_PATH, WA_CUSTOMER_THREADS_PATH, META_API_BASE
  gateway.ts                  ← WhatsAppGateway implements MessagingGateway, send safeguard
  webhook-processor.ts        ← processIncomingMessage(), raw message storage
  contact-classifier.ts       ← classifyActor() → owner/staff/customer/unknown
  message-router.ts           ← intent detection → module bridge
  agent-bridge.ts             ← Phase 4: AI Sales Agent integration

WEBHOOK API (clicker-platform-v2/app/api/webhooks/wa/):
  route.ts                    ← GET: Meta challenge verify | POST: incoming messages

ADMIN UI (clicker-platform-v2/components/admin/wa/):
  WAInbox.tsx                 ← 'use client', real-time thread list via onSnapshot
  WAConversation.tsx          ← 'use client', thread view + reply
  WASetupWizard.tsx           ← 'use client', 5-step self-service setup
  WASettings.tsx              ← 'use client', credentials + usage + disconnect

DOCS:
  clicker-platform-v2/Docs/WA_INTEGRATION_BRIEF.md  ← Full brief, roadmap, business rationale
```

---

## Architecture Rules (never violate)

- WA lives in `lib/whatsapp/`, NOT `lib/modules/` — it is core infrastructure, not an opt-in module
- `accessToken` MUST be encrypted at rest and decrypted server-side only
- Raw messages MUST be stored to Firestore BEFORE any processing — Meta is not source of truth, Clicker is
- `human_triggered: true` is REQUIRED on every outbound message to a customer number
- Business data (reports, financials, orders) MUST NEVER be sent to customer numbers automatically
- `MessagingGateway` interface MUST be implemented — never call Meta API directly from components
- Modules bridge to WA via dynamic import from `message-router.ts` — modules never import `lib/whatsapp/` directly
- Webhook POST handler MUST always return HTTP 200 to Meta (even on errors) — Meta retries on non-200
- Signature verification (HMAC SHA256) MUST happen before any payload processing
- `classifyActor()` MUST run before routing — never assume actor type from context
- Owner command responses go back ONLY to the owner's number — never broadcast to customers
- All WA admin UI components MUST have `'use client'` directive
- `siteId` MUST come from `useSite()` — never hardcode
- RBAC: check `canEdit()` before every write (reply, settings update, send)
