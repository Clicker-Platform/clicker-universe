'use client';

import { Suspense, useState } from 'react';
import PageShell from '@/components/PageShell';
import HealthTab from '@/components/monitoring/HealthTab';
import LogsTab from '@/components/monitoring/LogsTab';

type Tab = 'health' | 'logs';

export default function MonitoringPage() {
    const [activeTab, setActiveTab] = useState<Tab>('health');
    const [logsInitialEvent, setLogsInitialEvent] = useState('');

    const handleSelectService = (eventPrefix: string) => {
        setLogsInitialEvent(eventPrefix);
        setActiveTab('logs');
    };

    return (
        <PageShell
            title="Monitoring"
            subtitle={activeTab === 'health' ? 'Service health checks across the platform' : 'Live event logs from platform_logs'}
        >
            <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
                <button
                    onClick={() => setActiveTab('health')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                        activeTab === 'health'
                            ? 'border-brand-dark text-brand-dark'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                >
                    System Health
                </button>
                <button
                    onClick={() => setActiveTab('logs')}
                    className={`px-4 py-2.5 text-sm font-bold transition-colors border-b-2 -mb-[2px] ${
                        activeTab === 'logs'
                            ? 'border-brand-dark text-brand-dark'
                            : 'border-transparent text-gray-400 hover:text-gray-700'
                    }`}
                >
                    Event Logs
                </button>
            </div>

            {activeTab === 'health' ? (
                <HealthTab onSelectService={handleSelectService} />
            ) : (
                <Suspense fallback={<div className="text-center py-12 text-gray-400">Loading...</div>}>
                    <LogsTab initialEvent={logsInitialEvent} />
                </Suspense>
            )}
        </PageShell>
    );
}
