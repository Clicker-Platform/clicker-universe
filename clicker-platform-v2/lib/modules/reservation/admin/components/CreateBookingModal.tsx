import React from 'react';
import { X } from 'lucide-react';
import { Service, Staff } from '@/lib/modules/reservation/types';
import AdminBookingWizard from './AdminBookingWizard';

interface CreateBookingModalProps {
    onClose: () => void;
    onSubmit: (data: any) => Promise<void>;
    services: Service[];
    staff: Staff[];
    settings: { allowStaffSelection: boolean };
    isOpen: boolean;
}

export function CreateBookingModal({ onClose, onSubmit, services, staff, settings, isOpen }: CreateBookingModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white dark:bg-neutral-900 rounded-lg w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex justify-between items-center bg-gray-50 dark:bg-neutral-800/50">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-neutral-100">New Manual Booking</h2>
                    <button onClick={onClose} className="text-gray-400 dark:text-neutral-600 hover:text-gray-600 dark:hover:text-neutral-300">
                        <X size={24} />
                    </button>
                </div>

                <AdminBookingWizard
                    initialServices={services}
                    initialStaff={staff}
                    initialSettings={settings}
                    onSuccess={() => {
                        // Refresh data is usually handled by parent detecting modal close or explicit callback
                        // For now we just close, but we might want to trigger a refresh.
                        // We can call onSubmit as a "done" signal if needed, but the Wizard actively saves to DB.
                        // So we just close. Parents usually listen to DB changes or re-fetch on close? 
                        // Actually parent re-fetches explicitly in 'handleCreateBooking'. 
                        // Since wizard saves internally, we need a way to tell parent to refresh.
                        // We can misuse onSubmit for that or just onClose is fine if parent refreshes.
                        // Let's call onSubmit with null to signal "refresh please".
                        onSubmit({}).then(() => onClose());
                    }}
                    onCancel={onClose}
                />
            </div>
        </div>
    );
}
