'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Loader2, TrendingUp } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { subscribeRecentGenerations } from '../api';
import { MarketingGeneration } from '../types';
import { AGENT_LABELS } from '../config/skills-catalog';
import UsageChart from '../components/UsageChart';

export default function AnalyticsPage() {
  const { siteId } = useSite();

  const [generations, setGenerations] = useState<MarketingGeneration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    const unsub = subscribeRecentGenerations(siteId, (data) => {
      setGenerations(data);
      setLoading(false);
    }, 100);
    return unsub;
  }, [siteId]);

  // Compute by-agent breakdown
  const agentBreakdown: Record<string, { count: number }> = {};
  for (const gen of generations) {
    const agent = gen.agentId ?? 'unknown';
    if (!agentBreakdown[agent]) agentBreakdown[agent] = { count: 0 };
    agentBreakdown[agent].count++;
  }

  const totalGenerations = generations.length;
  const countThisMonth = generations.filter(g => {
    const d = g.createdAt?.toDate?.() ?? new Date(g.createdAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-gray-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500">Track AI generation activity</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Total Generations', value: totalGenerations, icon: <BarChart3 className="w-4 h-4" />, color: 'text-purple-600' },
              { label: 'Bulan Ini', value: countThisMonth, icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                <div className={`flex items-center gap-2 ${stat.color} mb-2`}>{stat.icon}<span className="text-xs font-medium">{stat.label}</span></div>
                <p className="text-2xl font-black text-gray-900">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Usage Chart */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Generations — Last 14 Days</h2>
            <UsageChart generations={generations} days={14} />
          </div>

          {/* By Agent */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Usage by Agent</h2>
            {Object.keys(agentBreakdown).length === 0 ? (
              <p className="text-sm text-gray-400">No generations yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(agentBreakdown)
                  .sort((a, b) => b[1].count - a[1].count)
                  .map(([agentId, stats]) => {
                    const agent = AGENT_LABELS[agentId];
                    const pct = totalGenerations > 0 ? Math.round((stats.count / totalGenerations) * 100) : 0;
                    return (
                      <div key={agentId} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-700">{agent?.label ?? agentId}</span>
                          <span className="text-gray-500">{stats.count} generations</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-dark/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Recent Generations */}
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">Recent Generations</h2>
            {generations.length === 0 ? (
              <p className="text-sm text-gray-400">No generations yet</p>
            ) : (
              <div className="space-y-2">
                {generations.slice(0, 20).map(gen => {
                  const date = gen.createdAt?.toDate?.() ?? new Date(gen.createdAt);
                  return (
                    <div key={gen.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{gen.skillId?.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-400">{AGENT_LABELS[gen.agentId]?.label ?? gen.agentId} · {gen.model}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-700">{gen.model?.split('/')[1] ?? gen.model ?? '—'}</p>
                        <p className="text-xs text-gray-400">{date.toLocaleDateString()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
