'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { apiPost } from '../api';
import { API, PLATFORM_OPTIONS } from '../constants';
import { CampaignStatus } from '../types';

interface Props {
  onClose: () => void;
  onCreated: (campaignId: string) => void;
}

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'draft',     label: 'Draft' },
  { value: 'planned',   label: 'Planned' },
  { value: 'active',    label: 'Active' },
];

export default function CampaignBuilder({ onClose, onCreated }: Props) {
  const { siteId } = useSite();
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('');
  const [objective, setObjective] = useState('');
  const [status, setStatus] = useState<CampaignStatus>('draft');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) { setError('Campaign name is required'); return; }
    setSaving(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');
      const { campaignId } = await apiPost(API.campaigns, { name, platform, objective, status }, token, siteId);
      onCreated(campaignId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">New Campaign</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name <span className="text-red-500">*</span></label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Summer Sale 2025"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
            <select
              value={platform}
              onChange={e => setPlatform(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            >
              <option value="">Select platform...</option>
              {PLATFORM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
            <input
              value={objective}
              onChange={e => setObjective(e.target.value)}
              placeholder="e.g. Drive 100 sales, grow followers by 20%"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as CampaignStatus)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={saving}
            className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark/90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Campaign
          </button>
        </div>
      </div>
    </div>
  );
}
