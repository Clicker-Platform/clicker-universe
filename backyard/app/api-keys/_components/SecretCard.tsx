'use client';

import { useState } from 'react';
import { Key, CheckCircle, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';

const KEY_LABELS: Record<string, { label: string; description: string }> = {
  OPENROUTER_API_KEY:       { label: 'OpenRouter API Key',      description: 'AI model gateway (all AI features)' },
  RESEND_API_KEY:           { label: 'Resend API Key',          description: 'Email delivery service' },
  WA_WEBHOOK_VERIFY_TOKEN:  { label: 'WhatsApp Verify Token',   description: 'Meta webhook verification token' },
  META_APP_SECRET:          { label: 'Meta App Secret',         description: 'WhatsApp webhook signature validation' },
  WA_ENCRYPTION_KEY:        { label: 'WhatsApp Encryption Key', description: 'Token encryption for WA connections' },
  UPSTASH_REDIS_REST_TOKEN: { label: 'Upstash Redis Token',     description: 'Cache layer for performance' },
};

interface SecretCardProps {
  secretKey: string;
  exists: boolean;
  onRefresh: () => void;
}

export function SecretCard({ secretKey, exists, onRefresh }: SecretCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [newValue, setNewValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const meta = KEY_LABELS[secretKey] ?? { label: secretKey, description: '' };

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/secrets/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey }),
      });
      const data = await res.json() as { ok: boolean; message: string };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    if (!newValue.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/secrets/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey, value: newValue.trim() }),
      });
      setNewValue('');
      setShowInput(false);
      onRefresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete ${meta.label}? This will break dependent features.`)) return;
    setDeleting(true);
    try {
      await fetch('/api/secrets/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secretKey }),
      });
      onRefresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <Key className="w-4 h-4 text-gray-400" />
          <span className="font-bold text-sm">{meta.label}</span>
        </div>
        <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${exists ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {exists ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
          {exists ? 'Set' : 'Missing'}
        </span>
      </div>
      <p className="text-xs text-gray-500 mb-3 ml-6">{meta.description}</p>

      {testResult && (
        <div className={`text-xs px-3 py-2 rounded-lg mb-3 font-medium ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult.ok ? '✓' : '✗'} {testResult.message}
        </div>
      )}

      {showInput && (
        <div className="mb-3 space-y-2">
          <div className="relative">
            <input
              type={showValue ? 'text' : 'password'}
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              placeholder="Paste new value..."
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-sm font-mono pr-12"
              autoFocus
            />
            <button
              onClick={() => setShowValue(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showValue ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowInput(false); setNewValue(''); }} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !newValue.trim()}
              className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        {exists && (
          <>
            <button
              onClick={handleTest}
              disabled={testing}
              className="text-xs font-semibold px-3 py-1.5 border-2 border-gray-200 rounded-lg hover:border-gray-300 disabled:opacity-50 flex items-center gap-1"
            >
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              Test
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-semibold px-3 py-1.5 border-2 border-red-200 text-red-600 rounded-lg hover:border-red-400 disabled:opacity-50"
            >
              Delete
            </button>
          </>
        )}
        <button
          onClick={() => { setShowInput(v => !v); setTestResult(null); }}
          className="text-xs font-semibold px-3 py-1.5 bg-gray-900 text-white rounded-lg hover:opacity-90"
        >
          {exists ? 'Update' : 'Set Key'}
        </button>
      </div>
    </div>
  );
}
