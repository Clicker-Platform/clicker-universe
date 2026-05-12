'use client';

import { useState, useEffect } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';

interface EmailConfig {
  templates: {
    passwordReset: string;
    emailVerification: string;
    formSubmission: string;
    systemAlert: string;
    regConfirmation: string;
    regAdminNotif: string;
  };
  sender: {
    domain: string;
    localPart: string;
    fromName: string;
  };
}

const TEMPLATE_LABELS: Record<keyof EmailConfig['templates'], string> = {
  passwordReset:    'Password Reset',
  emailVerification:'Email Verification',
  formSubmission:   'Form Submission',
  systemAlert:      'System Alert',
  regConfirmation:  'Registration Confirmation',
  regAdminNotif:    'Registration Admin Notif',
};

export function EmailConfigPanel() {
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/email-config/get')
      .then(r => r.json())
      .then((data: EmailConfig) => setConfig(data))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    await fetch('/api/email-config/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...config, updatedBy: 'superadmin' }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <div className="text-sm text-gray-400">Loading email config...</div>;
  if (!config) return null;

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Mail className="w-4 h-4 text-gray-400" />
        <span className="font-black">Email Configuration</span>
      </div>

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

      <div className="border-t-2 border-gray-100 pt-4 mb-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Template IDs (Resend)</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(TEMPLATE_LABELS) as (keyof EmailConfig['templates'])[]).map(field => (
            <div key={field}>
              <label className="text-xs text-gray-500 mb-1 block">{TEMPLATE_LABELS[field]}</label>
              <input
                type="text"
                value={config.templates[field]}
                onChange={e => setConfig(c => c ? { ...c, templates: { ...c.templates, [field]: e.target.value } } : c)}
                className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
              />
            </div>
          ))}
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
