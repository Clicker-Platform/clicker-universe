import { Service, Staff } from '../../types';
import { User, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSite } from '@/lib/site-context'; // New import

interface DetailsStepProps {
    selectedService: Service;
    selectedStaff: Staff | null;
    date: Date;
    time: string;
    membershipEnabled: boolean;
    onSubmit: (customerInfo: any) => Promise<void>;
    onShowDialog: (title: string, message: string, variant: 'info' | 'error' | 'success') => void;
}

export default function DetailsStep({
    selectedService,
    selectedStaff,
    date,
    time,
    membershipEnabled,
    onSubmit,
    onShowDialog
}: DetailsStepProps) {
    const { siteId } = useSite();
    const [loading, setLoading] = useState(false);
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        phone: '',
        notes: '',
        id: 'guest'
    });
    const [memberSearchPhone, setMemberSearchPhone] = useState('');

    const checkMember = async () => {
        if (!memberSearchPhone || memberSearchPhone.length < 6) return;
        if (!membershipEnabled) return;

        setLoading(true);
        try {
            if (!siteId) return;
            const { findMemberByPhone } = await import('@/lib/modules/membership/api');
            const member = await findMemberByPhone(siteId, memberSearchPhone);
            if (member) {
                setCustomerInfo(prev => ({
                    ...prev,
                    id: member.id,
                    name: member.fullName,
                    email: member.email || '',
                    phone: member.phoneNumber
                }));
                onShowDialog('Welcome Back!', `Welcome back, ${member.fullName}! Your details have been pre-filled.`, 'success');
            } else {
                onShowDialog('Member Not Found', "We couldn't find a membership linked to this number. Please check the number or continue as a guest.", 'info');
            }
        } catch (error) {
            console.error(error);
            onShowDialog('Connection Error', "Unable to verify membership at this time.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit(customerInfo);
    };

    return (
        <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl mb-4 text-sm">
                <div className="flex justify-between mb-1">
                    <span className="text-gray-500">Service:</span>
                    <span className="font-bold text-brand-dark">{selectedService.name}</span>
                </div>
                {selectedStaff && (
                    <div className="flex justify-between mb-1">
                        <span className="text-gray-500">Staff:</span>
                        <span className="font-bold text-brand-dark">{selectedStaff.name}</span>
                    </div>
                )}
                <div className="flex justify-between">
                    <span className="text-gray-500">Time:</span>
                    <span className="font-bold text-brand-dark">{date.toLocaleDateString()} at {time}</span>
                </div>
            </div>

            {/* Membership Toggle */}
            {membershipEnabled && (
                <div className="border border-brand-blue/20 bg-brand-blue/5 p-4 rounded-xl mb-6">
                    <h3 className="text-brand-dark font-bold mb-2 text-sm flex items-center gap-2">
                        <User size={16} /> Already a Member?
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="tel"
                            value={memberSearchPhone}
                            onChange={(e) => setMemberSearchPhone(e.target.value)}
                            placeholder="Enter registered phone number"
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-brand-dark"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    checkMember();
                                }
                            }}
                        />
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                checkMember();
                            }}
                            disabled={loading || !memberSearchPhone}
                            className="bg-brand-dark text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
                        >
                            Check
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Full Name</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            required
                            type="text"
                            value={customerInfo.name}
                            onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-dark"
                            placeholder="Jane Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email</label>
                        <input
                            required
                            type="email"
                            value={customerInfo.email}
                            onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-dark"
                            placeholder="jane@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Phone</label>
                        <input
                            required
                            type="tel"
                            value={customerInfo.phone}
                            onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-dark"
                            placeholder="+62..."
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Start Note</label>
                    <textarea
                        value={customerInfo.notes}
                        onChange={e => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:border-brand-dark"
                        rows={2}
                        placeholder="Any special requests?"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-brand-dark text-white font-bold rounded-xl mt-4 hover:bg-brand-dark/90 transition-colors flex items-center justify-center gap-2"
                >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
            </form>
        </div>
    );
}
