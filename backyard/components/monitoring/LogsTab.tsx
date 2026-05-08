'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, AlertTriangle, RefreshCw, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { useMonitoringLogs, PlatformLog } from '@/lib/useMonitoringLogs';

const monitoringFunctions = getFunctions(app, 'asia-southeast1');

interface CleanupResult {
    deletedPlatformLogs: number;
    deletedEmailLogs: number;
    durationMs: number;
}

function timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function LogCard({ log }: { log: PlatformLog }) {
    const [expanded, setExpanded] = useState(false);
    const isError = log.level === 'error';
    const date = log.ts.toDate();

    return (
        <div
            className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                isError
                    ? 'border-red-200 bg-red-50/50 hover:bg-red-50'
                    : 'border-amber-200 bg-amber-50/50 hover:bg-amber-50'
            }`}
            onClick={() => setExpanded(!expanded)}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 min-w-0">
                    {isError ? (
                        <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                    ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    )}
                    <span className={`text-xs font-bold uppercase ${isError ? 'text-red-600' : 'text-amber-600'}`}>
                        {log.level}
                    </span>
                    <span className="font-mono text-sm font-semibold text-gray-800 truncate">{log.event}</span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{timeAgo(date)}</span>
            </div>

            <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                <span>Tenant: <span className="font-medium text-gray-700">{log.siteId}</span></span>
                <span>·</span>
                <span>{log.service}</span>
                {log.count && log.count > 1 && (
                    <>
                        <span>·</span>
                        <span className="font-medium text-gray-700">{log.count}x in 5 min</span>
                    </>
                )}
            </div>

            {!!log.meta?.error && (
                <p className="mt-1 text-xs text-gray-600 font-mono truncate">
                    {String(log.meta.error)}
                </p>
            )}

            {expanded && log.meta && Object.keys(log.meta).length > 0 && (
                <pre className="mt-3 text-xs bg-white rounded-lg p-3 border border-gray-100 overflow-auto max-h-40 text-gray-700">
                    {JSON.stringify(log.meta, null, 2)}
                </pre>
            )}
        </div>
    );
}

interface Props {
    initialEvent?: string;
    initialSiteId?: string;
}

export default function LogsTab({ initialEvent = '', initialSiteId = '' }: Props) {
    const searchParams = useSearchParams();
    const [filterSiteId, setFilterSiteId] = useState(initialSiteId);
    const [filterLevel, setFilterLevel] = useState<'error' | 'warn' | ''>('');
    const [filterEvent, setFilterEvent] = useState(initialEvent);

    // Pre-fill filter from URL params (e.g. /monitoring?event=wa.)
    useEffect(() => {
        const eventParam = searchParams.get('event');
        if (eventParam) setFilterEvent(eventParam);
        const siteParam = searchParams.get('siteId');
        if (siteParam) setFilterSiteId(siteParam);
    }, [searchParams]);

    // Update when initialEvent prop changes (from parent tab switch)
    useEffect(() => {
        if (initialEvent) setFilterEvent(initialEvent);
    }, [initialEvent]);

    useEffect(() => {
        if (initialSiteId) setFilterSiteId(initialSiteId);
    }, [initialSiteId]);

    const { logs, loading, error } = useMonitoringLogs({
        siteId: filterSiteId || undefined,
        level: filterLevel || undefined,
        event: filterEvent || undefined,
    });

    const errorCount = logs.filter(l => l.level === 'error').length;
    const warnCount = logs.filter(l => l.level === 'warn').length;

    const [cleanupRunning, setCleanupRunning] = useState(false);
    const [cleanupMessage, setCleanupMessage] = useState<string | null>(null);

    const handleCleanup = async () => {
        const ok = window.confirm(
            'Clear old event logs?\n\n' +
            'This will permanently delete platform_logs older than 7 days from Firestore.\n\n' +
            'Recent logs will not be affected. Email logs are not touched.'
        );
        if (!ok) return;

        setCleanupRunning(true);
        setCleanupMessage(null);
        try {
            const callable = httpsCallable<{ target: 'platform_logs' }, CleanupResult>(
                monitoringFunctions,
                'triggerRetentionCleanup'
            );
            const resp = await callable({ target: 'platform_logs' });
            setCleanupMessage(
                `Cleanup done — deleted ${resp.data.deletedPlatformLogs} platform logs.`
            );
        } catch (err) {
            setCleanupMessage(
                `Cleanup failed: ${err instanceof Error ? err.message : String(err)}`
            );
        } finally {
            setCleanupRunning(false);
        }
    };

    return (
        <>
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={handleCleanup}
                    disabled={cleanupRunning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:border-red-300 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 disabled:cursor-wait transition-colors"
                >
                    <Trash2 className={`w-3.5 h-3.5 ${cleanupRunning ? 'animate-pulse' : ''}`} />
                    {cleanupRunning ? 'Running cleanup…' : 'Run cleanup'}
                </button>
                <div className="flex items-center text-xs text-gray-400">
                    <RefreshCw className={`w-3 h-3 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    {loading ? 'Loading...' : 'Live'}
                </div>
            </div>

            {cleanupMessage && (
                <div className="mb-4 p-3 border border-gray-200 bg-gray-50 text-sm text-gray-700 rounded-md">
                    {cleanupMessage}
                </div>
            )}

            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 font-medium">Status</p>
                    <div className="flex items-center gap-1.5 mt-1">
                        {loading && !error ? (
                            <>
                                <span className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
                                <span className="text-base font-bold text-gray-500">Connecting…</span>
                            </>
                        ) : error ? (
                            <>
                                <XCircle className="w-4 h-4 text-red-600" />
                                <span className="text-base font-bold text-red-600">Disconnected</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                                <span className="text-base font-bold text-green-600">Connected</span>
                            </>
                        )}
                    </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-4">
                    <p className="text-xs text-gray-500 font-medium">Total Events</p>
                    <p className="text-2xl font-black text-brand-dark">{logs.length}</p>
                </div>
                <div className="bg-white rounded-2xl border border-red-100 p-4">
                    <p className="text-xs text-red-500 font-medium">Errors</p>
                    <p className="text-2xl font-black text-red-600">{errorCount}</p>
                </div>
                <div className="bg-white rounded-2xl border border-amber-100 p-4">
                    <p className="text-xs text-amber-500 font-medium">Warnings</p>
                    <p className="text-2xl font-black text-amber-600">{warnCount}</p>
                </div>
            </div>

            <div className="flex gap-3 mb-6">
                <input
                    type="text"
                    placeholder="Filter by siteId..."
                    value={filterSiteId}
                    onChange={(e) => setFilterSiteId(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                />
                <select
                    value={filterLevel}
                    onChange={(e) => setFilterLevel(e.target.value as 'error' | 'warn' | '')}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                >
                    <option value="">All levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warn</option>
                </select>
                <input
                    type="text"
                    placeholder="Event name (prefix or exact, e.g. wa.)"
                    value={filterEvent}
                    onChange={(e) => setFilterEvent(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                />
            </div>

            <div className="space-y-3">
                {loading && (
                    <div className="text-center text-gray-400 py-12">Loading logs...</div>
                )}
                {error && (
                    <div className="text-center text-red-500 py-12">{error}</div>
                )}
                {!loading && !error && logs.length === 0 && (
                    <div className="text-center text-gray-400 py-12">
                        No logs found. Platform is healthy or no events match filter.
                    </div>
                )}
                {logs.map((log) => (
                    <LogCard key={log.id} log={log} />
                ))}
            </div>
        </>
    );
}
