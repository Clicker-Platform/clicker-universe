'use client';

import { useState, useEffect } from 'react';
import { ClipboardList, Plus, Loader2, Download } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { subscribeCampaigns } from '../api';
import { MarketingCampaign, CampaignStatus } from '../types';
import { ROUTES, API } from '../constants';
import CampaignBuilder from '../components/CampaignBuilder';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft:     'bg-gray-100 border-gray-200 text-gray-500',
  planned:   'bg-blue-50 border-blue-200 text-blue-700',
  active:    'bg-green-50 border-green-200 text-green-700',
  paused:    'bg-amber-50 border-amber-200 text-amber-700',
  completed: 'bg-purple-50 border-purple-200 text-purple-700',
};

export default function CampaignsPage() {
  const { siteId } = useSite();
  const { canEdit } = useUser();
  const router = useRouter();

  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!siteId) return;
    const unsub = subscribeCampaigns(siteId, (data) => {
      setCampaigns(data);
      setLoading(false);
    });
    return unsub;
  }, [siteId]);

  const handleExport = async (campaign: MarketingCampaign) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch(`${API.export}?campaignId=${campaign.id}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.name}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Campaigns</h1>
            <p className="text-sm text-gray-500">Organize and manage your marketing campaigns</p>
          </div>
        </div>
        {canEdit('ai_marketing', 'campaigns') && (
          <button
            onClick={() => setShowCreate(true)}
            className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark/90 shadow-sm transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-200 shadow-sm text-center">
          <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No campaigns yet</p>
          <p className="text-gray-400 text-sm mt-1">Create your first campaign to organize generated content</p>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <div
              key={campaign.id}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => router.push(`${ROUTES.campaignDetail}?id=${campaign.id}`)}
            >
              <div className="flex items-center gap-4">
                <div>
                  <p className="font-semibold text-gray-900">{campaign.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {campaign.platform && <span className="mr-2">{campaign.platform}</span>}
                    {campaign.objective && <span className="text-gray-400">{campaign.objective}</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{campaign.savedContentIds?.length ?? 0} items</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_COLORS[campaign.status] ?? STATUS_COLORS.draft}`}>
                  {campaign.status}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleExport(campaign); }}
                  className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
                  title="Export as Markdown"
                >
                  <Download className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CampaignBuilder
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
