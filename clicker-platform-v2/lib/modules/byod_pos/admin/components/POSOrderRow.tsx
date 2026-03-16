import { POSOrder } from '@/lib/modules/byod_pos/types';
import { Clock, CheckCircle, XCircle, ChevronRight, ChevronDown } from 'lucide-react';

interface POSOrderRowProps {
    order: POSOrder;
    onClick?: (order: POSOrder) => void;
    expanded?: boolean;
}

export function POSOrderRow({ order, onClick, expanded }: POSOrderRowProps) {
    const totalFormatted = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total);
    const timeFormatted = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000).toLocaleString() : 'Just now';

    return (
        <div
            onClick={() => onClick?.(order)}
            className={`
                group flex items-center justify-between p-4 bg-white dark:bg-neutral-900 border-b border-gray-100 dark:border-neutral-800 last:border-b-0
                hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer animate-in fade-in slide-in-from-top-1 duration-300
            `}
        >
            <div className="flex items-center gap-4 min-w-0">
                <div className={`p-2 rounded-full ${order.status === 'completed' ? 'bg-green-100 dark:bg-green-950/30 text-green-600 dark:text-green-400' :
                    order.status === 'ready' ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' :
                        order.status === 'preparing' ? 'bg-blue-100 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400' :
                            (order.status === 'pending' || order.paymentStatus === 'pending_confirmation') ? 'bg-yellow-100 dark:bg-yellow-950/30 text-yellow-600 dark:text-yellow-400' :
                                'bg-red-100 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                    }`}>
                    {order.status === 'completed' ? <CheckCircle size={18} /> :
                        order.status === 'ready' ? <CheckCircle size={18} /> :
                            order.status === 'preparing' ? <Clock size={18} /> :
                                (order.status === 'pending' || order.paymentStatus === 'pending_confirmation') ? <Clock size={18} className="animate-pulse" /> :
                                    <XCircle size={18} />}
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-neutral-100">#{order.id.slice(-4).toUpperCase()}</span>
                        <span className="text-gray-400 dark:text-neutral-600 text-xs">•</span>
                        <span className="text-sm text-gray-600 dark:text-neutral-400 truncate">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-neutral-600 mt-0.5">
                        <Clock size={12} />
                        <span>{timeFormatted}</span>
                        {order.customerName && (
                            <>
                                <span>•</span>
                                <span>{order.customerName}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-6 pl-4">

                <span className="font-bold text-gray-900 dark:text-neutral-100">{totalFormatted}</span>
                {expanded ? (
                    <ChevronDown size={16} className="text-gray-500 dark:text-neutral-500 transition-transform" />
                ) : (
                    <ChevronRight size={16} className="text-gray-300 dark:text-neutral-700 group-hover:text-gray-500 dark:group-hover:text-neutral-500 transition-colors" />
                )}
            </div>
        </div>
    );
}
