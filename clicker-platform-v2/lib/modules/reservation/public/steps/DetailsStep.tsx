import { Service, Staff } from '../../types';
import { User, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { useSite } from '@/lib/site-context';
import { logger } from '@/lib/logger';
import { ThemeConfig } from '@/lib/templates/types';

interface DetailsStepProps {
    selectedService: Service;
    selectedStaff: Staff | null;
    date: Date;
    time: string;
    membershipEnabled: boolean;
    formConfig?: {
        requireAsset: boolean;
        assetLabel: string;
        assetPlaceholder: string;
        requireAssetModel: boolean;
        assetModelLabel: string;
    };
    onSubmit: (customerInfo: any) => Promise<void>;
    onShowDialog: (title: string, message: string, variant: 'info' | 'error' | 'success') => void;
    theme: ThemeConfig;
}

export default function DetailsStep({
    selectedService,
    selectedStaff,
    date,
    time,
    membershipEnabled,
    formConfig,
    onSubmit,
    onShowDialog,
    theme,
}: DetailsStepProps) {
    const { siteId } = useSite();
    const [loading, setLoading] = useState(false);
    const isRequest = selectedService.bookingType === 'request';
    const [customerInfo, setCustomerInfo] = useState({
        name: '', email: '', phone: '', notes: '',
        preferredDate: '', id: 'guest', assetId: '', assetModel: '',
    });
    const [memberSearchPhone, setMemberSearchPhone] = useState('');

    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = theme.colors.surface || '#f9fafb';
    const borderColor = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');
    const subtleText = theme.colors.textSubtle || theme.colors.muted || theme.colors.foreground;

    const inputStyle: React.CSSProperties = {
        backgroundColor: theme.colors.surfaceElevated || surfaceBg,
        borderColor,
        color: theme.colors.foreground,
        borderRadius: 'calc(var(--theme-radius) * 0.75)',
    };
    const labelStyle: React.CSSProperties = { color: subtleText };

    const checkMember = async () => {
        if (!memberSearchPhone || memberSearchPhone.length < 6) return;
        if (!membershipEnabled) return;
        setLoading(true);
        try {
            if (!siteId) return;
            const { findMemberByPhone } = await import('@/lib/modules/membership/api');
            const member = await findMemberByPhone(siteId, memberSearchPhone);
            if (member) {
                setCustomerInfo(prev => ({ ...prev, id: member.id, name: member.fullName, email: member.email || '', phone: member.phoneNumber }));
                onShowDialog('Welcome Back!', `Welcome back, ${member.fullName}! Your details have been pre-filled.`, 'success');
            } else {
                onShowDialog('Member Not Found', "We couldn't find a membership linked to this number. Please check the number or continue as a guest.", 'info');
            }
        } catch (error) {
            logger.error('reservation.details.member-verify.failed', { siteId, error });
            onShowDialog('Connection Error', "Unable to verify membership at this time.", 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);
        try { await onSubmit(customerInfo); } finally { setLoading(false); }
    };

    return (
        <div className="space-y-4">
            {/* Booking summary */}
            <div className="p-4 mb-4 text-sm"
                style={{ backgroundColor: surfaceBg, border: `1px solid ${borderColor}`, borderRadius: 'var(--theme-radius)' }}>
                <div className="flex justify-between gap-3 mb-1">
                    <span className="shrink-0" style={{ color: subtleText }}>Service:</span>
                    <span className="font-bold text-right" style={{ color: theme.colors.foreground }}>{selectedService.name}</span>
                </div>
                {selectedStaff && (
                    <div className="flex justify-between gap-3 mb-1">
                        <span className="shrink-0" style={{ color: subtleText }}>Staff:</span>
                        <span className="font-bold text-right" style={{ color: theme.colors.foreground }}>{selectedStaff.name}</span>
                    </div>
                )}
                <div className="flex justify-between gap-3">
                    <span className="shrink-0" style={{ color: subtleText }}>{isRequest ? 'Schedule:' : 'Time:'}</span>
                    <span className="font-bold text-right" style={{ color: theme.colors.foreground }}>
                        {isRequest ? 'On Request' : `${date.toLocaleDateString()} at ${time}`}
                    </span>
                </div>
            </div>

            {/* Membership Toggle */}
            {membershipEnabled && (
                <div className="space-y-2">
                    <p className="font-bold text-sm flex items-center gap-2" style={{ color: theme.colors.foreground }}>
                        <User size={16} /> Already a Member?
                    </p>
                    <input
                        type="tel"
                        value={memberSearchPhone}
                        onChange={(e) => setMemberSearchPhone(e.target.value)}
                        placeholder="Enter registered phone number"
                        className="w-full px-3 py-2 rounded-lg border text-sm focus:outline-none"
                        style={inputStyle}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); checkMember(); } }}
                    />
                    <button
                        onClick={(e) => { e.preventDefault(); checkMember(); }}
                        disabled={loading || !memberSearchPhone}
                        className="w-full py-2 text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff', borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                    >
                        Check
                    </button>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>Full Name</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: subtleText }} />
                        <input
                            required type="text"
                            value={customerInfo.name}
                            onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border focus:outline-none"
                            style={inputStyle}
                            placeholder="Jane Doe"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>Email</label>
                        <input
                            required type="email"
                            value={customerInfo.email}
                            onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border focus:outline-none"
                            style={inputStyle}
                            placeholder="jane@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>Phone</label>
                        <input
                            required type="tel"
                            value={customerInfo.phone}
                            onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border focus:outline-none"
                            style={inputStyle}
                            placeholder="+62..."
                        />
                    </div>
                </div>

                {isRequest && (
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>
                            Preferred Date <span style={{ color: subtleText, fontWeight: 'normal' }}>(optional)</span>
                        </label>
                        <input
                            type="date"
                            min={new Date().toLocaleDateString('en-CA')}
                            value={customerInfo.preferredDate}
                            onChange={e => setCustomerInfo({ ...customerInfo, preferredDate: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border focus:outline-none"
                            style={{ ...inputStyle, colorScheme: isGlass ? 'dark' : 'light' }}
                        />
                        <p className="text-xs mt-1" style={{ color: subtleText }}>We will confirm the final schedule with you.</p>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>Notes</label>
                    <textarea
                        value={customerInfo.notes}
                        onChange={e => setCustomerInfo({ ...customerInfo, notes: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border focus:outline-none"
                        style={inputStyle}
                        rows={2}
                        placeholder="Any special requests?"
                    />
                </div>

                {formConfig?.requireAsset && (
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>{formConfig.assetLabel}</label>
                        <input
                            required type="text"
                            value={customerInfo.assetId}
                            onChange={e => setCustomerInfo({ ...customerInfo, assetId: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border focus:outline-none"
                            style={inputStyle}
                            placeholder={formConfig.assetPlaceholder}
                        />
                    </div>
                )}

                {formConfig?.requireAsset && formConfig?.requireAssetModel && (
                    <div>
                        <label className="block text-xs font-bold uppercase mb-1" style={labelStyle}>{formConfig.assetModelLabel}</label>
                        <input
                            required type="text"
                            value={customerInfo.assetModel}
                            onChange={e => setCustomerInfo({ ...customerInfo, assetModel: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border focus:outline-none"
                            style={inputStyle}
                            placeholder={formConfig.assetModelLabel}
                        />
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 font-bold mt-4 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff', borderRadius: 'calc(var(--theme-radius) * 0.75)' }}
                >
                    {loading && <Loader2 size={18} className="animate-spin" />}
                    {loading ? 'Confirming...' : 'Confirm Booking'}
                </button>
            </form>
        </div>
    );
}
