'use client';

import { useState } from 'react';
import { CheckCircle2, AlertTriangle, MinusCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { useResendStats } from '@/lib/monitoring/useResendStats';
import { LiveModeToggle } from './LiveModeToggle';
import { EmailFailureDrawer } from './EmailFailureDrawer';
import type { EmailFailure } from '@/lib/monitoring/types';

type ResendStatus = 'connected' | 'no_activity' | 'issues';

function getResendStatus(sent: number, failed: number): { status: ResendStatus; label: string; icon: typeof CheckCircle2; color: string } {
    if (sent === 0 && failed === 0) {
        return { status: 'no_activity', label: 'No activity', icon: MinusCircle, color: 'text-gray-400' };
    }
    if (sent === 0 && failed > 0) {
        return { status: 'issues', label: 'Issues', icon: AlertTriangle, color: 'text-red-600' };
    }
    return { status: 'connected', label: 'Connected', icon: CheckCircle2, color: 'text-green-600' };
}

export function ResendTab() {
    const { data, error, loading, updatedAt, refresh } = useResendStats({ window: '24h' });
    const [selected, setSelected] = useState<EmailFailure | null>(null);
    const [activityFilter, setActivityFilter] = useState<'failed' | 'all'>('failed');

    const visibleActivity = activityFilter === 'failed' ? (data?.recentFailures ?? []) : (data?.recentAll ?? []);
    const isFailureRow = (logId: string) => (data?.recentFailures ?? []).some((f) => f.logId === logId);

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
                    <LiveModeToggle onTick={refresh} intervalMs={30_000} paused={!!selected} />
                </div>
                <a
                    href={process.env.NEXT_PUBLIC_RESEND_DASHBOARD_URL || 'https://resend.com/emails'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-brand-dark hover:underline"
                >
                    Open in Resend <ExternalLink className="w-3 h-3" />
                </a>
            </div>

            {error && (
                <div className="mb-4 p-3 border border-red-200 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
            )}

            {data && (
                <>
                    <div className="grid grid-cols-4 gap-3 mb-6">
                        <StatusCard sent={data.summary.sent24h} failed={data.summary.failed24h} />
                        <Card label="Sent 24h" value={data.summary.sent24h.toLocaleString()} />
                        <Card label="Failed 24h" value={data.summary.failed24h.toLocaleString()} />
                        <Card label="Fail rate" value={`${(data.summary.failRate * 100).toFixed(1)}%`} />
                    </div>

                    <h4 className="text-sm font-bold mb-2">Per-tenant</h4>
                    <div className="border rounded-md overflow-hidden bg-white mb-6">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2">Site</th>
                                    <th className="px-4 py-2 text-right">Sent</th>
                                    <th className="px-4 py-2 text-right">Failed</th>
                                    <th className="px-4 py-2 text-right">Rate</th>
                                    <th className="px-4 py-2">Last sent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.perTenant.length === 0 && (
                                    <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No emails sent yet</td></tr>
                                )}
                                {data.perTenant.map((row) => (
                                    <tr key={row.siteId} className="border-t">
                                        <td className="px-4 py-2">
                                            <div className="font-medium">{row.siteName ?? '(deleted)'}</div>
                                            <div className="text-xs text-gray-400">{row.siteId}</div>
                                        </td>
                                        <td className="px-4 py-2 text-right tabular-nums">{row.sent24h.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{row.failed24h.toLocaleString()}</td>
                                        <td className="px-4 py-2 text-right tabular-nums">{(row.failRate * 100).toFixed(1)}%</td>
                                        <td className="px-4 py-2 text-gray-600">
                                            {row.lastSentAt ? new Date(row.lastSentAt).toLocaleString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-bold">
                            {activityFilter === 'failed' ? 'Recent failures' : 'Recent activity'}
                        </h4>
                        <select
                            value={activityFilter}
                            onChange={(e) => setActivityFilter(e.target.value as 'failed' | 'all')}
                            className="text-sm border rounded-md px-2 py-1 bg-white"
                        >
                            <option value="failed">Failed only</option>
                            <option value="all">All</option>
                        </select>
                    </div>
                    <div className="border rounded-md overflow-hidden bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-2">Time</th>
                                    <th className="px-4 py-2">Status</th>
                                    <th className="px-4 py-2">Site</th>
                                    <th className="px-4 py-2">To</th>
                                    <th className="px-4 py-2">Template</th>
                                    <th className="px-4 py-2">Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleActivity.length === 0 && (
                                    <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                                        {activityFilter === 'failed' ? 'No recent failures' : 'No recent activity'}
                                    </td></tr>
                                )}
                                {visibleActivity.map((f) => {
                                    const failed = isFailureRow(f.logId) || activityFilter === 'failed';
                                    return (
                                        <tr key={f.logId} className="border-t cursor-pointer hover:bg-gray-50" onClick={() => setSelected(f)}>
                                            <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                                                {new Date(f.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2">
                                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    failed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                    {failed ? 'failed' : 'success'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2">{f.siteName ?? f.siteId}</td>
                                            <td className="px-4 py-2">{f.to.join(', ')}</td>
                                            <td className="px-4 py-2">{f.templateAlias}</td>
                                            <td className="px-4 py-2 text-red-700 truncate max-w-[200px]">{failed ? (f.error ?? '—') : '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <EmailFailureDrawer failure={selected} onClose={() => setSelected(null)} />
        </div>
    );
}

function Card({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 border rounded-md bg-white">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-xl font-bold">{value}</div>
        </div>
    );
}

function StatusCard({ sent, failed }: { sent: number; failed: number }) {
    const { label, icon: Icon, color } = getResendStatus(sent, failed);
    return (
        <div className="p-4 border rounded-md bg-white">
            <div className="text-xs text-gray-500 mb-1">Status</div>
            <div className="flex items-center gap-1.5">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="font-bold">{label}</span>
            </div>
        </div>
    );
}
