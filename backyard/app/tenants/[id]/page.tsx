'use client';

import { useState, useEffect, use } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import TenantInfoCard from '@/components/tenant/TenantInfoCard';
import TenantModulesCard from '@/components/tenant/TenantModulesCard';
import TenantMembersCard from '@/components/tenant/TenantMembersCard';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    ownerEmail: string;
    status: 'active' | 'suspended';
    modules: Record<string, boolean>;
}

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [tenant, setTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                const found = (res.data.list ?? []).find((t: any) => t.id === id);
                if (found) setTenant(found);
                else toast.error('Tenant not found');
            } catch (err: any) {
                toast.error('Failed to load tenant', { description: err.message });
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [id]);

    if (loading) {
        return <PageShell title="Loading..."><div className="text-center py-16 text-gray-400">Loading tenant...</div></PageShell>;
    }

    if (!tenant) {
        return <PageShell title="Not Found"><div className="text-center py-16 text-gray-400">Tenant not found.</div></PageShell>;
    }

    return (
        <PageShell
            title={tenant.name}
            subtitle={`ID: ${tenant.id}`}
            action={
                <Link href="/tenants" className="flex items-center gap-1.5 text-sm font-bold text-gray-500 hover:text-brand-dark transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Tenants
                </Link>
            }
        >
            <div className="grid grid-cols-2 gap-6">
                <TenantInfoCard
                    tenant={tenant}
                    onSlugUpdate={(newSlug) => setTenant(prev => prev ? { ...prev, slug: newSlug } : prev)}
                />
                <TenantModulesCard
                    tenant={tenant}
                    onModulesUpdate={(modules) => setTenant(prev => prev ? { ...prev, modules } : prev)}
                />
                <TenantMembersCard siteId={tenant.id} siteModules={tenant.modules || {}} />
            </div>
        </PageShell>
    );
}
