'use client';

import Sidebar from '@/components/Sidebar';
import { Bot } from 'lucide-react';
import { ModelRegistry } from './_components/ModelRegistry';
import { PricingPanel } from './_components/PricingPanel';
import { CreditOverview } from './_components/CreditOverview';
import { UsageLog } from './_components/UsageLog';

export default function AiSettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50/50 flex font-sans">
      <Sidebar />
      <div className="flex-1 ml-64 p-8">
        <header className="mb-8">
          <h1 className="text-3xl font-black flex items-center gap-3">
            <Bot className="w-8 h-8" />
            AI SETTINGS
          </h1>
          <p className="text-gray-500 font-medium">Model registry, credit management &amp; usage logs</p>
        </header>

        <div className="space-y-8">
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Models</h2>
            <ModelRegistry />
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Pricing</h2>
            <PricingPanel />
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Credits</h2>
            <CreditOverview />
          </section>

          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Usage Log</h2>
            <UsageLog />
          </section>
        </div>
      </div>
    </div>
  );
}
