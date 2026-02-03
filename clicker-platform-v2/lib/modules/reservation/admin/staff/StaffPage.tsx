import { getStaffMembers } from '@/lib/modules/reservation/staff';
import StaffClient from './StaffClient';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function Page() {
    const headersList = await headers();
    const siteId = headersList.get('x-site-id');

    if (!siteId) {
        redirect('/admin/login');
    }

    const staff = await getStaffMembers(siteId);
    const serializedStaff = staff.map(s => ({
        ...s,
        createdAt: s.createdAt && typeof s.createdAt === 'object' && 'toMillis' in s.createdAt ? s.createdAt.toMillis() : null
    }));

    return <StaffClient initialStaff={serializedStaff} />;
}
