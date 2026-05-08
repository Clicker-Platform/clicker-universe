'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    CheckCircle2,
    AlertTriangle,
    XCircle,
    ExternalLink,
    Box,
    MessageSquare,
    Upload,
    ShieldCheck,
    Server,
    Mail,
    BarChart3,
} from 'lucide-react';
import { usePosthogStats } from '@/lib/monitoring/usePosthogStats';
import { useResendStats } from '@/lib/monitoring/useResendStats';

interface ServiceCard {
    id: string;
    label: string;
    icon: typeof Box;
    description: string;
    eventPrefixes: string[];
}

const SERVICES: ServiceCard[] = [
    {
        id: 'modules',
        label: 'Modules',
        icon: Box,
        description: 'POS, Reservation, Membership, Inventory, AI Sales',
        eventPrefixes: ['pos.', 'reservation.', 'service-records.', 'membership.', 'inventory.', 'sales-pipeline.', 'pipeline.', 'service.', 'ai.'],
    },
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: MessageSquare,
        description: 'Webhook, send, command routing',
        eventPrefixes: ['wa.'],
    },
    {
        id: 'upload',
        label: 'Upload & Files',
        icon: Upload,
        description: 'Storage uploads, file operations',
        eventPrefixes: ['upload.'],
    },
    {
        id: 'auth',
        label: 'Auth & Access',
        icon: ShieldCheck,
        description: 'Login, claims, permissions',
        eventPrefixes: ['auth.'],
    },
];


interface ErrorEntry {
    event: string;
    count: number;
}

interface Props {
    onSelectService?: (eventPrefix: string) => void;
    onSelectIntegration?: (id: 'posthog' | 'resend') => void;
}

type Status = 'ok' | 'warning' | 'critical';

export default function HealthTab({ onSelectService, onSelectIntegration }: Props) {
    const [errors, setErrors] = useState<ErrorEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const { data: posthog } = usePosthogStats();
    const { data: resend } = useResendStats({ window: '24h' });

    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'unknown';

    useEffect(() => {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const q = query(
            collection(db, 'platform_logs'),
            where('level', '==', 'error'),
            orderBy('ts', 'desc'),
            limit(500)
        );
        const unsub = onSnapshot(q, snap => {
            const counts = new Map<string, number>();
            snap.docs.forEach(d => {
                const data = d.data();
                const ts: Date | undefined = data.ts?.toDate?.();
                if (!ts || ts < since) return;
                const event: string = data.event || 'unknown';
                counts.set(event, (counts.get(event) || 0) + 1);
            });
            const list: ErrorEntry[] = Array.from(counts.entries()).map(([event, count]) => ({ event, count }));
            setErrors(list);
            setLoading(false);
        }, () => setLoading(false));
        return unsub;
    }, []);

    const serviceStats = useMemo(() => {
        return SERVICES.map(svc => {
            const matched = errors.filter(e =>
                svc.eventPrefixes.some(prefix => e.event.startsWith(prefix))
            );
            const totalCount = matched.reduce((sum, e) => sum + e.count, 0);
            const topEvent = matched.sort((a, b) => b.count - a.count)[0];

            // platform_logs only shows error events — can't prove service is down,
            // so we cap at warning, never critical.
            const status: Status = totalCount === 0 ? 'ok' : 'warning';

            return { ...svc, totalCount, topEvent, status };
        });
    }, [errors]);

    const posthogCard = useMemo(() => {
        if (!posthog) return { status: 'ok' as Status, summary: 'Connecting…', detail: null as string | null };
        if (!posthog.health.reachable) {
            const reason = posthog.health.errorCode === 'auth' ? 'auth failed'
                : posthog.health.errorCode === 'rate_limit' ? 'rate limited'
                : 'unreachable';
            return {
                status: 'critical' as Status,
                summary: 'Disconnected',
                detail: `${reason}${posthog.health.errorMessage ? ` — ${posthog.health.errorMessage}` : ''}`,
            };
        }
        return {
            status: 'ok' as Status,
            summary: 'Connected',
            detail: `${posthog.health.totalEvents24h.toLocaleString()} events`,
        };
    }, [posthog]);

    const resendCard = useMemo(() => {
        if (!resend) return { status: 'ok' as Status, summary: 'Connecting…', detail: null as string | null };
        const { sent24h, failed24h, failRate } = resend.summary;
        if (sent24h === 0 && failed24h === 0) {
            return { status: 'ok' as Status, summary: 'No activity', detail: null };
        }
        if (sent24h === 0 && failed24h > 0) {
            return { status: 'critical' as Status, summary: 'Issues', detail: `${failed24h} failed, 0 sent` };
        }
        const status: Status = failed24h > 0 ? 'warning' : 'ok';
        return {
            status,
            summary: 'Connected',
            detail: failed24h > 0
                ? `${sent24h} sent, ${failed24h} failed (${(failRate * 100).toFixed(1)}%)`
                : `${sent24h} sent`,
        };
    }, [resend]);

    const overallHealth = useMemo(() => {
        const allStatuses: Status[] = [
            ...serviceStats.map(s => s.status),
            posthogCard.status,
            resendCard.status,
        ];
        if (allStatuses.includes('critical')) return { label: 'CRITICAL', color: 'red' };
        if (allStatuses.includes('warning')) return { label: 'WARNING', color: 'yellow' };
        return { label: 'ALL HEALTHY', color: 'green' };
    }, [serviceStats, posthogCard, resendCard]);

    const handleClickService = (prefixes: string[]) => {
        if (onSelectService) {
            onSelectService(prefixes[0]);
        }
    };

    const renderStatusIcon = (status: Status, isLoading = false) => {
        if (isLoading) return <span className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />;
        if (status === 'ok') return <CheckCircle2 className="w-5 h-5 text-green-500" />;
        if (status === 'warning') return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        return <XCircle className="w-5 h-5 text-red-500" />;
    };

    const statusTextClass = (status: Status) =>
        status === 'ok' ? 'text-green-600'
            : status === 'warning' ? 'text-yellow-600'
            : 'text-red-600';

    return (
        <>
            {/* Overall status banner */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            overallHealth.color === 'green' ? 'bg-green-500 animate-pulse' :
                            overallHealth.color === 'yellow' ? 'bg-yellow-400' : 'bg-red-500 animate-pulse'
                        }`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${
                            overallHealth.color === 'green' ? 'text-green-700' :
                            overallHealth.color === 'yellow' ? 'text-yellow-600' : 'text-red-700'
                        }`}>
                            {overallHealth.label}
                        </span>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest bg-brand-dark text-white px-2 py-0.5 rounded-full">
                        {projectId === 'clicker-universe' ? 'PROD' : 'STAGING'}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{projectId}</span>
                </div>
                <p className="text-xs text-gray-400 font-medium">Last 24 hours · Updates live</p>
            </div>

            {/* Service grid (platform_logs based) */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                {serviceStats.map(svc => {
                    const Icon = svc.icon;
                    return (
                        <button
                            key={svc.id}
                            onClick={() => handleClickService(svc.eventPrefixes)}
                            className="bg-white rounded-2xl border-2 border-gray-200 p-5 hover:border-brand-dark transition-colors block group text-left w-full"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="w-9 h-9 rounded-lg bg-slate-50 border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-brand-dark transition-colors">
                                    <Icon className="w-4 h-4" />
                                </div>
                                {renderStatusIcon(svc.status, loading)}
                            </div>
                            <h3 className="font-black text-brand-dark text-sm">{svc.label}</h3>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">{svc.description}</p>
                            <div className="mt-3 flex items-center justify-between text-xs">
                                <span className={`font-bold ${statusTextClass(svc.status)}`}>
                                    {svc.totalCount === 0 ? 'No errors' : `${svc.totalCount} error${svc.totalCount > 1 ? 's' : ''}`}
                                </span>
                                {svc.topEvent && (
                                    <span className="font-mono text-gray-400 truncate ml-2 max-w-[120px]" title={svc.topEvent.event}>
                                        {svc.topEvent.event}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Integrations row (real-time data) */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                <button
                    onClick={() => onSelectIntegration?.('posthog')}
                    className="bg-white rounded-2xl border-2 border-gray-200 p-5 hover:border-brand-dark transition-colors block group text-left w-full"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-brand-dark transition-colors">
                            <BarChart3 className="w-4 h-4" />
                        </div>
                        {renderStatusIcon(posthogCard.status, !posthog)}
                    </div>
                    <h3 className="font-black text-brand-dark text-sm">Analytics (PostHog)</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Live API health & event volume</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <span className={`font-bold ${statusTextClass(posthogCard.status)}`}>{posthogCard.summary}</span>
                        {posthogCard.detail && (
                            <span className="text-gray-400 truncate ml-2 max-w-[180px]" title={posthogCard.detail}>{posthogCard.detail}</span>
                        )}
                    </div>
                </button>

                <button
                    onClick={() => onSelectIntegration?.('resend')}
                    className="bg-white rounded-2xl border-2 border-gray-200 p-5 hover:border-brand-dark transition-colors block group text-left w-full"
                >
                    <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 border border-gray-200 flex items-center justify-center text-gray-500 group-hover:text-brand-dark transition-colors">
                            <Mail className="w-4 h-4" />
                        </div>
                        {renderStatusIcon(resendCard.status, !resend)}
                    </div>
                    <h3 className="font-black text-brand-dark text-sm">Email (Resend)</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5">Delivery success vs. failure (24h)</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                        <span className={`font-bold ${statusTextClass(resendCard.status)}`}>{resendCard.summary}</span>
                        {resendCard.detail && (
                            <span className="text-gray-400 truncate ml-2 max-w-[180px]" title={resendCard.detail}>{resendCard.detail}</span>
                        )}
                    </div>
                </button>
            </div>

            {/* Firebase links */}
            <div className="grid grid-cols-2 gap-4">
                {/* Firebase Console (This Project) */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                            <Server className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-brand-dark text-white px-2 py-0.5 rounded-full">
                            {projectId === 'clicker-universe' ? 'PROD' : 'STAGING'}
                        </span>
                    </div>
                    <h3 className="font-black text-brand-dark text-sm">Firebase Console</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5 mb-3">Project: <span className="font-mono">{projectId}</span></p>
                    <a
                        href={`https://console.firebase.google.com/project/${projectId}/overview`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-gray-200 hover:border-brand-dark text-xs font-black text-brand-dark rounded-lg transition-colors"
                    >
                        Open Console <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                {/* Firebase Status (Global) */}
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
                            <Server className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                            GLOBAL
                        </span>
                    </div>
                    <h3 className="font-black text-brand-dark text-sm">Firebase Status</h3>
                    <p className="text-xs text-gray-400 font-medium mt-0.5 mb-3">Google's official status — check for service outages</p>
                    <a
                        href="https://status.firebase.google.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border-2 border-gray-200 hover:border-brand-dark text-xs font-black text-brand-dark rounded-lg transition-colors"
                    >
                        Open Status <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
            </div>

            {/* Hint */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                <strong>How it works:</strong> Status is computed in real-time from each service. Click any card to drill down for details.
                <span className="block mt-1.5">
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> OK = service running normally</span>
                    <span className="mx-2">·</span>
                    <span className="inline-flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Warning = some anomalies, service still running</span>
                    <span className="mx-2">·</span>
                    <span className="inline-flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Critical = service down / unreachable</span>
                </span>
            </div>
        </>
    );
}
