'use client';

import { useState, useEffect } from 'react';
import { Settings, Save, Loader2 } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { useUser } from '@/lib/user-context';
import { getMarketingSettings, apiPost } from '../api';
import {
  BrandVoiceConfig, MarketingSettings,
} from '../types';
import {
  DEFAULT_BRAND_VOICE, TONE_OPTIONS, STYLE_OPTIONS,
  PLATFORM_OPTIONS, API,
} from '../constants';
import { auth } from '@/lib/firebase';

export default function SettingsPage() {
  const { siteId } = useSite();
  const { canEdit } = useUser();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  const [brandVoice, setBrandVoice] = useState<BrandVoiceConfig>(DEFAULT_BRAND_VOICE);
  const [defaultPlatforms, setDefaultPlatforms] = useState<string[]>(['meta', 'instagram']);

  useEffect(() => {
    if (!siteId) return;
    getMarketingSettings(siteId).then((settings) => {
      if (settings) {
        setBrandVoice(settings.brandVoice ?? DEFAULT_BRAND_VOICE);
        setDefaultPlatforms(settings.defaultPlatforms ?? ['meta', 'instagram']);
      }
      setLoading(false);
    });
  }, [siteId]);

  const handleSave = async () => {
    if (!canEdit('ai_marketing', 'settings')) {
      alert('View-only access');
      return;
    }
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      await apiPost(API.config, { brandVoice, defaultPlatforms }, token, siteId);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const togglePlatform = (val: string) => {
    setDefaultPlatforms(prev =>
      prev.includes(val) ? prev.filter(p => p !== val) : [...prev, val]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Marketing Settings</h1>
            <p className="text-sm text-gray-500">Configure brand voice and default platforms</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-brand-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-brand-dark/90 shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {/* Brand Voice */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Brand Voice</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
            <select
              value={brandVoice.tone}
              onChange={e => setBrandVoice(prev => ({ ...prev, tone: e.target.value as any }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            >
              {TONE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
            <select
              value={brandVoice.style}
              onChange={e => setBrandVoice(prev => ({ ...prev, style: e.target.value as any }))}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
            >
              {STYLE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Brand Description</label>
          <textarea
            value={brandVoice.description}
            onChange={e => setBrandVoice(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            placeholder="Describe your brand, products, and unique value proposition (200–500 characters)..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target Audience</label>
          <textarea
            value={brandVoice.targetAudience}
            onChange={e => setBrandVoice(prev => ({ ...prev, targetAudience: e.target.value }))}
            rows={2}
            placeholder="Describe your ideal customer (age, interests, pain points)..."
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Key Messages <span className="text-gray-400 font-normal">(one per line, 3–5 messages)</span>
          </label>
          <textarea
            value={brandVoice.keyMessages.join('\n')}
            onChange={e => setBrandVoice(prev => ({
              ...prev,
              keyMessages: e.target.value.split('\n').filter(Boolean),
            }))}
            rows={4}
            placeholder="Premium quality&#10;Fast delivery&#10;Trusted by 10,000+ customers"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm resize-none font-mono"
          />
        </div>
      </div>

      {/* Default Platforms */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <h2 className="font-semibold text-gray-900">Default Platforms</h2>
        <p className="text-sm text-gray-500">Pre-select platforms when generating content</p>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => togglePlatform(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                defaultPlatforms.includes(opt.value)
                  ? 'bg-brand-dark text-white border-brand-dark'
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
