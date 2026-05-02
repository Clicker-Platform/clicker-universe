import { ConfirmationDialog } from '@/components/common/ConfirmationDialog';
import { POSOrder } from '@/lib/modules/byod_pos/types';
import { useState } from 'react';
import { CreditCard, Banknote, Scan } from 'lucide-react';
import { PromoApplicator } from '@/lib/modules/promo/components/PromoApplicator';
import type { AppliedPromo } from '@/lib/modules/promo/api';

interface PaymentConfirmationDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (method: POSOrder['paymentMethod'], appliedPromo: AppliedPromo | null) => void;
    order: POSOrder | null;
    siteId: string;
    memberId?: string;
    isProcessing?: boolean;
}

export function PaymentConfirmationDialog({ isOpen, onClose, onConfirm, order, siteId, memberId, isProcessing = false }: PaymentConfirmationDialogProps) {
    const [method, setMethod] = useState<POSOrder['paymentMethod']>('cash');
    const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

    if (!order) return null;

    const subtotal = order.total;
    const discount = appliedPromo?.discount ?? 0;
    const finalTotal = Math.max(0, subtotal - discount);

    const handleClose = () => {
        setAppliedPromo(null);
        onClose();
    };

    const handleConfirm = () => {
        onConfirm(method, appliedPromo);
    };

    return (
        <ConfirmationDialog
            isOpen={isOpen}
            onCancel={handleClose}
            onConfirm={handleConfirm}
            title="Confirm Payment"
            isDestructive={false}
            hideFooter={true} // Custom footer
            message="" // Custom content
        >
            <div className="space-y-6">
                <div className="bg-gray-50 dark:bg-neutral-800/50 p-4 rounded-lg border border-gray-100 dark:border-neutral-800 text-center">
                    <div className="text-sm font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-wider mb-1">Total Amount</div>
                    {appliedPromo ? (
                        <div className="space-y-1">
                            <div className="text-base text-gray-400 dark:text-neutral-500 line-through">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(subtotal)}
                            </div>
                            <div className="text-sm text-green-600 dark:text-green-400 font-semibold">
                                &minus;{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(discount)}
                            </div>
                            <div className="text-3xl font-black text-brand-dark dark:text-neutral-100">
                                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(finalTotal)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-3xl font-black text-brand-dark dark:text-neutral-100">
                            {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(subtotal)}
                        </div>
                    )}
                    <div className="text-xs font-bold text-gray-400 dark:text-neutral-600 mt-2 uppercase">
                        {order.id === 'BILL-GROUP' ? 'Consolidated Bill Payment' : `Order #${order.id.slice(-4).toUpperCase()}`}
                    </div>
                </div>

                {/* Promo Applicator */}
                <PromoApplicator
                    siteId={siteId}
                    subtotal={subtotal}
                    source="POS"
                    memberId={memberId}
                    applied={appliedPromo}
                    onApply={setAppliedPromo}
                    onRemove={() => setAppliedPromo(null)}
                    disabled={isProcessing}
                    autoCheck={true}
                />

                <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-700 dark:text-neutral-300 uppercase ms-1">Payment Method</label>
                    <div className="grid grid-cols-3 gap-3">
                        <button
                            onClick={() => setMethod('cash')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${method === 'cash' ? 'border-brand-dark dark:border-studio-blue bg-studio-blue text-white shadow-lg scale-105' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-600 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <Banknote size={20} />
                            <span className="text-[10px] font-bold uppercase">Cash</span>
                        </button>
                        <button
                            onClick={() => setMethod('card')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${method === 'card' ? 'border-brand-dark dark:border-studio-blue bg-studio-blue text-white shadow-lg scale-105' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-600 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <CreditCard size={20} />
                            <span className="text-[10px] font-bold uppercase">Card</span>
                        </button>
                        <button
                            onClick={() => setMethod('qris')}
                            className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${method === 'qris' ? 'border-brand-dark dark:border-studio-blue bg-studio-blue text-white shadow-lg scale-105' : 'border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-gray-400 dark:text-neutral-600 hover:border-gray-200 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800'}`}
                        >
                            <Scan size={20} />
                            <span className="text-[10px] font-bold uppercase">QRIS</span>
                        </button>
                    </div>
                </div>

                {/* Custom Footer */}
                <div className="flex gap-3 pt-2">
                    <button
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-3 rounded-lg font-bold text-gray-500 dark:text-neutral-500 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-3 rounded-lg font-bold bg-studio-blue text-white hover:bg-studio-blue/90 flex items-center justify-center gap-2 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Mark as Paid
                    </button>
                </div>
            </div>
        </ConfirmationDialog>
    );
}
