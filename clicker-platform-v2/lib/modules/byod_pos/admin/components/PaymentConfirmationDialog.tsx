import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { useState } from 'react';
import { CreditCard, Banknote, Scan, CheckCircle2 } from 'lucide-react';

interface PaymentConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: POSOrder['paymentMethod']) => void;
    order: POSOrder | null;
}

export function PaymentConfirmationDialog({ isOpen, onClose, onConfirm, order }: PaymentConfirmationDialogProps) {
    const [method, setMethod] = useState<POSOrder['paymentMethod']>('cash');

    if (!order) return null;

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onCancel={onClose}
            onConfirm={() => onConfirm(method)} // Not used if footer hidden, but good for type safety
            title="Confirm Payment"
            isDestructive={false}
            hideFooter={true} // Custom footer
            message="" // Custom content
        >
            <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-xl border border-gray-100 dark:border-neutral-800 text-center">
                    <div className="text-sm font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">Total Amount</div>
                    <div className="text-3xl font-black text-brand-dark">
                        {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(order.total)}
                    </div>
                    <div className="text-xs font-bold text-gray-400 dark:text-neutral-600 mt-2 uppercase">
                        {order.id === 'BILL-GROUP' ? 'Consolidated Bill Payment' : `Order #${order.id.slice(-4).toUpperCase()}`}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 dark:text-neutral-300 uppercase ms-1">Payment Method</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setMethod('cash')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === 'cash' ? 'border-brand-dark bg-brand-dark text-white shadow-lg scale-105' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-600 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <Banknote size={20} />
                            <span className="text-[10px] font-bold uppercase">Cash</span>
                        </button>
                        <button
                            onClick={() => setMethod('card')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === 'card' ? 'border-brand-dark bg-brand-dark text-white shadow-lg scale-105' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-600 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <CreditCard size={20} />
                            <span className="text-[10px] font-bold uppercase">Card</span>
                        </button>
                        <button
                            onClick={() => setMethod('qris')}
                            className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${method === 'qris' ? 'border-brand-dark bg-brand-dark text-white shadow-lg scale-105' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-600 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <Scan size={20} />
                            <span className="text-[10px] font-bold uppercase">QRIS</span>
                        </button>
                    </div>
                </div>

                {/* Custom Footer */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 rounded-xl font-bold text-gray-500 dark:text-neutral-500 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(method)}
                        className="flex-1 px-4 py-3 rounded-xl font-bold bg-brand-green text-brand-dark hover:bg-green-400 shadow-lg shadow-green-100 flex items-center justify-center gap-2 transition-colors active:scale-95"
                    >
                        Mark as Paid
                    </button>
                </div>
            </div>
        </ConfirmationDialog>
    );
}
