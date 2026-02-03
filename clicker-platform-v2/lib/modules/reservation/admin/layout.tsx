import { isModuleEnabled } from '@/lib/modules/registry';
import { notFound } from 'next/navigation';

export default async function ReservationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Modular Check: Verify if module is enabled
    // This protects all child routes (/admin/reservation/*)
    const enabled = await isModuleEnabled('reservation');
    if (!enabled) {
        notFound();
    }

    return <>{children}</>;
}
