import { updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { WA_ROOT, WA_MAIN_DOC, WA_STAFF_COMMANDS } from './constants';
import { getWAConfig, WhatsAppGateway } from './gateway';
import { logger } from '@/lib/logger';

type CommandHandler = (siteId: string, rawCommand: string) => Promise<string>;

const COMMAND_MAP: { pattern: RegExp; handler: CommandHandler }[] = [
  { pattern: /laporan\s*(penjualan|sales|harian)?/i, handler: handleSalesReport },
  { pattern: /stok|stock|inventory|gudang/i, handler: handleStockQuery },
  { pattern: /booking|reservasi|jadwal|appointment/i, handler: handleBookingQuery },
  { pattern: /member|membership|poin|points|loyalty/i, handler: handleMemberQuery },
];

export async function routeCommand(
  siteId: string,
  actorPhone: string,
  command: string,
  threadId: string
): Promise<void> {
  let response = '';

  try {
    const matched = COMMAND_MAP.find(c => c.pattern.test(command));
    response = matched
      ? await matched.handler(siteId, command)
      : buildHelpMessage();
  } catch (err) {
    logger.error('wa.command.handler.failed', { siteId: siteId ?? 'platform', error: err });
    response = 'Maaf, terjadi kesalahan saat memproses perintah. Silakan coba lagi.';
  }

  await saveCommandResponse(siteId, threadId, command, response);

  const config = await getWAConfig(siteId);
  if (config?.status === 'connected') {
    const gateway = new WhatsAppGateway(siteId, config);
    await gateway.send({ to: actorPhone, type: 'text', content: response });
  }
}

async function saveCommandResponse(
  siteId: string,
  threadId: string,
  command: string,
  response: string
): Promise<void> {
  const { collection, query, where, orderBy, limit, getDocs } = await import('firebase/firestore');
  const ref = collection(db, 'sites', siteId, WA_ROOT, WA_MAIN_DOC, WA_STAFF_COMMANDS, threadId, 'messages');
  const q = query(ref, where('command', '==', command), where('response', '==', null), orderBy('receivedAt', 'desc'), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    await updateDoc(snap.docs[0].ref, { response, processedAt: serverTimestamp() });
  }
}

// ─── Command Handlers ────────────────────────────────────────────────────────

async function handleSalesReport(siteId: string, _cmd: string): Promise<string> {
  const { isModuleEnabled } = await import('@/lib/modules/registry');
  if (!(await isModuleEnabled('byod_pos'))) return '⚠️ Modul POS tidak aktif untuk bisnis ini.';

  const { getDailyReport, generateReportSummary } = await import('@/lib/modules/byod_pos/api-reports');
  const today = new Date();
  const result = await getDailyReport(siteId, today, 200);
  const orders = result.orders ?? result ?? [];

  if (!orders.length) return '📊 *Laporan Hari Ini*\n\nBelum ada transaksi hari ini.';

  const summary = generateReportSummary(orders);
  const paymentLines = Object.entries(summary.paymentBreakdown)
    .map(([method, amount]) => `  • ${capitalize(method)}: ${formatRp(amount)}`)
    .join('\n');

  return (
    `📊 *Laporan Penjualan Hari Ini*\n` +
    `${formatDate(today)}\n\n` +
    `💰 Total: *${formatRp(summary.totalSales)}*\n` +
    `🧾 Order: *${summary.totalOrders}* transaksi\n` +
    `📈 Rata-rata: ${formatRp(summary.averageOrderValue)}\n` +
    `❌ Dibatal: ${summary.cancelledOrders} order\n` +
    (paymentLines ? `\n💳 *Pembayaran:*\n${paymentLines}` : '')
  );
}

async function handleStockQuery(siteId: string, _cmd: string): Promise<string> {
  const { isModuleEnabled } = await import('@/lib/modules/registry');
  if (!(await isModuleEnabled('inventory'))) return '⚠️ Modul inventory tidak aktif untuk bisnis ini.';

  const { getInventory } = await import('@/lib/modules/inventory/api');
  const items = await getInventory(siteId);
  if (!items.length) return '📦 *Stok Inventory*\n\nBelum ada item inventory.';

  const lowStock = items
    .filter(i => i.currentStock <= i.lowStockThreshold)
    .sort((a, b) => a.currentStock - b.currentStock)
    .slice(0, 5);

  const topItems = items
    .sort((a, b) => b.currentStock - a.currentStock)
    .slice(0, 5);

  let msg = `📦 *Stok Inventory*\n${formatDate(new Date())}\n\nTotal item: *${items.length}*\n`;

  if (lowStock.length) {
    msg += `\n⚠️ *Stok Rendah (${lowStock.length} item):*\n`;
    msg += lowStock.map(i => `  • ${i.name}: *${i.currentStock} ${i.unit}* (min: ${i.lowStockThreshold})`).join('\n');
  } else {
    msg += '\n✅ Semua stok dalam kondisi aman.\n';
  }

  msg += `\n\n📋 *Stok Tertinggi:*\n`;
  msg += topItems.map(i => `  • ${i.name}: ${i.currentStock} ${i.unit}`).join('\n');

  return msg;
}

async function handleBookingQuery(siteId: string, _cmd: string): Promise<string> {
  const { isModuleEnabled } = await import('@/lib/modules/registry');
  if (!(await isModuleEnabled('reservation'))) return '⚠️ Modul reservasi tidak aktif untuk bisnis ini.';

  const { getBookingsForDay } = await import('@/lib/modules/reservation/api');
  const today = new Date();
  const bookings = await getBookingsForDay(siteId, today);

  if (!bookings.length) return `📅 *Jadwal Hari Ini*\n${formatDate(today)}\n\nTidak ada booking hari ini.`;

  const confirmed = bookings.filter((b: any) => b.status === 'confirmed' || b.status === 'new');
  const lines = confirmed.slice(0, 10).map((b: any) => {
    const time = b.date?.toDate?.()
      ? new Date(b.date.toDate()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : b.time ?? '-';
    return `  • ${time} — ${b.customerName ?? 'Tamu'} (${b.pax ?? 1} org)`;
  });

  return (
    `📅 *Jadwal Booking Hari Ini*\n` +
    `${formatDate(today)}\n\n` +
    `Total: *${bookings.length} booking* (${confirmed.length} aktif)\n\n` +
    lines.join('\n') +
    (confirmed.length > 10 ? `\n  ...dan ${confirmed.length - 10} lainnya` : '')
  );
}

async function handleMemberQuery(siteId: string, _cmd: string): Promise<string> {
  const { isModuleEnabled } = await import('@/lib/modules/registry');
  if (!(await isModuleEnabled('membership'))) return '⚠️ Modul membership tidak aktif untuk bisnis ini.';

  const { getPaginatedMembers, getMembershipSettings } = await import('@/lib/modules/membership/api');

  const [{ members }, settings] = await Promise.all([
    getPaginatedMembers(siteId, null, 200),
    getMembershipSettings(siteId),
  ]);

  if (!members.length) return '👤 *Data Member*\n\nBelum ada member terdaftar.';

  const active = members.filter((m: any) => m.status !== 'inactive' && m.status !== 'suspended');
  const tierCounts: Record<string, number> = {};
  members.forEach((m: any) => {
    const tier = m.tierName ?? m.tier ?? 'Regular';
    tierCounts[tier] = (tierCounts[tier] ?? 0) + 1;
  });

  const tierLines = Object.entries(tierCounts)
    .map(([tier, count]) => `  • ${tier}: ${count} member`)
    .join('\n');

  return (
    `👤 *Data Member*\n` +
    `${formatDate(new Date())}\n\n` +
    `Total: *${members.length} member* (${active.length} aktif)\n` +
    (tierLines ? `\n🏅 *Per Tier:*\n${tierLines}` : '') +
    (settings?.pointsName ? `\n\n💎 Poin: ${settings.pointsName}` : '')
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildHelpMessage(): string {
  return (
    '🤖 *Clicker Command Center*\n\n' +
    'Perintah yang tersedia:\n' +
    '• *laporan penjualan* — Laporan penjualan hari ini\n' +
    '• *stok* — Cek stok & item low-stock\n' +
    '• *booking* — Jadwal reservasi hari ini\n' +
    '• *member* — Ringkasan data member\n\n' +
    '_Ketik salah satu perintah di atas untuk memulai._'
  );
}

function formatRp(amount: number): string {
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
