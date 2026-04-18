'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2, AlertCircle, Trash2, Download } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { auth } from '@/lib/firebase';
import { getCampaign } from '../api';
import { MarketingCampaign, CampaignStatus } from '../types';
import { API } from '../constants';

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft' },
  { value: 'planned',   label: 'Planned' },
  { value: 'active',    label: 'Active' },
  { value: 'paused',    label: 'Paused' },
  { value: 'completed', label: 'Completed' },
];

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft:     'bg-gray-100 border-gray-200 text-gray-500',
  planned:   'bg-blue-50 border-blue-200 text-blue-700',
  active:    'bg-green-50 border-green-200 text-green-700',
  paused:    'bg-amber-50 border-amber-200 text-amber-700',
  completed: 'bg-purple-50 border-purple-200 text-purple-700',
};

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useSearchParams();
  const { siteId } = useSite();
  const { canEdit } = useUser();

  const campaignId = params.get('id');
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<CampaignStatus>('draft');

  useEffect(() => {
    if (!siteId || !campaignId) return;
    getCampaign(siteId, campaignId).then(c => {
      setCampaign(c);
      if (c) setStatus(c.status);
      setLoading(false);
    });
  }, [siteId, campaignId]);

  const handleStatusChange = async (newStatus: CampaignStatus) => {
    if (!canEdit('ai_marketing', 'campaigns')) return;
    setStatus(newStatus);
    setSaving(true);
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch(`${API.campaigns}/${campaignId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'x-site-id': siteId },
      body: JSON.stringify({ status: newStatus }),
    });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return;
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch(`${API.campaigns}/${campaignId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
    });
    router.back();
  };

  const handleExport = async () => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    const res = await fetch(`${API.export}?campaignId=${campaignId}`, {
      headers: { Authorization: `Bearer ${token}`, 'x-site-id': siteId },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign?.name ?? 'campaign'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-16"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  if (!campaign) return (
    <div className="bg-white p-8 rounded-2xl border border-gray-200 shadow-sm text-center">
      <AlertCircle className="w-8 h-8 text-gray-300 mx-auto mb-3" />
      <p className="text-gray-500">Campaign not found</p>
      <button onClick={() => router.back()} className="mt-4 text-sm text-blue-600 hover:underline">Go back</button>
    </div>
  );

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{campaign.name}</h1>
            <p className="text-sm text-gray-500">{campaign.platform} · {campaign.objective}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
          {canEdit('ai_marketing', 'campaigns') && (
            <button onClick={handleDelete} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Status</h2>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              disabled={!canEdit('ai_marketing', 'campaigns')}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                status === opt.value
                  ? STATUS_COLORS[opt.value]
                  : 'bg-gray-100 border-gray-200 text-gray-400 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content count */}
      <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
        <h2 className="font-semibold text-gray-900">Content</h2>
        <p className="text-sm text-gray-500 mt-1">
          {campaign.savedContentIds?.length ?? 0} saved content items linked to this campaign.
        </p>
        <p className="text-xs text-gray-400 mt-2">
          To link content, save it from the Generate page and assign it to this campaign.
        </p>
      </div>
    </div>
  );
}
