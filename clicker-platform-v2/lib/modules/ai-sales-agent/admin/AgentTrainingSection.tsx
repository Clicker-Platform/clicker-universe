'use client';

import { useState, useEffect } from 'react';
import { Globe, FileText, Upload, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { toast } from 'sonner';

interface AgentTrainingSectionProps {
    siteId?: string;
}

export function AgentTrainingSection({ siteId }: AgentTrainingSectionProps) {
    const [knowledgeUrls, setKnowledgeUrls] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);

    useEffect(() => {
        if (!siteId) return;

        const unsub = onSnapshot(doc(db, 'sites', siteId, 'modules', 'ai-sales-agent'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setKnowledgeUrls(data.knowledgeUrls || '');
                setLastSync(data.lastKnowledgeSync || null);
            }
        });
        return () => unsub();
    }, [siteId]);

    const handleSaveUrls = async () => {
        if (!siteId) return;
        try {
            await setDoc(doc(db, 'sites', siteId, 'modules', 'ai-sales-agent'), {
                knowledgeUrls
            }, { merge: true });
            toast.success("URLs saved");
        } catch (error) {
            console.error(error);
            toast.error("Failed to save URLs");
        }
    };

    const handleSyncKnowledge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!siteId) {
            toast.error("Site ID missing");
            return;
        }

        const formData = new FormData();
        formData.append('urls', knowledgeUrls || '');
        formData.append('siteId', siteId);

        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
        if (fileInput?.files?.[0]) {
            formData.append('pdfFile', fileInput.files[0]);
        }

        setIsSyncing(true);
        try {
            const res = await fetch('/api/admin/knowledge/sync', {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                await setDoc(doc(db, 'sites', siteId, 'modules', 'ai-sales-agent'), {
                    lastKnowledgeSync: new Date().toISOString()
                }, { merge: true });
            } else {
                toast.error("Sync Failed: " + (data.error || 'Unknown error'));
            }
        } catch (err: any) {
            toast.error("Error: " + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    if (!siteId) {
        return (
            <div className="p-8 text-center text-gray-500 dark:text-neutral-500 bg-gray-50 dark:bg-neutral-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-800">
                Context missing. Cannot load knowledge base.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-lg font-bold">
                            <Database className="w-5 h-5 text-purple-600" />
                            Knowledge Base (RAG)
                        </h3>
                        <p className="text-gray-500 dark:text-neutral-500 text-sm">
                            Train the AI with your website content and PDF documents
                        </p>
                    </div>
                    {lastSync && (
                        <span className="text-xs text-gray-500 dark:text-neutral-500 bg-gray-100 dark:bg-neutral-800 px-2 py-1 rounded-md">
                            Last synced: {new Date(lastSync).toLocaleDateString()}
                        </span>
                    )}
                </div>

                <div className="space-y-6">
                    {/* URL Section */}
                    <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300">
                            <Globe className="w-4 h-4 text-blue-500" />
                            Website URLs
                            <span className="text-xs text-gray-400 dark:text-neutral-600 font-normal">(One per line)</span>
                        </label>
                        <textarea
                            value={knowledgeUrls}
                            onChange={(e) => setKnowledgeUrls(e.target.value)}
                            placeholder="https://example.com/menu&#10;https://example.com/about"
                            className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 focus:border-brand-dark focus:ring-0 outline-none transition font-mono text-sm min-h-[100px]"
                        />
                        <div className="flex justify-end">
                            <button
                                onClick={handleSaveUrls}
                                className="px-4 py-2 text-sm border-2 border-gray-200 dark:border-neutral-700 rounded-lg hover:border-brand-dark transition"
                            >
                                Save URLs Only
                            </button>
                        </div>
                    </div>

                    {/* File Upload Section */}
                    <div className="space-y-3 border-t dark:border-neutral-800 pt-4">
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-neutral-300">
                            <FileText className="w-4 h-4 text-red-500" />
                            Upload PDF Document
                        </label>
                        <div className="bg-gray-50 dark:bg-neutral-800/50 border-2 border-dashed border-gray-200 dark:border-neutral-800 rounded-xl p-6 text-center transition-colors hover:bg-white dark:hover:bg-neutral-800 hover:border-purple-300">
                            <div className="flex flex-col items-center gap-2">
                                <Upload className="w-8 h-8 text-gray-400 dark:text-neutral-600 mb-2" />
                                <label htmlFor="pdf-upload" className="cursor-pointer text-sm font-medium text-purple-600 hover:text-purple-700">
                                    Click to upload PDF
                                </label>
                                <input
                                    id="pdf-upload"
                                    type="file"
                                    accept=".pdf"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) toast.info(`Selected: ${file.name}`);
                                    }}
                                />
                                <p className="text-xs text-gray-400 dark:text-neutral-600">
                                    Upload menus, service lists, or policy documents (Max 10MB)
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sync Button */}
                    <div className="pt-2">
                        <button
                            onClick={handleSyncKnowledge}
                            disabled={isSyncing}
                            className="w-full flex justify-center items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            {isSyncing ? (
                                <>
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    Syncing Knowledge Base...
                                </>
                            ) : (
                                <>
                                    <Database className="h-4 w-4" />
                                    Sync & Retrain Agent
                                </>
                            )}
                        </button>
                        <p className="text-xs text-center text-gray-400 dark:text-neutral-600 mt-2">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            This process extracts text and updates the AI context.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
