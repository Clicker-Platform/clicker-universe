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
    initialSettings: { allowStaffSelection: boolean; membershipEnabled?: boolean; staffLabel?: string };
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
    const isGlass = theme.cardStyle === 'glass';

    const [step, setStep] = useState(1);
    // ... rest of state

    const [loading, setLoading] = useState(false);

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

        setLoading(true);
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
                staffName: selectedStaff?.name
            } as any);

            setBookingRef(id);
            setStep(5);
        } catch (error) {
            console.error(error);
            handleShowDialog('Booking Failed', 'Unable to create booking. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (step === 5) {
        return (
            <div className={`text-center p-8 rounded-2xl animate-in fade-in ${
                isGlass
                    ? 'bg-black/20 backdrop-blur-md border border-white/10 text-white'
                    : 'bg-green-50 border border-green-100 text-gray-900'
            }`}>
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                    isGlass ? 'bg-white/10 text-white' : 'bg-green-100 text-green-600'
                }`}>
                    <Check size={32} strokeWidth={3} />
                </div>
                <h2 className={`text-2xl font-black mb-2 ${isGlass ? 'text-white' : 'text-brand-dark'}`}>Booking Confirmed!</h2>
                <p className={`mb-6 ${isGlass ? 'text-white/70' : 'text-gray-600'}`}>Your appointment for <span className="font-bold">{selectedService?.name}</span> has been received.</p>
                <div className={`p-4 rounded-xl border border-dashed inline-block text-left text-sm mb-6 ${
                    isGlass ? 'bg-white/5 border-white/20 text-white/70' : 'bg-white border-green-200 text-gray-500'
                }`}>
                    <p>Reference: <span className={`font-mono font-bold ${isGlass ? 'text-white' : 'text-brand-dark'}`}>{bookingRef}</span></p>
                    {selectedService?.bookingType === 'request'
                        ? <p>We will contact you to confirm the schedule.</p>
                        : <p>Date: <span suppressHydrationWarning className={`font-bold ${isGlass ? 'text-white' : 'text-brand-dark'}`}>{date?.toLocaleDateString()} at {selectedTime}</span></p>
                    }
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className={`block w-full py-3 font-bold rounded-xl ${
                        isGlass
                            ? 'bg-[var(--theme-primary)] text-black hover:opacity-90'
                            : 'bg-brand-dark text-white hover:bg-brand-dark/90'
                    }`}
                >
                    Book Another
                </button>
            </div>
        );
    }

    return (
        <div className={`overflow-hidden max-w-md mx-auto transition-all duration-200 rounded-2xl ${
            isGlass
                ? 'bg-black/20 backdrop-blur-md border border-white/10 shadow-xl'
                : 'bg-white border border-gray-200 shadow-sm'
        }`}>
            {/* Header */}
            <div className={`p-6 rounded-t-2xl ${
                isGlass
                    ? 'bg-white/5 border-b border-white/10'
                    : 'bg-gray-900'
            }`}>
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
                        }} className="p-1 hover:bg-white/10 rounded-lg">
                            <ChevronLeft size={20} className="text-white" />
                        </button>
                    )}
                    <span className="font-bold text-sm text-white/80">
                        Step {step} of {selectedService?.bookingType === 'request' ? (settings.allowStaffSelection ? 3 : 2) : 4}
                    </span>
                    <div className="w-6"></div> {/* Spacer */}
                </div>
                <h2 className="text-2xl font-black text-white">
                    {step === 1 && "Select Service"}
                    {step === 2 && `Select ${settings.staffLabel || 'Staff'}`}
                    {step === 3 && "Select Time"}
                    {step === 4 && "Your Details"}
                </h2>
            </div>

            {/* Content */}
            <div className={`p-6 min-h-[400px] ${isGlass ? 'text-white' : 'text-gray-900'}`}>
                {step === 1 && (
                    <ServiceStep
                        services={services}
                        onSelect={handleServiceSelect}
                        isGlass={isGlass}
                    />
                )}

                {step === 2 && (
                    <StaffStep
                        staffList={staffList}
                        onSelect={handleStaffSelect}
                        isGlass={isGlass}
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
                        isGlass={isGlass}
                    />
                )}

                {step === 4 && selectedService && (selectedTime || selectedService.bookingType === 'request') && (
                    <DetailsStep
                        selectedService={selectedService}
                        selectedStaff={selectedStaff}
                        date={date || new Date()}
                        time={selectedTime || ''}
                        membershipEnabled={settings.membershipEnabled || false}
                        onSubmit={handleSubmit}
                        onShowDialog={handleShowDialog}
                        isGlass={isGlass}
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
