'use client';

import { useState } from 'react';
import { Bot, Loader2, AlertTriangle, Zap } from 'lucide-react';
import { useUser } from '@/lib/user-context';
import { SkillDefinition, SkillId } from '../types';
import { SKILLS_CATALOG, AGENT_LABELS } from '../config/skills-catalog';
import { MULTI_SKILL_FLOWS } from '../orchestrator/flows';
import { useGeneration } from '../hooks/use-generation';
import SkillCard from '../components/SkillCard';
import SkillForm from '../components/SkillForm';
import GenerationResult from '../components/GenerationResult';
import CreditIndicator from '../components/CreditIndicator';

type Mode = 'single' | 'flow';

const AGENT_FILTERS = ['all', 'creative_director', 'strategist', 'data_analyst'];

export default function GeneratePage() {
  const { canEdit } = useUser();
  const { generate, generating, error, insufficientCredits, clearError } = useGeneration();

  const [mode, setMode] = useState<Mode>('single');
  const [agentFilter, setAgentFilter] = useState('all');
  const [selectedSkill, setSelectedSkill] = useState<SkillDefinition | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [result, setResult] = useState<{
    generationId: string;
    content: string;
    structured?: Record<string, unknown>;
    stepOutputs?: Record<string, unknown>;
    model: string;
  } | null>(null);

  const filteredSkills = agentFilter === 'all'
    ? SKILLS_CATALOG
    : SKILLS_CATALOG.filter(s => s.agentId === agentFilter);

  const handleSelectSkill = (skill: SkillDefinition) => {
    setSelectedSkill(skill);
    setResult(null);
    clearError();
    // Reset form on skill change
    setFormData({});
  };

  const handleGenerate = async () => {
    if (!canEdit('ai_marketing', 'generate')) {
      alert('View-only access');
      return;
    }
    setResult(null);

    const params = mode === 'flow'
      ? { flowId: selectedFlowId!, formData }
      : { skillId: selectedSkill!.id, formData };

    const res = await generate(params);
    if (res) setResult(res);
  };

  // canGenerate intentionally not rendered — kept for future guard logic
  void (mode === 'single' ? !!selectedSkill : !!selectedFlowId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-gray-400" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Generate Content</h1>
            <p className="text-sm text-gray-500">Pick a skill or flow, fill in the details, and let AI do the work</p>
          </div>
        </div>
        <CreditIndicator />
      </div>

      {/* Mode Toggle */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['single', 'flow'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); setSelectedSkill(null); setSelectedFlowId(null); setResult(null); setFormData({}); }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              mode === m ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {m === 'single' ? 'Single Skill' : 'Multi-Skill Flow'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Skill/Flow picker */}
        <div className="lg:col-span-1 space-y-4">
          {mode === 'single' ? (
            <>
              {/* Agent filter */}
              <div className="flex flex-wrap gap-1.5">
                {AGENT_FILTERS.map(f => (
                  <button
                    key={f}
                    onClick={() => setAgentFilter(f)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                      agentFilter === f
                        ? 'bg-brand-dark text-white border-brand-dark'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {f === 'all' ? 'All' : AGENT_LABELS[f]?.label ?? f}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
                {filteredSkills.map(skill => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    selected={selectedSkill?.id === skill.id}
                    onSelect={handleSelectSkill}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {Object.values(MULTI_SKILL_FLOWS).map(flow => (
                <button
                  key={flow.id}
                  onClick={() => { setSelectedFlowId(flow.id); setResult(null); clearError(); setFormData({}); }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all shadow-sm hover:shadow-md ${
                    selectedFlowId === flow.id
                      ? 'border-brand-dark bg-brand-dark/5'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-gray-900 text-sm">{flow.label}</p>
                    <div className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
                      <Zap className="w-3 h-3" />
                      <span>~{flow.estimatedCredits}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">{flow.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{flow.steps.length} steps</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Form + Result */}
        <div className="lg:col-span-2 space-y-4">
          {/* Form panel */}
          {(selectedSkill || selectedFlowId) ? (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  {mode === 'single' ? selectedSkill?.label : MULTI_SKILL_FLOWS[selectedFlowId!]?.label}
                </h2>
                <span className="text-xs text-gray-400">Fill in the details below</span>
              </div>

              {mode === 'single' && selectedSkill && (
                <SkillForm
                  skill={selectedSkill}
                  values={formData}
                  onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
                />
              )}

              {mode === 'flow' && selectedFlowId && (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500">
                    This flow will run {MULTI_SKILL_FLOWS[selectedFlowId].steps.length} skills sequentially.
                    Provide the core details below.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product / Service <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      value={(formData.product as string | undefined) ?? ''}
                      onChange={e => setFormData(p => ({ ...p, product: e.target.value }))}
                      placeholder="What are you marketing?"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Objective</label>
                    <input
                      type="text"
                      value={(formData.objective as string | undefined) ?? ''}
                      onChange={e => setFormData(p => ({ ...p, objective: e.target.value }))}
                      placeholder="e.g. Launch new product, increase sales"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Platform</label>
                    <input
                      type="text"
                      value={(formData.platform as string | undefined) ?? ''}
                      onChange={e => setFormData(p => ({ ...p, platform: e.target.value }))}
                      placeholder="e.g. Instagram, Meta, TikTok"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-gray-400 outline-none text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Error states */}
              {insufficientCredits && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                  <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-red-700">Insufficient Credits</p>
                    <p className="text-xs text-red-600 mt-0.5">Saldo AI tidak cukup. Hubungi admin untuk top-up.</p>
                  </div>
                </div>
              )}

              {error && !insufficientCredits && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleGenerate}
                disabled={generating || insufficientCredits || !canEdit('ai_marketing', 'generate')}
                className="w-full bg-brand-dark text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-dark/90 shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                  : <><Bot className="w-4 h-4" /> Generate</>
                }
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-12 text-center">
              <Bot className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Select a skill or flow to get started</p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="space-y-4">
              {result.stepOutputs ? (
                // Multi-skill flow results
                Object.entries(result.stepOutputs as Record<string, { content: string; structured?: Record<string, unknown>; model?: string }>).map(([skill, output]) => (
                  <div key={skill}>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">{skill.replace(/_/g, ' ')}</p>
                    <GenerationResult
                      generationId={result.generationId}
                      skillId={skill as SkillId}
                      content={output.content}
                      structured={output.structured}
                      model={output.model ?? ''}
                      onRegenerate={handleGenerate}
                    />
                  </div>
                ))
              ) : (
                <GenerationResult
                  generationId={result.generationId}
                  skillId={selectedSkill?.id ?? 'generate_ad_copy'}
                  content={result.content}
                  structured={result.structured}
                  model={result.model}
                  onRegenerate={handleGenerate}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
