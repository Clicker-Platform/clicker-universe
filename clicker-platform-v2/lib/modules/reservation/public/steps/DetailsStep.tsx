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
    isGlass?: boolean;
}

export default function DetailsStep({
    selectedService,
    selectedStaff,
    date,
    time,
    membershipEnabled,
    onSubmit,
    onShowDialog,
    isGlass = false,
}: DetailsStepProps) {
    const { siteId } = useSite();
    const [loading, setLoading] = useState(false);
    const isRequest = selectedService.bookingType === 'request';
    const [customerInfo, setCustomerInfo] = useState({
        name: '',
        email: '',
        phone: '',
        notes: '',
        preferredDate: '',
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
        if (loading) return;
        setLoading(true);
        try {
            await onSubmit(customerInfo);
        } finally {
            setLoading(false);
        }
    };

    const inputClass = `w-full px-4 py-3 rounded-xl border focus:outline-none ${
        isGlass
            ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-white/30'
            : 'border-gray-200 focus:border-brand-dark'
    }`;
    const labelClass = `block text-xs font-bold uppercase mb-1 ${isGlass ? 'text-white/50' : 'text-gray-500'}`;

    return (
        <div className="space-y-4">
            {/* Booking summary */}
            <div className={`p-4 rounded-xl mb-4 text-sm ${isGlass ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="flex justify-between mb-1">
                    <span className={isGlass ? 'text-white/50' : 'text-gray-500'}>Service:</span>
                    <span className={`font-bold ${isGlass ? 'text-white' : 'text-gray-900'}`}>{selectedService.name}</span>
                </div>
                {selectedStaff && (
                    <div className="flex justify-between mb-1">
                        <span className={isGlass ? 'text-white/50' : 'text-gray-500'}>Staff:</span>
                        <span className={`font-bold ${isGlass ? 'text-white' : 'text-gray-900'}`}>{selectedStaff.name}</span>
                    </div>
                )}
                {isRequest ? (
                    <div className="flex justify-between">
                        <span className={isGlass ? 'text-white/50' : 'text-gray-500'}>Schedule:</span>
                        <span className={`font-bold ${isGlass ? 'text-white' : 'text-gray-900'}`}>On Request</span>
                    </div>
                ) : (
                    <div className="flex justify-between">
                        <span className={isGlass ? 'text-white/50' : 'text-gray-500'}>Time:</span>
                        <span className={`font-bold ${isGlass ? 'text-white' : 'text-gray-900'}`}>{date.toLocaleDateString()} at {time}</span>
                    </div>
                )}
            </div>

            {/* Membership Toggle */}
            {membershipEnabled && (
                <div className={`border p-4 rounded-xl mb-6 ${
                    isGlass ? 'border-white/10 bg-white/5' : 'border-brand-blue/20 bg-brand-blue/5'
                }`}>
                    <h3 className={`font-bold mb-2 text-sm flex items-center gap-2 ${isGlass ? 'text-white' : 'text-gray-900'}`}>
                        <User size={16} /> Already a Member?
                    </h3>
                    <div className="flex gap-2">
                        <input
                            type="tel"
                            value={memberSearchPhone}
                            onChange={(e) => setMemberSearchPhone(e.target.value)}
                            placeholder="Enter registered phone number"
                            className={`flex-1 px-3 py-2 rounded-lg border text-sm focus:outline-none ${
                                isGlass
                                    ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-white/30'
                                    : 'border-gray-200 focus:border-brand-dark'
                            }`}
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
                            className={`px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 ${
                                isGlass
                                    ? 'bg-[var(--theme-primary)] text-black'
                                    : 'bg-brand-dark text-white'
                            }`}
                        >
                            Check
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className={labelClass}>Full Name</label>
                    <div className="relative">
                        <User className={`absolute left-4 top-1/2 -translate-y-1/2 ${isGlass ? 'text-white/30' : 'text-gray-400'}`} size={18} />
                        <input
                            required
                            type="text"
                            value={customerInfo.name}
                            onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            className={`${inputClass} pl-10`}
                            placeholder="Jane Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>Email</label>
                        <input
                            required
                            type="email"
                            value={customerInfo.email}
                            onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                            className={inputClass}
                            placeholder="jane@example.com"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Phone</label>
                        <input
                            required
                            type="tel"
                            value={customerInfo.phone}
                            onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                            className={inputClass}
                            placeholder="+62..."
                        />
                    </div>
                </div>

                {isRequest && (
                    <div>
                        <label className={labelClass}>Preferred Date <span className={isGlass ? 'text-white/30' : 'text-gray-400'}>(optional)</span></label>
                        <input
                            type="date"
                            min={new Date().toLocaleDateString('en-CA')}
                            value={customerInfo.preferredDate}
                            onChange={e => setCustomerInfo({ ...customerInfo, preferredDate: e.target.value })}
                            className={inputClass}
                            style={isGlass ? { colorScheme: 'dark' } : undefined}
                        />
                        <p className={`text-xs mt-1 ${isGlass ? 'text-white/30' : 'text-gray-400'}`}>We will confirm the final schedule with you.</p>
                    </div>
                )}

                <div>
                    <label className={labelClass}>Notes</label>
                    <textarea
                        value={customerInfo.notes}
                        onChange={e => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                        className={inputClass}
                        rows={2}
                        placeholder="Any special requests?"
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className={`w-full py-3 font-bold rounded-xl mt-4 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        isGlass
                            ? 'bg-[var(--theme-primary)] text-black hover:opacity-90'
                            : 'bg-brand-dark text-white hover:bg-brand-dark/90'
                    }`}
                >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
            </form>
        </div>
    );
}
