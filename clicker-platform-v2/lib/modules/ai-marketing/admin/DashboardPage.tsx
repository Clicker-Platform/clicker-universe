'use client';

import { useState, useEffect } from 'react';
import { LayoutDashboard, Zap, Bot, ImageIcon, ClipboardList, ArrowRight, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useRouter } from 'next/navigation';
import { subscribeRecentGenerations, subscribeCampaigns } from '../api';
import { useCredits } from '../hooks/use-credits';
import { MarketingGeneration, MarketingCampaign } from '../types';
import { ROUTES } from '../constants';
import { AGENT_LABELS } from '../config/skills-catalog';

export default function DashboardPage() {
  const { siteId } = useSite();
  const router = useRouter();
  const { balance, lifetimeUsed, loading: creditsLoading } = useCredits();

  const [generations, setGenerations] = useState<MarketingGeneration[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!siteId) return;
    let gDone = false, cDone = false;
    const check = () => { if (gDone && cDone) setLoading(false); };

    const unsubG = subscribeRecentGenerations(siteId, (data) => {
      setGenerations(data);
      gDone = true; check();
    }, 5);
    const unsubC = subscribeCampaigns(siteId, (data) => {
      setCampaigns(data);
      cDone = true; check();
    });
    return () => { unsubG(); unsubC(); };
  }, [siteId]);

  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  const quickActions = [
    { label: 'Generate Content', icon: <Bot className="w-5 h-5" />, href: ROUTES.generate, color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { label: 'Upload Asset',     icon: <ImageIcon className="w-5 h-5" />, href: ROUTES.assets,   color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'New Campaign',     icon: <ClipboardList className="w-5 h-5" />, href: ROUTES.campaigns, color: 'bg-green-50 text-green-700 border-green-200' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="w-6 h-6 text-gray-400" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Marketing Dashboard</h1>
          <p className="text-sm text-gray-500">Your AI marketing workspace at a glance</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium">AI Balance</span>
          </div>
          {creditsLoading ? <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" /> : (
            <p className="text-2xl font-black text-gray-900">${balance.toFixed(4)}</p>
          )}
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-purple-600 mb-2">
            <Bot className="w-4 h-4" />
            <span className="text-xs font-medium">Generations</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{generations.length > 5 ? '5+' : generations.length}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <ClipboardList className="w-4 h-4" />
            <span className="text-xs font-medium">Active Campaigns</span>
          </div>
          <p className="text-2xl font-black text-gray-900">{activeCampaigns}</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-xs font-medium">Total Spent</span>
          </div>
          {creditsLoading ? <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" /> : (
            <p className="text-2xl font-black text-gray-900">${lifetimeUsed.toFixed(4)}</p>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <h2 className="font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {quickActions.map(action => (
            <button
              key={action.label}
              onClick={() => router.push(action.href)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all hover:shadow-sm ${action.color}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Generations */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Recent Generations</h2>
            <button
              onClick={() => router.push(ROUTES.analytics)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              See all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
          ) : generations.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No generations yet</p>
          ) : (
            <div className="space-y-3">
              {generations.slice(0, 5).map(gen => {
                const createdAt = gen.createdAt as { toDate?: () => Date } | string | number | undefined;
                const date = (typeof createdAt === 'object' && createdAt && 'toDate' in createdAt && typeof createdAt.toDate === 'function')
                    ? createdAt.toDate()
                    : new Date(createdAt as string | number);
                return (
                  <div key={gen.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{gen.skillId?.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-gray-400">{AGENT_LABELS[gen.agentId]?.label ?? gen.agentId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-400">{gen.model?.split('/')[1] ?? gen.model}</p>
                      <p className="text-xs text-gray-400">{date.toLocaleDateString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Campaigns */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Campaigns</h2>
            <button
              onClick={() => router.push(ROUTES.campaigns)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              See all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 animate-spin text-gray-300" /></div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No campaigns yet</p>
          ) : (
            <div className="space-y-3">
              {campaigns.slice(0, 5).map(campaign => (
                <div
                  key={campaign.id}
                  onClick={() => router.push(`${ROUTES.campaignDetail}?id=${campaign.id}`)}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 cursor-pointer hover:opacity-80"
                >
                  <p className="text-sm font-medium text-gray-800">{campaign.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                    {campaign.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
