'use client';

import { useState } from 'react';
import { Copy, BookmarkPlus, RefreshCw, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { apiPost } from '../api';
import { API } from '../constants';
import { ContentType, SkillId } from '../types';

interface Props {
  generationId: string;
  skillId: SkillId;
  content: string;
  structured?: Record<string, any>;
  model: string;
  onRegenerate?: () => void;
  onSaved?: (contentId: string) => void;
}

function renderStructured(data: Record<string, any>): React.ReactNode {
  return (
    <div className="space-y-3">
      {Object.entries(data).map(([key, val]) => {
        if (val === null || val === undefined) return null;
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

        if (Array.isArray(val)) {
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <ul className="space-y-1">
                {val.map((item: any, i: number) => (
                  <li key={i} className="text-sm text-gray-800">
                    {typeof item === 'string' ? (
                      <span className="flex gap-2"><span className="text-gray-400">•</span>{item}</span>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono whitespace-pre-wrap">
                        {JSON.stringify(item, null, 2)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        if (typeof val === 'object') {
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <div className="bg-gray-50 rounded-xl p-3 text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(val, null, 2)}
              </div>
            </div>
          );
        }

        return (
          <div key={key}>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
            <p className="text-sm text-gray-800">{String(val)}</p>
          </div>
        );
      })}
    </div>
  );
}

const SKILL_CONTENT_TYPE: Partial<Record<SkillId, ContentType>> = {
  generate_ad_copy:          'ad_copy',
  generate_caption:          'caption',
  generate_headline:         'headline',
  generate_cta:              'cta',
  generate_hashtags:         'hashtags',
  plan_campaign:             'campaign_plan',
  create_content_calendar:   'content_calendar',
  generate_report:           'report',
  analyze_performance:       'analysis',
  identify_trends:           'analysis',
  suggest_optimizations:     'analysis',
};

export default function GenerationResult({
  generationId, skillId, content, structured, model, onRegenerate, onSaved,
}: Props) {
  const { siteId } = useSite();
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const handleCopy = () => {
    const text = structured ? JSON.stringify(structured, null, 2) : content;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (savedId) return; // already saved
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      const contentType = SKILL_CONTENT_TYPE[skillId] ?? 'analysis';
      const saveContent = structured ? JSON.stringify(structured, null, 2) : content;
      const { contentId } = await apiPost(
        API.saved,
        { generationId, type: contentType, content: saveContent },
        token,
        siteId
      );
      setSavedId(contentId);
      onSaved?.(contentId);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">Generated with</span>
          <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-md text-gray-700">{model}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !!savedId}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              savedId
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-brand-dark text-white hover:bg-brand-dark/90'
            }`}
          >
            {savedId ? <Check className="w-3.5 h-3.5" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : savedId ? 'Saved!' : 'Save'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {structured ? (
          renderStructured(structured)
        ) : (
          <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{content}</p>
        )}
      </div>

      {/* Raw JSON toggle (for structured output) */}
      {structured && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowRaw(v => !v)}
            className="flex items-center gap-1.5 px-5 py-3 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {showRaw ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showRaw ? 'Hide' : 'Show'} raw JSON
          </button>
          {showRaw && (
            <pre className="px-5 pb-4 text-xs text-gray-600 font-mono whitespace-pre-wrap overflow-auto max-h-64 border-t border-gray-50">
              {JSON.stringify(structured, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
