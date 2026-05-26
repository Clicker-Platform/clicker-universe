'use client';

import { useState } from 'react';
import { X, Receipt, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import type { DigitalOrder } from '../../types';

interface Props {
  order: DigitalOrder;
  siteId: string;
  onClose: () => void;
  onUpdated: () => void;
}

export function OrderDetailForm({ order, siteId, onClose, onUpdated }: Props) {
  const [paymentRef, setPaymentRef] = useState(order.paymentRef ?? '');
  const [acting, setActing] = useState<null | 'confirm' | 'cancel'>(null);
  const [error, setError] = useState<string | null>(null);

  const isPending = order.status === 'awaiting_confirmation';

  async function callEndpoint(path: string, body: object) {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Not authenticated');
    const res = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
        'x-site-id': siteId,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'request_failed');
  }

  async function handleConfirm() {
    setActing('confirm'); setError(null);
    try {
      await callEndpoint('/api/digital-goods/orders/confirm', { orderId: order.id, paymentRef });
      onUpdated(); onClose();
    } catch (e: any) { setError(e?.message ?? 'Failed to confirm.'); }
    finally { setActing(null); }
  }

  async function handleCancel() {
    setActing('cancel'); setError(null);
    try {
      await callEndpoint('/api/digital-goods/orders/cancel', { orderId: order.id });
      onUpdated(); onClose();
    } catch (e: any) { setError(e?.message ?? 'Failed to cancel.'); }
    finally { setActing(null); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-end backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-neutral-900 h-full w-full max-w-lg shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Receipt size={18} className="text-gray-500 dark:text-neutral-400" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">Order #{order.id.slice(0, 8)}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-neutral-100" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Status</p>
            <p className="text-sm font-semibold mt-0.5">
              <span className={`px-2 py-1 rounded text-xs ${
                order.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                order.status === 'cancelled' ? 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400' :
                'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}>{order.status}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Product</p>
            <p className="text-sm font-medium text-gray-900 dark:text-neutral-100 mt-0.5">{order.productSnapshot.title}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Buyer</p>
            {order.buyerEmail ? (
              <>
                <p className="text-sm text-gray-900 dark:text-neutral-100 mt-0.5">{order.buyerEmail}</p>
                <p className="text-xs font-mono text-gray-400 dark:text-neutral-500 mt-0.5 truncate">{order.buyerId}</p>
              </>
            ) : (
              <p className="text-sm font-mono text-gray-700 dark:text-neutral-300 mt-0.5">{order.buyerId}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Amount</p>
            <p className="text-lg font-bold text-gray-900 dark:text-neutral-100 mt-0.5">Rp {order.amount.toLocaleString('id-ID')}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Bank</p>
            <p className="text-sm text-gray-700 dark:text-neutral-300 mt-0.5">{order.paymentInstructions.bankName} · {order.paymentInstructions.accountNumber}</p>
          </div>
          {order.buyerNote && (
            <div>
              <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider">Buyer note</p>
              <p className="text-sm text-gray-700 dark:text-neutral-300 mt-0.5 italic">&ldquo;{order.buyerNote}&rdquo;</p>
            </div>
          )}
          {isPending && (
            <div>
              <label className="block text-xs text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">
                Bank reference <span className="font-normal normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="e.g. BCA TRF20260524-001"
                className="w-full border border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        {/* Footer */}
        {isPending && (
          <div className="sticky bottom-0 px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={acting !== null}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {acting === 'confirm' && <Loader2 className="animate-spin w-4 h-4" />}
              Tandai Lunas
            </button>
            <button
              onClick={handleCancel}
              disabled={acting !== null}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-600 dark:border-red-800/40 dark:text-red-400 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
