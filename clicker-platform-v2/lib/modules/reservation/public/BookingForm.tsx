'use client';

import { useState, useEffect } from 'react';
import { createBooking } from '@/lib/modules/reservation/api';
import { Service, Staff } from '@/lib/modules/reservation/types';
import { Check, ChevronLeft } from 'lucide-react';
import { AlertDialog } from '@/components/common/AlertDialog';
import { useTemplate } from '@/components/TemplateProvider';
import ServiceStep from './steps/ServiceStep';
import StaffStep from './steps/StaffStep';
import TimeStep from './steps/TimeStep';
import DetailsStep from './steps/DetailsStep';

interface BookingFormProps {
    initialServices: Service[];
    initialStaff: Staff[];
    initialSettings: {
        allowStaffSelection: boolean;
        membershipEnabled?: boolean;
        staffLabel?: string;
        pricingDisplay?: string;
        bookingTitle?: string;
        formConfig?: {
            requireAsset: boolean;
            assetLabel: string;
            assetPlaceholder: string;
            requireAssetModel: boolean;
            assetModelLabel: string;
        };
    };
    siteId: string;
}

export default function BookingForm({
    initialServices,
    initialStaff,
    initialSettings,
    siteId
}: BookingFormProps) {
    // const { siteId } = useSite(); // Use prop instead of context for robust widget behavior

    const { theme } = useTemplate();
    const isGlass = theme.decorations?.surfaceStyle === 'glass' || theme.cardStyle === 'glass';
    const surfaceBg = isGlass ? 'rgba(0,0,0,0.2)' : (theme.colors.surfaceElevated || theme.colors.surface || '#ffffff');
    const surfaceBorder = isGlass ? 'rgba(255,255,255,0.1)' : (theme.colors.border || '#e5e7eb');

    const [step, setStep] = useState(1);
    // ... rest of state

    // Data
    const [services] = useState<Service[]>(initialServices);
    const [selectedService, setSelectedService] = useState<Service | null>(null);
    const [staffList] = useState<Staff[]>(initialStaff);
    const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null); // null means "Any"
    const [settings] = useState(initialSettings);

    // Initialize as null/empty to prevent hydration mismatch for Date
    const [date, setDate] = useState<Date | undefined>(undefined);

    // Set date on mount
    useEffect(() => {
        setDate(new Date());
    }, []);

    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [bookingRef, setBookingRef] = useState<string | null>(null);

    const handleServiceSelect = (service: Service) => {
        if (selectedService?.id !== service.id) {
            setSelectedTime(null);
            setSelectedStaff(null);
        }
        setSelectedService(service);
        if (settings.allowStaffSelection) {
            setStep(2);
        } else if (service.bookingType === 'request') {
            setStep(4); // Skip time picker for on-request services
        } else {
            setStep(3);
        }
    };

    const handleStaffSelect = (staff: Staff | null) => {
        setSelectedStaff(staff);
        if (selectedService?.bookingType === 'request') {
            setStep(4); // Skip time picker for on-request services
        } else {
            setStep(3);
        }
    };

    const handleTimeSelect = (time: string) => {
        setSelectedTime(time);
        setStep(4);
    };

    // Dialog State
    const [dialogState, setDialogState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        variant: 'info' | 'error' | 'success';
    }>({
        isOpen: false,
        title: '',
        message: '',
        variant: 'info'
    });

    const handleShowDialog = (title: string, message: string, variant: 'info' | 'error' | 'success' = 'info') => {
        setDialogState({
            isOpen: true,
            title,
            message,
            variant
        });
    };

    const handleSubmit = async (customerInfo: any) => {
        const isRequest = selectedService?.bookingType === 'request';
        if (!selectedService || (!isRequest && !selectedTime)) return;

        try {
            let bookingStart: Date;
            let bookingEnd: Date;

            if (isRequest) {
                // On-request: use current time as placeholder; admin confirms actual schedule
                bookingStart = new Date();
                bookingEnd = new Date();
            } else {
                // Time-slot: reconstruct Date from date + time string
                const [hours, minutes] = selectedTime!.split(':').map(Number);
                bookingStart = new Date(date || new Date());
                bookingStart.setHours(hours, minutes, 0, 0);
                bookingEnd = new Date(bookingStart.getTime() + (selectedService.durationMinutes ?? 60) * 60000);
            }

            const id = await createBooking(siteId, {
                serviceId: selectedService.id,
                serviceName: selectedService.name,
                customerId: customerInfo.id,
                customerName: customerInfo.name,
                customerEmail: customerInfo.email,
                customerPhone: customerInfo.phone,
                status: 'pending',
                startAt: bookingStart as any,
                endAt: bookingEnd as any,
                totalPrice: selectedService.price,
                notes: customerInfo.notes,
                preferredDate: customerInfo.preferredDate || undefined,
                staffId: selectedStaff?.id,
                staffName: selectedStaff?.name,
                assetId: customerInfo.assetId || undefined,
                assetModel: customerInfo.assetModel || undefined,
            } as any);

            setBookingRef(id);
            setStep(5);
        } catch (error) {
            console.error(error);
            handleShowDialog('Booking Failed', 'Unable to create booking. Please try again.', 'error');
        }
    };

    if (step === 5) {
        return (
            <div
                className="text-center p-8 rounded-2xl animate-in fade-in"
                style={{
                    background: isGlass ? 'rgba(0,0,0,0.2)' : surfaceBg,
                    backdropFilter: isGlass ? 'blur(12px)' : undefined,
                    border: `1px solid ${surfaceBorder}`,
                    color: theme.colors.foreground,
                }}
            >
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: `${theme.colors.primary}20`, color: theme.colors.primary }}>
                    <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-black mb-2" style={{ color: theme.colors.foreground }}>Booking Confirmed!</h2>
                <p className="mb-6" style={{ color: theme.colors.textMuted || theme.colors.foreground }}>
                    Your appointment for <span className="font-bold">{selectedService?.name}</span> has been received.
                </p>
                <div className="p-4 rounded-xl border border-dashed inline-block text-left text-sm mb-6"
                    style={{ backgroundColor: `${theme.colors.primary}08`, borderColor: `${theme.colors.primary}30`, color: theme.colors.textMuted || theme.colors.foreground }}>
                    <p>Reference: <span className="font-mono font-bold" style={{ color: theme.colors.foreground }}>{bookingRef}</span></p>
                    {selectedService?.bookingType === 'request'
                        ? <p>We will contact you to confirm the schedule.</p>
                        : <p>Date: <span suppressHydrationWarning className="font-bold" style={{ color: theme.colors.foreground }}>{date?.toLocaleDateString()} at {selectedTime}</span></p>
                    }
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="block w-full py-3 font-bold rounded-xl hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: theme.colors.primary, color: theme.colors.accentForeground || '#ffffff' }}
                >
                    Book Another
                </button>
            </div>
        );
    }

    return (
        <div
            className="overflow-hidden w-full transition-all duration-200 rounded-2xl"
            style={{
                background: isGlass ? 'rgba(0,0,0,0.2)' : surfaceBg,
                backdropFilter: isGlass ? 'blur(12px)' : undefined,
                border: `1px solid ${surfaceBorder}`,
            }}
        >
            {/* Header */}
            <div
                className="p-6 rounded-t-2xl border-b"
                style={{
                    backgroundColor: isGlass ? 'rgba(255,255,255,0.05)' : theme.colors.foreground,
                    borderColor: isGlass ? 'rgba(255,255,255,0.1)' : 'transparent',
                }}
            >
                <div className="flex items-center justify-between mb-2">
                    {step > 1 && (
                        <button onClick={() => {
                            if (step === 4 && selectedService?.bookingType === 'request') {
                                setStep(settings.allowStaffSelection ? 2 : 1);
                            } else if (step === 3 && !settings.allowStaffSelection) {
                                setStep(1);
                            } else {
                                setStep(step - 1);
                            }
                        }} className="p-1 rounded-lg hover:opacity-70 transition-opacity"
                            style={{ color: theme.colors.background }}>
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <span className="font-bold text-sm opacity-70" style={{ color: theme.colors.background }}>
                        Step {step} of {selectedService?.bookingType === 'request' ? (settings.allowStaffSelection ? 3 : 2) : 4}
                    </span>
                    <div className="w-6" />
                </div>
                <h2 className="text-2xl font-black" style={{ color: theme.colors.background }}>
                    {step === 1 && (settings.bookingTitle || "Select Service")}
                    {step === 2 && `Select ${settings.staffLabel || 'Staff'}`}
                    {step === 3 && "Select Time"}
                    {step === 4 && "Your Details"}
                </h2>
            </div>

            {/* Content */}
            <div className="p-6 min-h-[400px]" style={{ color: theme.colors.foreground }}>
                {step === 1 && (
                    <ServiceStep
                        services={services}
                        onSelect={handleServiceSelect}
                        theme={theme}
                        pricingDisplay={(settings.pricingDisplay as any) || 'fixed'}
                    />
                )}

                {step === 2 && (
                    <StaffStep
                        staffList={staffList}
                        onSelect={handleStaffSelect}
                        theme={theme}
                        staffLabel={settings.staffLabel}
                    />
                )}

                {step === 3 && selectedService && (
                    <TimeStep
                        siteId={siteId}
                        date={date || new Date()}
                        setDate={setDate}
                        selectedService={selectedService}
                        selectedStaff={selectedStaff}
                        staffList={staffList}
                        onSelectTime={handleTimeSelect}
                        theme={theme}
                    />
                )}

                {step === 4 && selectedService && (selectedTime || selectedService.bookingType === 'request') && (
                    <DetailsStep
                        selectedService={selectedService}
                        selectedStaff={selectedStaff}
                        date={date || new Date()}
                        time={selectedTime || ''}
                        membershipEnabled={settings.membershipEnabled || false}
                        formConfig={settings.formConfig}
                        onSubmit={handleSubmit}
                        onShowDialog={handleShowDialog}
                        theme={theme}
                    />
                )}
            </div>

            <AlertDialog
                isOpen={dialogState.isOpen}
                title={dialogState.title}
                message={dialogState.message}
                variant={dialogState.variant}
                onClose={() => setDialogState(prev => ({ ...prev, isOpen: false }))}
            />
        </div>
    );
}
