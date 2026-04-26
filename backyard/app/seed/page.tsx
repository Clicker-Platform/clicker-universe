'use client';

import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { functions, db } from '@/lib/firebase';
import { toast } from 'sonner';
import { SYSTEM_MODULES } from '@/lib/modules/definitions';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import PageShell from '@/components/PageShell';
import { Loader2, Play } from 'lucide-react';

interface Tenant { id: string; name: string; }
interface SeedRecord { tenantId: string; tenantName: string; moduleId: string; ts: string; status: 'success' | 'error'; }

export default function SeedPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [selectedTenant, setSelectedTenant] = useState('');
    const [selectedModule, setSelectedModule] = useState(SYSTEM_MODULES[0]?.id ?? '');
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [history, setHistory] = useState<SeedRecord[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    useEffect(() => {
        const fetchTenants = async () => {
            try {
                const fn = httpsCallable(functions, 'getTenants');
                const res: any = await fn();
                const list = res.data.list ?? [];
                setTenants(list);
                if (list.length > 0) setSelectedTenant(list[0].id);
            } catch {
                toast.error('Failed to load tenants');
            }
        };

        const fetchHistory = async () => {
            try {
                const ref = doc(db, 'platform_meta', 'seed_history');
                const snap = await getDoc(ref);
                if (snap.exists()) {
                    const entries: SeedRecord[] = (snap.data().entries ?? []).slice(-20).reverse();
                    setHistory(entries);
                }
            } catch {
                // non-critical
            } finally {
                setHistoryLoading(false);
            }
        };

        fetchTenants();
        fetchHistory();
    }, []);

    const handleSeed = () => {
        if (!selectedTenant) {
            toast.warning('Select a tenant first');
            return;
        }
        setConfirmOpen(true);
    };

    const [syncingRegistry, setSyncingRegistry] = useState(false);

    const syncSystemModules = async () => {
        setSyncingRegistry(true);
        try {
            // Write each system module to the global /modules/{id} registry
            // so subscribeToEnabledModules() in clicker-platform-v2 picks them up.
            await Promise.all(
                SYSTEM_MODULES.map(mod =>
                    setDoc(
                        doc(db, 'modules', mod.id),
                        {
                            id: mod.id,
                            displayName: mod.displayName,
                            description: mod.description ?? '',
                            icon: mod.icon ?? '',
                            version: mod.version ?? '1.0.0',
                            enabled: true,
                            adminRoutes: mod.adminRoutes ?? [],
                            publicRoutes: mod.publicRoutes ?? [],
                        },
                        { merge: true }
                    )
                )
            );
            toast.success(`Synced ${SYSTEM_MODULES.length} modules to global registry`);
        } catch (err: any) {
            toast.error('Sync failed', { description: err.message });
        } finally {
            setSyncingRegistry(false);
        }
    };

    const confirmSeed = async () => {
        setConfirmOpen(false);
        setLoading(true);
        const tenant = tenants.find(t => t.id === selectedTenant);
        const moduleLabel = SYSTEM_MODULES.find(m => m.id === selectedModule)?.displayName ?? selectedModule;

        try {
            const fn = httpsCallable(functions, 'seedSiteData');
            await fn({ siteId: selectedTenant });
            toast.success('Seed complete', { description: `${moduleLabel} data seeded for ${tenant?.name}` });

            const record: SeedRecord = {
                tenantId: selectedTenant,
                tenantName: tenant?.name ?? selectedTenant,
                moduleId: selectedModule,
                ts: new Date().toISOString(),
                status: 'success',
            };
            await setDoc(doc(db, 'platform_meta', 'seed_history'), { entries: arrayUnion(record) }, { merge: true });
            setHistory(prev => [record, ...prev].slice(0, 20));
        } catch (err: any) {
            toast.error('Seed failed', { description: err.message });
            const record: SeedRecord = {
                tenantId: selectedTenant,
                tenantName: tenant?.name ?? selectedTenant,
                moduleId: selectedModule,
                ts: new Date().toISOString(),
                status: 'error',
            };
            setHistory(prev => [record, ...prev].slice(0, 20));
        } finally {
            setLoading(false);
        }
    };

    return (
        <PageShell title="Seed Tools" subtitle="Seed sample data ke tenant">
            <div className="grid grid-cols-2 gap-4 mb-6 max-w-xl">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">1. Pilih Tenant</p>
                    <select
                        value={selectedTenant}
                        onChange={e => setSelectedTenant(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-brand-dark"
                    >
                        {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-wider mb-2">2. Pilih Modul</p>
                    <select
                        value={selectedModule}
                        onChange={e => setSelectedModule(e.target.value)}
                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-brand-dark"
                    >
                        {SYSTEM_MODULES.map(m => <option key={m.id} value={m.id}>{m.displayName}</option>)}
                    </select>
                </div>
            </div>

            <div className="flex flex-wrap gap-3 mb-8">
                <button
                    onClick={handleSeed}
                    disabled={loading || !selectedTenant}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-green text-brand-dark font-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {loading ? 'Seeding...' : 'Run Seed'}
                </button>

                <button
                    onClick={syncSystemModules}
                    disabled={syncingRegistry}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white font-black rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                    title="Write all SYSTEM_MODULES to /modules registry (required before tenants can enable them)"
                >
                    {syncingRegistry ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {syncingRegistry ? 'Syncing...' : 'Sync System Modules to Registry'}
                </button>
            </div>

            <div>
                <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-3">Seed History</h2>
                {historyLoading ? (
                    <div className="text-sm text-gray-400">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="text-sm text-gray-400">No seed history yet.</div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden max-w-xl">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Tenant</th>
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Module</th>
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Time</th>
                                    <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((r, i) => (
                                    <tr key={i} className="border-b border-gray-50">
                                        <td className="px-5 py-3 font-semibold text-gray-700">{r.tenantName}</td>
                                        <td className="px-5 py-3 font-mono text-xs text-indigo-600">{r.moduleId}</td>
                                        <td className="px-5 py-3 text-gray-400 text-xs">{new Date(r.ts).toLocaleString('id-ID')}</td>
                                        <td className="px-5 py-3">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                r.status === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                                            }`}>
                                                {r.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={confirmSeed}
                title="Run Seed?"
                description={`Seed ${SYSTEM_MODULES.find(m => m.id === selectedModule)?.displayName ?? selectedModule} data ke tenant ${tenants.find(t => t.id === selectedTenant)?.name ?? selectedTenant}? Data lama mungkin akan ditimpa.`}
            />
        </PageShell>
    );
}
