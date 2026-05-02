'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { ModuleDefinition } from '@/lib/modules/types';

interface Props {
  businessName: string;
  activeModules: ModuleDefinition[];
  baseUrl: string;
}

function today(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function QuickActionsHero({ businessName, activeModules, baseUrl }: Props) {
  const actions = activeModules
    .filter(m => m.dashboardAction)
    .map(m => ({
      label: m.dashboardAction!.label,
      href: `${baseUrl}${m.dashboardAction!.href}`,
    }));

  return (
    <div className="bg-[#1e3a5f] rounded-xl p-5 text-white mb-6">
      <p className="text-base font-semibold mb-0.5">👋 Welcome back</p>
      <p className="text-sm text-blue-200 mb-4">
        {businessName} · {today()}
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`${baseUrl}/admin/canvas`}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-lg px-3 py-2 text-sm font-medium"
        >
          <Plus size={14} />
          Create Page
        </Link>
        {actions.map(a => (
          <Link
            key={a.href}
            href={a.href}
            className="bg-white/10 hover:bg-white/20 transition-colors rounded-lg px-3 py-2 text-sm font-medium"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
