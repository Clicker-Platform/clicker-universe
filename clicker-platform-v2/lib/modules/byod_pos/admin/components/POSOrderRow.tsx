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
                group flex items-center justify-between p-4 bg-white border-b border-gray-100 last:border-b-0 
                hover:bg-gray-50 transition-colors cursor-pointer animate-in fade-in slide-in-from-top-1 duration-300
            `}
        >
            <div className="flex items-center gap-4 min-w-0">
                <div className={`p-2 rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-600' :
                    order.status === 'ready' ? 'bg-emerald-100 text-emerald-600' :
                        order.status === 'preparing' ? 'bg-blue-100 text-blue-600' :
                            (order.status === 'pending' || order.paymentStatus === 'pending_confirmation') ? 'bg-yellow-100 text-yellow-600' :
                                'bg-red-100 text-red-600'
                    }`}>
                    {order.status === 'completed' ? <CheckCircle size={18} /> :
                        order.status === 'ready' ? <CheckCircle size={18} /> :
                            order.status === 'preparing' ? <Clock size={18} /> :
                                (order.status === 'pending' || order.paymentStatus === 'pending_confirmation') ? <Clock size={18} className="animate-pulse" /> :
                                    <XCircle size={18} />}
                </div>

                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">#{order.id.slice(-4).toUpperCase()}</span>
                        <span className="text-gray-400 text-xs">•</span>
                        <span className="text-sm text-gray-600 truncate">{order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
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

                <span className="font-bold text-gray-900">{totalFormatted}</span>
                {expanded ? (
                    <ChevronDown size={16} className="text-gray-500 transition-transform" />
                ) : (
                    <ChevronRight size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                )}
            </div>
        </div>
    );
}
