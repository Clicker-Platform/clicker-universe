'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Save, DollarSign } from 'lucide-react';
import { MODEL_OPTIONS } from './ModelRegistry';

interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

export function PricingPanel() {
  const [models, setModels] = useState<Record<string, ModelRate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');

  const isCustom = selectedModel === '__custom__';
  const effectiveModel = isCustom ? customModel.trim() : selectedModel;

  useEffect(() => {
    fetch('/api/ai-settings/pricing')
      .then(r => r.json())
      .then((data: { models: Record<string, ModelRate> }) => setModels(data.models ?? {}))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      await fetch('/api/ai-settings/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ models }),
      });
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    if (!effectiveModel || !newInput || !newOutput) return;
    setModels(prev => ({
      ...prev,
      [effectiveModel]: { inputPer1M: Number(newInput), outputPer1M: Number(newOutput) },
    }));
    setSelectedModel(''); setCustomModel(''); setNewInput(''); setNewOutput('');
  }

  function handleDelete(modelId: string) {
    setModels(prev => { const next = { ...prev }; delete next[modelId]; return next; });
  }

  function handleEdit(modelId: string, field: 'inputPer1M' | 'outputPer1M', value: string) {
    setModels(prev => ({ ...prev, [modelId]: { ...prev[modelId], [field]: Number(value) } }));
  }

  if (loading) return <div className="text-sm text-gray-400">Loading...</div>;

  return (
    <div className="bg-white rounded-2xl border-[3px] border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <span className="font-black">Model Pricing</span>
        <span className="text-xs text-gray-400 ml-1">($/1M tokens)</span>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Rate yang dikenakan ke balance tenant per 1 juta token. Set sama dengan rate OpenRouter untuk break-even, atau lebih tinggi untuk markup.
      </p>

      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-gray-100">
              <th className="text-left py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide text-xs">Model ID</th>
              <th className="text-right py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide text-xs">Input $/1M</th>
              <th className="text-right py-2 pr-4 text-gray-400 font-semibold uppercase tracking-wide text-xs">Output $/1M</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {Object.entries(models).map(([modelId, rate]) => (
              <tr key={modelId} className="border-b border-gray-50">
                <td className="py-2 pr-4 font-mono text-xs">{modelId}</td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    step="0.01"
                    value={rate.inputPer1M}
                    onChange={e => handleEdit(modelId, 'inputPer1M', e.target.value)}
                    className="w-24 text-right border-2 border-gray-200 rounded-lg px-2 py-1 text-sm ml-auto block"
                  />
                </td>
                <td className="py-2 pr-4">
                  <input
                    type="number"
                    step="0.01"
                    value={rate.outputPer1M}
                    onChange={e => handleEdit(modelId, 'outputPer1M', e.target.value)}
                    className="w-24 text-right border-2 border-gray-200 rounded-lg px-2 py-1 text-sm ml-auto block"
                  />
                </td>
                <td className="py-2">
                  <button onClick={() => handleDelete(modelId)} className="text-gray-300 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 mb-4 space-y-3">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Tambah Markup Harga</p>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-gray-500">Model</label>
          <select
            value={selectedModel}
            onChange={e => { setSelectedModel(e.target.value); setCustomModel(''); }}
            className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">— Pilih model —</option>
            <optgroup label="Free (rate = $0)">
              {MODEL_OPTIONS.filter(m => m.free && !models[m.value]).map(m => (
                <option key={m.value} value={m.value}>{m.provider} · {m.label}</option>
              ))}
            </optgroup>
            <optgroup label="Paid">
              {MODEL_OPTIONS.filter(m => !m.free && !models[m.value]).map(m => (
                <option key={m.value} value={m.value}>{m.provider} · {m.label}</option>
              ))}
            </optgroup>
            <option value="__custom__">+ Lainnya (masukkan ID manual)</option>
          </select>
          {isCustom && (
            <input
              type="text"
              value={customModel}
              onChange={e => setCustomModel(e.target.value)}
              placeholder="contoh: google/gemini-2.0-flash"
              className="w-full border-2 border-amber-300 rounded-lg px-3 py-2 text-sm font-mono mt-1"
              autoFocus
            />
          )}
          {selectedModel && !isCustom && (
            <p className="text-xs text-gray-400 font-mono pt-0.5">{selectedModel}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">
              Input <span className="font-normal text-gray-400">($/1M token)</span>
            </label>
            <input
              type="number" step="0.001" min="0"
              value={newInput}
              onChange={e => setNewInput(e.target.value)}
              placeholder="contoh: 0.10"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500">
              Output <span className="font-normal text-gray-400">($/1M token)</span>
            </label>
            <input
              type="number" step="0.001" min="0"
              value={newOutput}
              onChange={e => setNewOutput(e.target.value)}
              placeholder="contoh: 0.40"
              className="w-full border-2 border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <button
          onClick={handleAdd}
          disabled={!effectiveModel || !newInput || !newOutput}
          className="flex items-center gap-1.5 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-40"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 flex-1">
          <p className="font-bold mb-1">ℹ️ Fallback otomatis</p>
          <p>Model yang tidak diisi di sini akan menggunakan rate OpenRouter resmi sebagai fallback — balance tenant tetap terpotong. Isi di sini hanya jika ingin menerapkan markup atau harga kustom.</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Pricing
        </button>
      </div>
    </div>
  );
}
