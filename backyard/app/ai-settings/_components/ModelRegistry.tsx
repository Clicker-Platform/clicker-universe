'use client';

import { useState, useEffect } from 'react';
import { Loader2, CheckCircle, Bot, DollarSign } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuthToken } from '@/lib/useAuthToken';

interface ModelConfig {
  llm: string;
  vision: string;
}

interface OpenRouterBalance {
  label: string;
  usage: number;
  usageMonthly: number;
  limit: number | null;
  limitRemaining: number | null;
  isFreeTier: boolean;
  totalCredits: number | null;
  totalUsage: number | null;
  balance: number | null;
  rateLimit?: { requests: number; interval: string };
  error?: string;
}

export const MODEL_OPTIONS: {
  value: string;
  label: string;
  provider: string;
  free: boolean;
  slots: (keyof ModelConfig)[];
}[] = [
  // ── Free Vision ───────────────────────────────────────────────────────────
  { value: 'google/gemma-4-31b-it:free',                label: 'Gemma 4 31B',                provider: 'Google',    free: true,  slots: ['vision'] },
  { value: 'meta-llama/llama-4-maverick:free',          label: 'Llama 4 Maverick',           provider: 'Meta',      free: true,  slots: ['vision'] },
  // ── Free LLM ──────────────────────────────────────────────────────────────
  { value: 'meta-llama/llama-3.3-70b-instruct:free',    label: 'Llama 3.3 70B',              provider: 'Meta',      free: true,  slots: ['llm'] },
  { value: 'qwen/qwen3-coder:free',                     label: 'Qwen3 Coder',                provider: 'Qwen',      free: true,  slots: ['llm'] },
  // ── Google ────────────────────────────────────────────────────────────────
  { value: 'google/gemini-3.1-flash-lite',              label: 'Gemini 3.1 Flash Lite',      provider: 'Google',    free: false, slots: ['llm', 'vision'] },
  { value: 'google/gemini-2.0-flash',                   label: 'Gemini 2.0 Flash',           provider: 'Google',    free: false, slots: ['llm', 'vision'] },
  // ── OpenAI ────────────────────────────────────────────────────────────────
  { value: 'openai/gpt-4o-mini',                        label: 'GPT-4o Mini',                provider: 'OpenAI',    free: false, slots: ['llm', 'vision'] },
  { value: 'openai/gpt-5.5',                            label: 'GPT-5.5',                    provider: 'OpenAI',    free: false, slots: ['llm', 'vision'] },
  // ── Anthropic ─────────────────────────────────────────────────────────────
  { value: 'anthropic/claude-haiku-4-5',                label: 'Claude Haiku 4.5',           provider: 'Anthropic', free: false, slots: ['llm'] },
  { value: 'anthropic/claude-sonnet-4-6',               label: 'Claude Sonnet 4.6',          provider: 'Anthropic', free: false, slots: ['llm', 'vision'] },
  // ── Meta ──────────────────────────────────────────────────────────────────
  { value: 'meta-llama/llama-4-maverick',               label: 'Llama 4 Maverick',           provider: 'Meta',      free: false, slots: ['llm', 'vision'] },
  { value: 'meta-llama/llama-3.3-70b-instruct',         label: 'Llama 3.3 70B',              provider: 'Meta',      free: false, slots: ['llm'] },
  // ── DeepSeek ──────────────────────────────────────────────────────────────
  { value: 'deepseek/deepseek-v4-flash',                label: 'DeepSeek V4 Flash',          provider: 'DeepSeek',  free: false, slots: ['llm'] },
];

const SLOTS: { key: keyof ModelConfig; label: string; description: string }[] = [
  { key: 'llm',    label: 'LLM',    description: 'Chat, tools, AI Sales Agent' },
  { key: 'vision', label: 'Vision', description: 'Image analysis (Stocklens)' },
];

export function ModelRegistry() {
  const [config, setConfig] = useState<ModelConfig | null>(null);
  const [balance, setBalance] = useState<OpenRouterBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useAuthToken();

  useEffect(() => {
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    Promise.all([
      fetch('/api/ai-settings/models', { headers }).then(r => r.json()),
      fetch('/api/ai-settings/openrouter-balance', { headers }).then(r => r.json()),
    ]).then(([modelData, balanceData]: [ModelConfig & { error?: string }, OpenRouterBalance]) => {
      if (modelData.error) { setError(modelData.error); }
      else { setConfig(modelData); }
      setBalance(balanceData);
    }).finally(() => setLoading(false));
  }, [token]);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const idToken = await auth.currentUser?.getIdToken() ?? '';
      await fetch('/api/ai-settings/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify(config),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>;
  if (error) return <div className="text-sm text-red-500">Error: {error}</div>;
  if (!config) return null;

  return (
    <div className="space-y-4">
      {/* OpenRouter Balance Card */}
      <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-gray-400" />
          <span className="font-black">OpenRouter Credit</span>
          {balance?.label && (
            <span className="text-xs text-gray-400 font-normal ml-1">({balance.label})</span>
          )}
        </div>
        {balance?.error ? (
          <p className="text-sm text-red-500">{balance.error}</p>
        ) : balance ? (
          <div className="flex items-center gap-6 flex-wrap">
            {balance.totalCredits != null && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Total Credits</p>
                <p className="text-2xl font-black">${balance.totalCredits.toFixed(2)}</p>
              </div>
            )}
            {balance.totalUsage != null && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Used</p>
                <p className="text-2xl font-black">${balance.totalUsage.toFixed(4)}</p>
              </div>
            )}
            {balance.balance != null && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Available</p>
                <p className={`text-2xl font-black ${balance.balance < 1 ? 'text-red-600' : 'text-green-600'}`}>
                  ${balance.balance.toFixed(4)}
                </p>
              </div>
            )}
            {balance.isFreeTier && (
              <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-1 rounded-full">Free Tier</span>
            )}
            {balance.rateLimit && (
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Rate Limit</p>
                <p className="text-sm font-semibold">{balance.rateLimit.requests} req/{balance.rateLimit.interval}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Balance unavailable</p>
        )}
      </div>

      {/* Model Slots */}
      <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
        <div className="flex items-center gap-2 mb-2">
          <Bot className="w-4 h-4 text-gray-400" />
          <span className="font-black">Model Registry</span>
        </div>
        <p className="text-xs text-gray-400 mb-5">
          Wajib diisi semua slot. Jika belum di-set, semua AI call akan gagal dengan error <span className="font-mono">model_config_not_set</span>.
        </p>

        <div className="space-y-4">
          {SLOTS.map(slot => {
            const slotOptions = MODEL_OPTIONS.filter(m => m.slots.includes(slot.key));
            const freeOptions = slotOptions.filter(m => m.free);
            const paidOptions = slotOptions.filter(m => !m.free);
            const currentValue = config[slot.key];
            const currentModel = MODEL_OPTIONS.find(m => m.value === currentValue);

            return (
              <div key={slot.key} className="flex items-center gap-4">
                <div className="w-20 shrink-0">
                  <p className="text-sm font-black">{slot.label}</p>
                  <p className="text-xs text-gray-400">{slot.description}</p>
                </div>
                <div className="flex-1">
                  <select
                    value={currentValue}
                    onChange={e => setConfig(c => c ? { ...c, [slot.key]: e.target.value } : c)}
                    className={`w-full border-2 rounded-xl px-3 py-2.5 text-sm bg-white appearance-none cursor-pointer ${!currentValue ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  >
                    {!currentValue && <option value="">— Belum dipilih —</option>}
                    <optgroup label="Free">
                      {freeOptions.map(m => (
                        <option key={m.value} value={m.value}>{m.label} — {m.provider}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Paid">
                      {paidOptions.map(m => (
                        <option key={m.value} value={m.value}>{m.label} — {m.provider}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
                {currentModel && (
                  <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                    currentModel.free
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {currentModel.free ? 'Free' : 'Paid'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-end items-center gap-3 mt-5 pt-4 border-t-2 border-gray-100">
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
    </div>
  );
}
