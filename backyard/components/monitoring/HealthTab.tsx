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
    Bot,
    Upload,
    ShieldCheck,
    Server,
} from 'lucide-react';

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
        description: 'POS, Reservation, Membership, Inventory',
        eventPrefixes: ['pos.', 'reservation.', 'service-records.', 'membership.', 'inventory.', 'sales-pipeline.', 'pipeline.', 'service.'],
    },
    {
        id: 'whatsapp',
        label: 'WhatsApp',
        icon: MessageSquare,
        description: 'Webhook, send, command routing',
        eventPrefixes: ['wa.'],
    },
    {
        id: 'ai',
        label: 'AI Sales',
        icon: Bot,
        description: 'Chatbot, lead capture',
        eventPrefixes: ['ai.'],
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
    {
        id: 'core',
        label: 'Platform Core',
        icon: Server,
        description: 'Firestore, middleware, admin',
        eventPrefixes: ['admin.', 'analytics.', 'cache.', 'form.', 'template.', 'registry.', 'nav.', 'team.', 'crm.', 'user.', 'content.', 'knowledge.', 'firestore.', 'firebase.', 'middleware.', 'fetch.'],
    },
];

interface ErrorEntry {
    event: string;
    count: number;
}

interface Props {
    onSelectService?: (eventPrefix: string) => void;
}

export default function HealthTab({ onSelectService }: Props) {
    const [errors, setErrors] = useState<ErrorEntry[]>([]);
    const [loading, setLoading] = useState(true);

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

            let status: 'ok' | 'warning' | 'critical';
            if (totalCount === 0) status = 'ok';
            else if (totalCount <= 5) status = 'warning';
            else status = 'critical';

            return { ...svc, totalCount, topEvent, status };
        });
    }, [errors]);

    const overallHealth = useMemo(() => {
        const critical = serviceStats.filter(s => s.status === 'critical').length;
        const warning = serviceStats.filter(s => s.status === 'warning').length;
        if (critical > 0) return { label: 'CRITICAL', color: 'red' };
        if (warning > 0) return { label: 'DEGRADED', color: 'amber' };
        return { label: 'ALL HEALTHY', color: 'green' };
    }, [serviceStats]);

    const handleClickService = (prefixes: string[]) => {
        if (onSelectService) {
            onSelectService(prefixes[0]);
        }
    };

    return (
        <>
            {/* Overall status banner */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                            overallHealth.color === 'green' ? 'bg-green-500 animate-pulse' :
                            overallHealth.color === 'amber' ? 'bg-amber-500' : 'bg-red-500 animate-pulse'
                        }`} />
                        <span className={`text-xs font-black uppercase tracking-widest ${
                            overallHealth.color === 'green' ? 'text-green-700' :
                            overallHealth.color === 'amber' ? 'text-amber-700' : 'text-red-700'
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

            {/* Service grid */}
            <div className="grid grid-cols-3 gap-4 mb-6">
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
                                {loading ? (
                                    <span className="w-3 h-3 rounded-full bg-gray-200 animate-pulse" />
                                ) : svc.status === 'ok' ? (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                ) : svc.status === 'warning' ? (
                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                            </div>
                            <h3 className="font-black text-brand-dark text-sm">{svc.label}</h3>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">{svc.description}</p>
                            <div className="mt-3 flex items-center justify-between text-xs">
                                <span className={`font-bold ${
                                    svc.status === 'ok' ? 'text-green-600' :
                                    svc.status === 'warning' ? 'text-amber-600' : 'text-red-600'
                                }`}>
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
                <strong>How it works:</strong> Status is computed from <code className="font-mono">platform_logs</code> in last 24h. Click any card to drill down to specific events in Logs tab.
                <span className="block mt-1.5">
                    <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3" /> OK = 0 errors</span>
                    <span className="mx-2">·</span>
                    <span className="inline-flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Warning = 1–5</span>
                    <span className="mx-2">·</span>
                    <span className="inline-flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Critical = 6+</span>
                </span>
            </div>
        </>
    );
}
