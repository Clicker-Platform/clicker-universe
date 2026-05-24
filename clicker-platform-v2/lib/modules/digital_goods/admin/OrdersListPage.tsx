'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt, Pencil } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger-edge';
import { listOrders } from '../orders';
import type { DigitalOrder, OrderStatus } from '../types';
import { OrderDetailForm } from './components/OrderDetailForm';

const FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'awaiting_confirmation', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
];

export default function OrdersListPage() {
  const { siteId } = useSite();
  const [orders, setOrders] = useState<DigitalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [editingOrder, setEditingOrder] = useState<DigitalOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!siteId) return;
    try {
      setLoading(true);
      const items = await listOrders(siteId);
      setOrders(items);
    } catch (e) {
      logger.error('digital_goods.orders.load.failed', { siteId, error: e });
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

  useEffect(() => { load(); }, [load]);

  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const pendingCount = orders.filter(o => o.status === 'awaiting_confirmation').length;

  if (!siteId) return null;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-neutral-100">Orders</h1>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">Confirm bank transfers and manage buyer purchases.</p>
      </header>

      {pendingCount > 0 && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg text-sm flex items-center justify-between">
          <span className="text-amber-900 dark:text-amber-200">
            <strong>{pendingCount}</strong> order{pendingCount === 1 ? '' : 's'} awaiting confirmation
          </span>
          <button onClick={() => setFilter('awaiting_confirmation')} className="text-amber-900 dark:text-amber-200 underline text-xs">
            Filter pending →
          </button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filter === f.key
                ? 'bg-white dark:bg-neutral-700 shadow text-gray-900 dark:text-neutral-100'
                : 'text-gray-600 dark:text-neutral-400 hover:bg-white/60 dark:hover:bg-neutral-700/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded text-red-700 dark:text-red-400 text-sm">{error}</div>}

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-2">
            {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 dark:bg-neutral-800 rounded animate-pulse" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="mx-auto text-gray-300 dark:text-neutral-600 mb-3" size={32} />
            <p className="text-sm text-gray-500 dark:text-neutral-400">No orders {filter === 'all' ? 'yet' : `with status ${filter}`}.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-neutral-800 text-left text-xs uppercase tracking-wider text-gray-500 dark:text-neutral-400">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map(o => (
                <tr key={o.id} className="border-t border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-neutral-400">#{o.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-neutral-300">{o.productSnapshot.title}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-neutral-100">Rp {o.amount.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded ${
                      o.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                      o.status === 'cancelled' ? 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400' :
                      'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
                    }`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingOrder(o)}
                      className="p-2 text-gray-600 dark:text-neutral-400 hover:text-studio-blue dark:hover:text-studio-blue"
                      aria-label="View order"
                    >
                      <Pencil size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editingOrder && (
        <OrderDetailForm
          order={editingOrder}
          siteId={siteId}
          onClose={() => setEditingOrder(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
