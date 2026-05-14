'use client';

import { useState, useEffect } from 'react';
import { Mail, Loader2, CheckCircle, Plus, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface EmailConfig {
  templates: Record<string, string>;
  sender: {
    domain: string;
    localPart: string;
    fromName: string;
  };
  error?: string;
}

export function EmailConfigPanel() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  useEffect(() => {
    auth.currentUser?.getIdToken().then(idToken => {
      fetch('/api/email-config/get', { headers: { 'Authorization': `Bearer ${idToken}` } })
        .then(r => r.json())
        .then((data: EmailConfig) => setConfig(data))
        .finally(() => setLoading(false));
    });
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    const idToken = await auth.currentUser?.getIdToken() ?? '';
    await fetch('/api/email-config/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
      body: JSON.stringify({ ...config, updatedBy: 'superadmin' }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  function addTemplate() {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key || !config) return;
    setConfig(c => c ? { ...c, templates: { ...c.templates, [key]: value } } : c);
    setNewKey('');
    setNewValue('');
  }

  function removeTemplate(key: string) {
    setConfig(c => {
      if (!c) return c;
      const templates = { ...c.templates };
      delete templates[key];
      return { ...c, templates };
    });
  }

  if (loading) return <div className="text-sm text-gray-400">Loading email config...</div>;
  if (!config || config.error || !config.sender) return (
    <div className="bg-white rounded-2xl border-[3px] border-red-200 p-5 text-sm text-red-500">
      Failed to load email config: {config?.error ?? 'No sender data'}
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-gray-400" />
        <span className="font-black">Email Configuration</span>
      </div>

      {/* Sender */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        {(['domain', 'localPart', 'fromName'] as const).map(field => (
          <div key={field}>
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
              {field === 'domain' ? 'Sender Domain' : field === 'localPart' ? 'Local Part' : 'From Name'}
            </label>
            <input
              type="text"
              value={config.sender[field]}
              onChange={e => setConfig(c => c ? { ...c, sender: { ...c.sender, [field]: e.target.value } } : c)}
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      {/* Templates */}
      <div className="border-t-2 border-gray-100 pt-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Template IDs (Resend)</p>

        <div className="space-y-2 mb-3">
          {Object.entries(config.templates).map(([key, value]) => (
            <div key={key} className="flex gap-2 items-center">
              <input
                type="text"
                value={key}
                readOnly
                className="w-48 border-2 border-gray-200 rounded-lg px-3 py-2 text-xs font-mono bg-gray-50 text-gray-500"
              />
              <input
                type="text"
                value={value}
                onChange={e => setConfig(c => c ? { ...c, templates: { ...c.templates, [key]: e.target.value } } : c)}
                className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                placeholder="template-id"
              />
              <button
                onClick={() => removeTemplate(key)}
                className="p-2 text-gray-400 hover:text-red-500 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new template */}
        <div className="flex gap-2 items-center border-t-2 border-dashed border-gray-100 pt-3">
          <input
            type="text"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTemplate()}
            placeholder="key (e.g. regActivated)"
            className="w-48 border-2 border-gray-200 rounded-lg px-3 py-2 text-xs font-mono"
          />
          <input
            type="text"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addTemplate()}
            placeholder="template-id"
            className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={addTemplate}
            disabled={!newKey.trim()}
            className="p-2 text-gray-400 hover:text-blue-600 disabled:opacity-30 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex justify-end items-center gap-3">
        {saved && (
          <span className="flex items-center gap-1 text-sm text-green-600 font-semibold">
            <CheckCircle className="w-4 h-4" /> Saved
          </span>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-50"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Changes
        </button>
      </div>
    </div>
  );
}
