'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { usePosthogStats } from '@/lib/monitoring/usePosthogStats';
import { LiveModeToggle } from './LiveModeToggle';

const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

function formatRelative(iso: string | null): string {
    if (!iso) return '—';
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

function shortUrl(url: string | null): string {
    if (!url) return '—';
    try {
        const u = new URL(url);
        return u.pathname + u.search;
    } catch {
        return url;
    }
}

export function PostHogTab() {
    const { data, error, loading, updatedAt, refresh } = usePosthogStats();
    const [eventFilter, setEventFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

    const allEvents = Array.from(new Set((data?.perActivity ?? []).map((r) => r.event))).sort();
    const visibleActivity = (data?.perActivity ?? [])
        .filter((row) => eventFilter === 'all' || row.event === eventFilter)
        .slice()
        .sort((a, b) => sortOrder === 'desc' ? b.count - a.count : a.count - b.count);

    return (
        <div>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={refresh}
                        disabled={loading}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    <span className="text-xs text-gray-500">
                        Last updated: {updatedAt ? updatedAt.toLocaleTimeString() : '—'}
                    </span>
                    <LiveModeToggle onTick={refresh} intervalMs={30_000} paused={false} />
                    <select
                        value={eventFilter}
                        onChange={(e) => setEventFilter(e.target.value)}
                        className="text-sm border rounded-md px-2 py-1 bg-white"
                    >
                        <option value="all">All events</option>
                        {allEvents.map((ev) => (
                            <option key={ev} value={ev}>{ev}</option>
                        ))}
                    </select>
                    <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as 'desc' | 'asc')}
                        className="text-sm border rounded-md px-2 py-1 bg-white"
                    >
                        <option value="desc">Top count</option>
                        <option value="asc">Lowest count</option>
                    </select>
                </div>
                <a
                    href={POSTHOG_HOST}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand-dark hover:underline"
                >
                    Open in PostHog <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {error && (
                <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md">
                    {error}
                </div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="p-4 border rounded-md bg-white">
                            <div className="text-xs text-gray-500 mb-1">Status</div>
                            <div className="flex items-center gap-1.5">
                                {data.health.reachable ? (
                                    <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="font-bold">Connected</span></>
                                ) : (
                                    <><XCircle className="w-4 h-4 text-red-600" /><span className="font-bold">Disconnected</span></>
                                )}
                            </div>
                            {data.health.errorMessage && <div className="text-xs text-red-600 mt-1">{data.health.errorMessage}</div>}
                        </div>
                        <div className="p-4 border rounded-md bg-white">
                            <div className="text-xs text-gray-500 mb-1">Events 24h</div>
                            <div className="text-xl font-bold">{data.health.totalEvents24h.toLocaleString()}</div>
                        </div>
                        <div className="p-4 border rounded-md bg-white">
                            <div className="text-xs text-gray-500 mb-1">Last event</div>
                            <div className="text-xl font-bold">{formatRelative(data.health.lastEventAt)}</div>
                        </div>
                    </div>

                    <div className="border rounded-md overflow-hidden bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2">Event</th>
                                    <th className="px-4 py-2">URL</th>
                                    <th className="px-4 py-2 text-right">Count 24h</th>
                                    <th className="px-4 py-2">Last seen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleActivity.length === 0 && (
                                    <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No activity</td></tr>
                                )}
                                {visibleActivity.map((row, i) => (
                                    <tr key={`${row.event}::${row.url}::${i}`} className="border-t">
                                        <td className="px-4 py-2 font-medium">{row.event}</td>
                                        <td className="px-4 py-2 text-gray-600 truncate max-w-[320px]" title={row.url ?? ''}>
                                            {shortUrl(row.url)}
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-gray-600">{formatRelative(row.lastSeenAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
