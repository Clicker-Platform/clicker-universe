import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.development.local' });

function initializeAdmin() {
  if (getApps().length > 0) return getApps()[0];
  const serviceAccountKeyPath = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKeyPath && fs.existsSync(serviceAccountKeyPath)) {
    const credential = JSON.parse(fs.readFileSync(serviceAccountKeyPath, 'utf8'));
    return initializeApp({ credential: cert(credential) });
  }
  return initializeApp();
}

const catalog = [
  { id: 'byod_pos',        name: 'Self Order POS',  description: 'Cashier, KDS, transactions, menu, and reports.' },
  { id: 'inventory',       name: 'Inventory',        description: 'Stock management with audit trails.' },
  { id: 'reservation',     name: 'Reservation',      description: 'Booking and scheduling for services.' },
  { id: 'membership',      name: 'Membership',       description: 'Loyalty program and member profiles.' },
  { id: 'promo',           name: 'Promo Engine',     description: 'Discount codes, vouchers, and auto-apply rules.' },
  { id: 'service_records', name: 'Service Records',  description: 'Vehicle service history, warranty, and reminders.' },
  { id: 'sales_pipeline',  name: 'Sales Pipeline',   description: 'CRM Kanban board for leads and deals.' },
  { id: 'ai_sales',        name: 'AI Sales Agent',   description: 'Gemini-powered chatbot and lead capture.' },
  { id: 'ai_marketing',    name: 'AI Marketing',     description: 'AI-assisted marketing campaigns and content.' },
];

async function main() {
  const db = getFirestore(initializeAdmin());

  await db.doc('platformConfig/modules').set({
    catalog,
    updatedAt: FieldValue.serverTimestamp(),
  });

  console.log(`✓ Seeded platformConfig/modules dengan ${catalog.length} modul.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seeder failed:', err);
  process.exit(1);
});
