'use client';

import { useState, useContext, useEffect } from 'react';
import { createBooking } from '@/lib/modules/reservation/api';
import { Service, TimeSlot, Staff } from '@/lib/modules/reservation/types';
import { Check, ChevronLeft } from 'lucide-react';
import { AlertDialog } from '@/components/common/AlertDialog';
import { useSite } from '@/lib/site-context'; // New import
import { TemplateContext } from '@/components/TemplateProvider';
import ServiceStep from './steps/ServiceStep';
import StaffStep from './steps/StaffStep';
import TimeStep from './steps/TimeStep';
import DetailsStep from './steps/DetailsStep';

interface BookingFormProps {
    initialServices: Service[];
    initialWeeklySlots: TimeSlot[];
    initialStaff: Staff[];
    initialSettings: { allowStaffSelection: boolean; membershipEnabled?: boolean };
    siteId: string;
}

export default function BookingForm({
    initialServices,
    initialWeeklySlots,
    initialStaff,
    initialSettings,
    siteId
}: BookingFormProps) {
    // const { siteId } = useSite(); // Use prop instead of context for robust widget behavior
    const { theme } = useContext(TemplateContext) || { theme: { cardStyle: 'brutalist' } as any };
    const isClean = theme.cardStyle === 'clean';

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
        setSelectedService(service);
        if (settings.allowStaffSelection) {
            setStep(2);
        } else {
            setStep(3); // Skip staff
        }
    };

    const handleStaffSelect = (staff: Staff | null) => {
        setSelectedStaff(staff);
        setStep(3);
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
        if (!selectedService || !selectedTime) return;

        setLoading(true);
        try {
            // Reconstruct Date object from date + time string
            const [hours, minutes] = selectedTime.split(':').map(Number);
            const bookingStart = new Date(date || new Date());
            bookingStart.setHours(hours, minutes, 0, 0);

            const bookingEnd = new Date(bookingStart.getTime() + selectedService.durationMinutes * 60000);

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
            <div className="text-center p-8 bg-green-50 rounded-2xl border border-green-100 animate-in fade-in">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Check size={32} strokeWidth={3} />
                </div>
                <h2 className="text-2xl font-black text-brand-dark mb-2">Booking Confirmed!</h2>
                <p className="text-gray-600 mb-6">Your appointment for <span className="font-bold">{selectedService?.name}</span> has been received.</p>
                <div className="bg-white p-4 rounded-xl border border-dashed border-green-200 inline-block text-left text-sm text-gray-500 mb-6">
                    <p>Reference: <span className="font-mono text-brand-dark">{bookingRef}</span></p>
                    <p>Date: <span suppressHydrationWarning className="font-bold text-brand-dark">{date?.toLocaleDateString()} at {selectedTime}</span></p>
                </div>
                <button
                    onClick={() => window.location.reload()}
                    className="block w-full py-3 bg-brand-dark text-white font-bold rounded-xl"
                >
                    Book Another
                </button>
            </div>
        );
    }

    return (
        <div
            className={`
                bg-white overflow-hidden max-w-md mx-auto transition-all duration-200
                ${isClean
                    ? 'border border-gray-200 shadow-sm hover:shadow-md'
                    : 'border-[3px] border-theme-border shadow-sticker'
                }
            `}
            style={{ borderRadius: 'var(--theme-radius)' }}
        >
            {/* Header */}
            <div className={`p-6 transition-all ${isClean ? 'bg-gray-900 text-white' : 'bg-theme-foreground text-theme-background'}`}>
                <div className="flex items-center justify-between mb-2">
                    {step > 1 && (
                        <button onClick={() => setStep(step - 1)} className="p-1 hover:bg-white/10 rounded-lg">
                            <ChevronLeft size={20} />
                        </button>
                    )}
                    <span className="font-bold text-sm tracking-uppercase opacity-80">
                        Step {step} of 4
                    </span>
                    <div className="w-6"></div> {/* Spacer */}
                </div>
                <h2 className="text-2xl font-black">
                    {step === 1 && "Select Service"}
                    {step === 2 && "Select Staff"}
                    {step === 3 && "Select Time"}
                    {step === 4 && "Your Details"}
                </h2>
            </div>

            {/* Content */}
            <div className="p-6 min-h-[400px]">
                {step === 1 && (
                    <ServiceStep
                        services={services}
                        onSelect={handleServiceSelect}
                    />
                )}

                {step === 2 && (
                    <StaffStep
                        staffList={staffList}
                        onSelect={handleStaffSelect}
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
                        weeklySlots={initialWeeklySlots}
                        onSelectTime={handleTimeSelect}
                    />
                )}

                {step === 4 && selectedService && selectedTime && (
                    <DetailsStep
                        selectedService={selectedService}
                        selectedStaff={selectedStaff}
                        date={date || new Date()}
                        time={selectedTime}
                        membershipEnabled={settings.membershipEnabled || false}
                        onSubmit={handleSubmit}
                        onShowDialog={handleShowDialog}
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
