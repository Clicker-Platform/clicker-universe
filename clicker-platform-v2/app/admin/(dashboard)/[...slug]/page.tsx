import { findModuleForAdminRoute, getRouteIdFromPath } from '@/lib/modules/registry';
import { ModuleLoader } from '@/components/modules/ModuleLoader';
import { PermissionGuard } from '@/components/admin/PermissionGuard';
import { notFound } from 'next/navigation';

type Props = {
    params: Promise<{ slug: string[] }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Helper: Resolve path from slug array
const getPath = (slug: string[]) => `/admin/${slug.join('/')}`;

export async function generateMetadata({ params }: Props) {
    const { slug } = await params;
    const path = getPath(slug);

    const moduleMatch = await findModuleForAdminRoute(path);

    if (moduleMatch) {
        return {
            title: `${moduleMatch.route.label} | Admin`,
        };
    }

    return {};
}

export default async function AdminCatchAllPage({ params, searchParams }: Props) {
    const resolvedParams = await params;
    const resolvedSearchParams = await searchParams;
    const { slug } = resolvedParams;
    const path = getPath(slug);

    const moduleMatch = await findModuleForAdminRoute(path);

    if (moduleMatch && moduleMatch.route.componentKey) {
        // Extract route ID for permission check
        // e.g., /admin/pos/cashier -> cashier
        const routeId = getRouteIdFromPath(moduleMatch.module.id, path);

        return (
            <PermissionGuard moduleId={moduleMatch.module.id} routeId={routeId}>
                <ModuleLoader
                    componentKey={moduleMatch.route.componentKey}
                    params={resolvedParams}
                    searchParams={resolvedSearchParams}
                />
            </PermissionGuard>
        );
    }

    // Default legacy behavior: if no module is found, 404. 
    // Wait! Since this is a catch-all inside `admin/(dashboard)`, it might conflict 
    // if existing folders are not moved yet.
    // However, Next.js File priorities: 
    // `admin/pos/page.tsx` > `admin/[...slug]/page.tsx`
    // So existing pages will continue to work until we delete them.

    notFound();
}
