'use client';

import { Suspense, useState } from 'react';
import PageShell from '@/components/PageShell';
import HealthTab from '@/components/monitoring/HealthTab';
import LogsTab from '@/components/monitoring/LogsTab';
import { PostHogTab } from '@/components/monitoring/PostHogTab';
import { ResendTab } from '@/components/monitoring/ResendTab';
import { RegistrationsTab } from '@/components/monitoring/RegistrationsTab';

type Tab = 'health' | 'logs' | 'registrations' | 'posthog' | 'resend';

const TAB_LABELS: Record<Tab, string> = {
    health: 'System Health',
    logs: 'Event Logs',
    registrations: 'Registrations',
    posthog: 'PostHog',
    resend: 'Resend',
};

const TAB_SUBTITLES: Record<Tab, string> = {
    health: 'Service health checks across the platform',
    logs: 'Live event logs from platform_logs',
    registrations: 'Audit trail registrasi (retensi 7 hari)',
    posthog: 'PostHog analytics health and event activity by URL',
    resend: 'Resend email delivery, failures, and per-tenant volume',
};

export default function MonitoringPage() {
    const [activeTab, setActiveTab] = useState<Tab>('health');
    const [logsInitialEvent, setLogsInitialEvent] = useState('');

    const handleSelectService = (eventPrefix: string) => {
        setLogsInitialEvent(eventPrefix);
        setActiveTab('logs');
    };

    const handleSelectIntegration = (id: 'posthog' | 'resend') => {
        setActiveTab(id);
    };

    return (
        <PageShell title="Monitoring" subtitle={TAB_SUBTITLES[activeTab]}>
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                {(Object.keys(TAB_LABELS) as Tab[]).map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                            activeTab === tab
                                ? 'border-brand-dark text-brand-dark'
                                : 'border-transparent text-gray-400 hover:text-gray-700'
                        }`}
                    >
                        {TAB_LABELS[tab]}
                    </button>
                ))}
            </div>

            {activeTab === 'health' && <HealthTab onSelectService={handleSelectService} onSelectIntegration={handleSelectIntegration} />}
            {activeTab === 'logs' && (
                <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading...</div>}>
                    <LogsTab initialEvent={logsInitialEvent} />
                </Suspense>
            )}
            {activeTab === 'registrations' && <RegistrationsTab />}
            {activeTab === 'posthog' && <PostHogTab />}
            {activeTab === 'resend' && <ResendTab />}
        </PageShell>
    );
}
