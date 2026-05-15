'use client';

import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Database, Loader2, Play } from 'lucide-react';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

export default function SeedTool() {
    const [siteId, setSiteId] = useState('');
    const [loading, setLoading] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const handleSeed = (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteId) {
            toast.warning('Target Required', { description: 'Please enter a Site ID to seed.' });
            return;
        }
        setConfirmOpen(true);
    };

    const confirmSeed = async () => {
        setConfirmOpen(false);
        setLoading(true);
        try {
            const seedFn = httpsCallable(functions, 'seedSiteData');
            await seedFn({ siteId });
            toast.success('Seeding Complete', { description: `Data for ${siteId} has been reset/seeded.` });
            setSiteId('');
        } catch (error: unknown) {
            toast.error('Seeding Failed', { description: error instanceof Error ? error.message : String(error) });
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="bg-white rounded-3xl border border-gray-100 p-8 hover:shadow-lg transition-all relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-brand-dark">Seed Site Data</h2>
                            <p className="text-gray-400 font-medium text-xs uppercase tracking-wider">Developer Tools</p>
                        </div>
                    </div>

                    <form onSubmit={handleSeed} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">Target Site ID</label>
                            <input
                                type="text"
                                value={siteId}
                                onChange={(e) => setSiteId(e.target.value)}
                                placeholder="e.g. demo-site"
                                className="w-full px-4 py-3 rounded-lg border-2 border-gray-100 focus:border-brand-dark outline-none font-medium text-gray-900 bg-gray-50/50 transition-colors"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Seeding...
                                </>
                            ) : (
                                <>
                                    <Play className="w-5 h-5 fill-current" />
                                    Run Seeder
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>

            <ConfirmationDialog
                isOpen={confirmOpen}
                onCancel={() => setConfirmOpen(false)}
                onConfirm={confirmSeed}
                title="Reset Site Data"
                description={`WARNING: This will reset all data for site "${siteId}". This cannot be undone.`}
                variant="danger"
            />
        </>
    );
}
