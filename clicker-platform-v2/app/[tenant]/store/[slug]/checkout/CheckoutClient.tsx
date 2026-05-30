'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { publicRoutes } from '@/lib/modules/digital_goods/constants';

interface Props {
  tenant: string;
  siteId: string;
  productId: string;
  productTitle: string;
  amount: number;
  buyerEmail: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrisImageUrl?: string;
}

export function CheckoutClient(props: Props) {
  const router = useRouter();
  const routes = publicRoutes(props.tenant);
  const [buyerNote, setBuyerNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/digital-goods/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-site-id': props.siteId },
        body: JSON.stringify({ productId: props.productId, buyerNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'submit_failed');
      router.push(routes.orderStatus(data.orderId));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to submit order.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Order summary */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Order summary</h2>
        <div className="flex justify-between text-sm text-gray-700">
          <span>{props.productTitle}</span>
          <span className="font-medium">Rp {props.amount.toLocaleString('id-ID')}</span>
        </div>
        <div className="border-t border-gray-100 mt-4 pt-3 flex justify-between text-base">
          <span className="font-medium">Total</span>
          <span className="font-bold">Rp {props.amount.toLocaleString('id-ID')}</span>
        </div>
        <p className="text-xs text-gray-500 mt-3">Logged in as <strong>{props.buyerEmail}</strong></p>
      </section>

      {/* Payment instructions */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Cara bayar</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-xs text-gray-500">Bank</p>
            <p className="font-bold text-lg">{props.bankName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Nomor rekening</p>
            <p className="font-mono text-lg font-bold">{props.accountNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Atas nama</p>
            <p className="font-medium">{props.accountName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Jumlah</p>
            <p className="font-mono text-lg font-bold">Rp {props.amount.toLocaleString('id-ID')}</p>
          </div>
        </div>
        {props.qrisImageUrl && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Atau scan QRIS</p>
            <img
              src={props.qrisImageUrl}
              alt="QRIS"
              className="w-full max-w-[260px] mx-auto rounded-lg border border-gray-200"
            />
          </div>
        )}
      </section>

      {/* Confirm */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Konfirmasi pembayaran</h2>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Catatan transfer <span className="text-gray-400 font-normal">(opsional)</span>
        </label>
        <input
          type="text"
          value={buyerNote}
          onChange={e => setBuyerNote(e.target.value)}
          placeholder="Paste nomor referensi atau catatan lain"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full bg-green-600 text-white px-6 py-4 rounded-lg text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {submitting && <Loader2 className="animate-spin" size={18} />}
          Saya sudah transfer
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          Setelah Anda klik, kami akan minta penjual mengkonfirmasi pembayaran.
        </p>
      </section>
    </div>
  );
}
