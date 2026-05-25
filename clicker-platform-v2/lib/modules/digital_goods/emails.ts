import 'server-only';
import { sendEmail, getTemplateAliases } from '@/lib/email';
import { adminDb } from '@/lib/firebase-admin';
import { EMAIL_ALIAS_KEYS } from './constants';

// Lookup tenant owner email — used to send "new order" notification.
async function getTenantOwnerEmail(siteId: string): Promise<string | null> {
  const siteSnap = await adminDb.doc(`sites/${siteId}`).get();
  if (!siteSnap.exists) return null;
  return (siteSnap.data()?.ownerEmail as string | undefined) ?? null;
}

export async function sendNewOrderTenantEmail(
  siteId: string,
  args: { orderId: string; buyerEmail: string; productTitle: string; amount: number },
): Promise<void> {
  const aliases = await getTemplateAliases();
  const tenantEmail = await getTenantOwnerEmail(siteId);
  if (!tenantEmail) return;
  await sendEmail({
    siteId,
    to: tenantEmail,
    templateAlias: aliases[EMAIL_ALIAS_KEYS.newOrderTenant] ?? EMAIL_ALIAS_KEYS.newOrderTenant,
    variables: {
      orderId: args.orderId,
      buyerEmail: args.buyerEmail,
      productTitle: args.productTitle,
      amount: args.amount.toLocaleString('id-ID'),
    },
    tags: [{ name: 'module', value: 'digital_goods' }, { name: 'event', value: 'new_order' }],
  });
}

export async function sendOrderPaidBuyerEmail(
  siteId: string,
  args: { buyerEmail: string; productTitle: string; libraryUrl: string },
): Promise<void> {
  const aliases = await getTemplateAliases();
  await sendEmail({
    siteId,
    to: args.buyerEmail,
    templateAlias: aliases[EMAIL_ALIAS_KEYS.orderPaidBuyer] ?? EMAIL_ALIAS_KEYS.orderPaidBuyer,
    variables: {
      productTitle: args.productTitle,
      libraryUrl: args.libraryUrl,
    },
    tags: [{ name: 'module', value: 'digital_goods' }, { name: 'event', value: 'order_paid' }],
  });
}
