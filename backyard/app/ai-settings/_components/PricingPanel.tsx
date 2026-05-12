'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Save, DollarSign } from 'lucide-react';

interface ModelRate {
  inputPer1M: number;
  outputPer1M: number;
}

export function PricingPanel() {
  const [models, setModels] = useState<Record<string, ModelRate>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newModel, setNewModel] = useState('');
  const [newInput, setNewInput] = useState('');
  const [newOutput, setNewOutput] = useState('');

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
    if (!newModel || !newInput || !newOutput) return;
    setModels(prev => ({
      ...prev,
      [newModel.trim()]: { inputPer1M: Number(newInput), outputPer1M: Number(newOutput) },
    }));
    setNewModel(''); setNewInput(''); setNewOutput('');
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
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-4 h-4 text-gray-400" />
        <span className="font-black">Model Pricing</span>
        <span className="text-xs text-gray-400 ml-1">($/1M tokens)</span>
      </div>

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
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newModel}
          onChange={e => setNewModel(e.target.value)}
          placeholder="model-id (e.g. google/gemini-2.0-flash)"
          className="flex-1 border-2 border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
        />
        <input type="number" step="0.01" value={newInput} onChange={e => setNewInput(e.target.value)}
          placeholder="Input" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm text-right" />
        <input type="number" step="0.01" value={newOutput} onChange={e => setNewOutput(e.target.value)}
          placeholder="Output" className="w-24 border-2 border-gray-200 rounded-lg px-2 py-2 text-sm text-right" />
        <button onClick={handleAdd} disabled={!newModel || !newInput || !newOutput}
          className="flex items-center gap-1 bg-gray-900 text-white px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-40">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      <div className="flex justify-end">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Pricing
        </button>
      </div>
    </div>
  );
}
