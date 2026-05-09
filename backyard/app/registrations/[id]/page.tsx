'use client';

import { use, useEffect, useState } from 'react';
import { getRegistration, setStatus, countPriorByEmail } from '@/lib/registrations/api';
import type { RegistrationRequest } from '@/lib/registrations/types';
import { StatusBadge } from '@/components/registrations/StatusBadge';
import { ModulesList } from '@/components/registrations/ModulesList';
import { ActivateButton } from './ActivateButton';
import { RejectModal } from './RejectModal';
import { InternalNotes } from './InternalNotes';
import { PromoCard } from './PromoCard';
import { EventLogList } from '@/components/registrations/EventLogList';

const PLATFORM_BASE = process.env.NEXT_PUBLIC_PLATFORM_URL ?? 'http://localhost:3000';

export default function RegistrationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [reg, setReg] = useState<RegistrationRequest | null>(null);
  const [priorCount, setPriorCount] = useState(0);
  const [showReject, setShowReject] = useState(false);
  const [sendingCreds, setSendingCreds] = useState(false);

  useEffect(() => {
    getRegistration(id).then((r) => {
      setReg(r);
      if (r) countPriorByEmail(r.email, r.id).then(setPriorCount);
    });
  }, [id]);

  async function handleSendCredentials() {
    if (!reg) return;
    if (!confirm(`Kirim email kredensial ke ${reg.email}?`)) return;
    setSendingCreds(true);
    try {
      const res = await fetch(`/api/registrations/${reg.id}/send-credentials`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Gagal kirim');
      alert('✓ Email kredensial terkirim');
      setReg({ ...reg, credentialsSent: true, tempPassword: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Gagal: ${msg}`);
    } finally {
      setSendingCreds(false);
    }
  }

  if (!reg) return <main className="p-6">Loading…</main>;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{reg.businessName}</h1>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={reg.status} />
            <span className="text-sm text-gray-500">{reg.createdAt?.toDate?.().toLocaleString()}</span>
          </div>
          {priorCount > 0 && (
            <p className="mt-2 text-sm text-amber-700">⚠ {priorCount} prior request(s) from this email</p>
          )}
        </div>
        {reg.status !== 'activated' && reg.status !== 'rejected' && (
          <div className="flex gap-2">
            {reg.status === 'pending' && (
              <button onClick={() => setStatus(reg.id, 'contacted').then(() => setReg({ ...reg, status: 'contacted' }))} className="rounded border px-3 py-1">Mark contacted</button>
            )}
            <button onClick={() => setShowReject(true)} className="rounded border border-red-300 px-3 py-1 text-red-700">Reject</button>
            <ActivateButton id={reg.id} />
          </div>
        )}
      </header>

      <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Contact">
          <p>{reg.name}</p>
          <p><a href={`mailto:${reg.email}`} className="text-orange-600">{reg.email}</a></p>
          <p><a href={`tel:${reg.phone}`} className="text-orange-600">{reg.phone}</a></p>
        </Card>
        <Card title="Business">
          <p>Name: <span className="font-medium">{reg.businessName}</span></p>
          <p>Type: {reg.businessType}</p>
          <p>City: {reg.city}</p>
          <p>Expected outlets: {reg.expectedOutlets}</p>
        </Card>
        <Card title="Intent">
          {reg.bundle && <p>Bundle: <span className="font-medium">{reg.bundle}</span></p>}
          <ModulesList ids={reg.modules} />
          {reg.customRequest && (
            <div className="mt-3"><p className="font-medium">Custom request:</p><p className="whitespace-pre-wrap">{reg.customRequest}</p></div>
          )}
        </Card>
        <Card title="Promo"><PromoCard code={reg.promoCode} platformBaseUrl={PLATFORM_BASE} /></Card>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-medium">Internal notes</h2>
        <InternalNotes id={reg.id} initial={reg.internalNotes} />
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-lg font-medium">Event log <span className="text-xs text-gray-400 font-normal">(retensi 7 hari)</span></h2>
        <EventLogList registrationId={reg.id} />
      </section>

      {reg.activatedSiteId && (
        <p className="mt-6 text-sm text-green-700">✓ Activated as site <span className="font-mono">{reg.activatedSiteId}</span></p>
      )}
      {reg.status === 'activated' && reg.tempPassword && !reg.credentialsSent && (
        <div className="mt-4 rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-bold text-orange-900">Tenant aktif — kredensial siap dikirim</p>
          <p className="text-xs text-orange-700 mt-1">Login: <span className="font-mono">{reg.email}</span></p>
          <p className="text-xs text-orange-700">Password: <span className="font-mono font-bold">{reg.tempPassword}</span></p>
          <p className="text-xs text-orange-600 mt-2">Test login dulu di auth.clicker.id, lalu klik kirim.</p>
          <button
            onClick={handleSendCredentials}
            disabled={sendingCreds}
            className="mt-3 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-bold disabled:opacity-50"
          >
            {sendingCreds ? 'Mengirim...' : 'Kirim Kredensial via Email'}
          </button>
        </div>
      )}
      {reg.status === 'activated' && reg.credentialsSent && (
        <p className="mt-4 text-sm text-green-700">✓ Kredensial sudah dikirim ke {reg.email}</p>
      )}
      {reg.rejectionReason && (
        <p className="mt-6 text-sm text-gray-700">Rejection reason: {reg.rejectionReason}</p>
      )}

      {showReject && <RejectModal id={reg.id} onClose={() => setShowReject(false)} />}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-2 text-sm font-semibold uppercase text-gray-500">{title}</h3>
      <div className="text-sm">{children}</div>
    </div>
  );
}
