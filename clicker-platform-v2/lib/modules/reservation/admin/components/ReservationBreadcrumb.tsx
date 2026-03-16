import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { useSite } from '@/lib/site-context';

interface ReservationBreadcrumbProps {
    currentPage: string;
}

export function ReservationBreadcrumb({ currentPage }: ReservationBreadcrumbProps) {
    const { tenantSlug } = useSite();
    return (
        <nav className="flex items-center gap-2 text-sm text-gray-500 dark:text-neutral-500 mb-6 font-medium">
            <Link
                href={`${tenantSlug ? `/${tenantSlug}` : ''}/admin/reservation/dashboard`}
                className="hover:text-brand-dark hover:underline flex items-center gap-1 transition-colors"
            >
                <Home size={14} /> Reservation
            </Link>
            <ChevronRight size={14} className="text-gray-400 dark:text-neutral-600" />
            <span className="text-brand-dark font-bold">{currentPage}</span>
        </nav>
    );
}
