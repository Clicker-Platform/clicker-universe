'use client';

import Sidebar from '@/components/Sidebar';
import { Activity, Construction } from 'lucide-react';

export default function MonitoringPage() {
    return (
        <div className="min-h-screen bg-gray-50/50 flex font-sans">
            <Sidebar />
            <div className="flex-1 ml-64 p-8">
                <header className="mb-8">
                    <h1 className="text-3xl font-black text-brand-dark flex items-center gap-3">
                        <Activity className="w-8 h-8" />
                        SYSTEM PULSE
                    </h1>
                    <p className="text-gray-500 font-medium">Platform Health & Telemetry</p>
                </header>

                {/* Coming Soon Placeholder */}
                <div className="bg-white rounded-3xl border-[3px] border-gray-200 p-12 flex flex-col items-center justify-center text-center max-w-xl mx-auto">
                    <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-lg flex items-center justify-center mb-6">
                        <Construction className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-brand-dark mb-2">Coming Soon</h2>
                    <p className="text-gray-500 font-medium">
                        Real-time system monitoring and log streaming will be available in a future update.
                    </p>
                </div>
            </div>
        </div>
    );
}
