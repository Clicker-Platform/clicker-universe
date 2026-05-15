'use client';

import { useState, useEffect } from 'react';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import PageShell from '@/components/PageShell';
import { Loader2, RefreshCw, Database, HardDrive, CheckCircle2 } from 'lucide-react';

interface SyncTrigger {
    id: string;
    icon: typeof Database;
    label: string;
    description: string;
    type: 'firestore' | 'storage';
}

const TRIGGERS: SyncTrigger[] = [
    {
        id: 'syncGoFirestore',
        icon: Database,
        label: 'Firestore Level 1',
        description: 'sites/go/{col}/{docId} — top-level docs',
        type: 'firestore',
    },
    {
        id: 'syncGoFirestoreDeep',
        icon: Database,
        label: 'Firestore Level 2',
        description: 'sites/go/{col}/{docId}/{subCol}/{subDocId} — nested',
        type: 'firestore',
    },
    {
        id: 'syncGoFirestoreLevel3',
        icon: Database,
        label: 'Firestore Level 3',
        description: 'Deep nested collections (3 levels)',
        type: 'firestore',
    },
    {
        id: 'syncGoStorageUpload',
        icon: HardDrive,
        label: 'Storage Upload',
        description: 'Mirrors uploaded files to production storage',
        type: 'storage',
    },
    {
        id: 'syncGoStorageDelete',
        icon: HardDrive,
        label: 'Storage Delete',
        description: 'Mirrors file deletions to production storage',
        type: 'storage',
    },
];

export default function SyncControlPage() {
    const [triggering, setTriggering] = useState(false);
    const [lastTriggered, setLastTriggered] = useState<Date | null>(null);

    useEffect(() => {
        const ref = doc(db, 'sites', 'go', '_sync_meta', 'manual_trigger');
        const unsub = onSnapshot(ref, snap => {
            if (snap.exists()) {
                const data = snap.data();
                const ts = data.ts?.toDate?.();
                if (ts) setLastTriggered(ts);
            }
        }, () => { /* non-critical */ });
        return unsub;
    }, []);

    const handleTrigger = async () => {
        setTriggering(true);
        try {
            await setDoc(doc(db, 'sites', 'go', '_sync_meta', 'manual_trigger'), {
                ts: serverTimestamp(),
                triggeredAt: new Date().toISOString(),
            }, { merge: true });
            toast.success('Sync triggered', {
                description: 'syncGoFirestore should pick this up within seconds.',
            });
        } catch (err: unknown) {
            toast.error('Trigger failed', { description: err instanceof Error ? err.message : String(err) });
        } finally {
            setTriggering(false);
        }
    };

    return (
        <PageShell
            title="Sync Control"
            subtitle="Staging → Production sync (sites/go) — automatic via Firestore triggers"
            action={
                <button
                    onClick={handleTrigger}
                    disabled={triggering}
                    className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white text-sm font-black rounded-xl hover:opacity-90 disabled:opacity-50"
                >
                    {triggering ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    {triggering ? 'Triggering...' : 'Force Manual Sync'}
                </button>
            }
        >
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Auto Sync</p>
                    <p className="text-2xl font-black text-green-600 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-5 h-5" />
                        Active
                    </p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Triggers Deployed</p>
                    <p className="text-2xl font-black text-brand-dark mt-1">{TRIGGERS.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Last Manual Trigger</p>
                    <p className="text-sm font-bold text-brand-dark mt-2">
                        {lastTriggered ? lastTriggered.toLocaleString('id-ID') : '—'}
                    </p>
                </div>
            </div>

            <h2 className="text-xs font-black text-brand-dark uppercase tracking-wider mb-3">Active Sync Triggers</h2>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="border-b border-gray-100 bg-slate-50">
                        <tr>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Function</th>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Type</th>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Pattern</th>
                            <th className="text-left px-5 py-3 text-xs font-black text-brand-dark uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {TRIGGERS.map(t => {
                            const Icon = t.icon;
                            return (
                                <tr key={t.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-4 h-4 text-gray-400" />
                                            <span className="font-mono text-xs text-indigo-600">{t.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3">
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                            t.type === 'firestore'
                                                ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                : 'bg-purple-50 text-purple-700 border-purple-100'
                                        }`}>{t.type}</span>
                                    </td>
                                    <td className="px-5 py-3 text-xs text-gray-500 font-mono">{t.description}</td>
                                    <td className="px-5 py-3">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-100">
                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                            Listening
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700 max-w-2xl">
                <strong>Note:</strong> Sync runs automatically when documents change in <code className="font-mono">sites/go/*</code>.
                Use &quot;Force Manual Sync&quot; only when production data appears stale and you suspect a missed event.
            </div>
        </PageShell>
    );
}
