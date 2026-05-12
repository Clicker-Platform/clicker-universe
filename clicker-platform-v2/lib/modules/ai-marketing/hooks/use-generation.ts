'use client';

import { useState } from 'react';
import { useSite } from '@/lib/site-context';
import { auth } from '@/lib/firebase';
import { apiPost } from '../api';
import { API } from '../constants';
import { SkillId } from '../types';

interface GenerationResult {
  generationId: string;
  content: string;
  structured?: Record<string, any>;
  stepOutputs?: Record<string, any>;
  model: string;
}

interface UseGenerationReturn {
  generate: (params: { skillId?: SkillId; flowId?: string; formData: Record<string, any> }) => Promise<GenerationResult | null>;
  generating: boolean;
  error: string | null;
  insufficientCredits: boolean;
  requiredCredits: number;
  clearError: () => void;
}

export function useGeneration(): UseGenerationReturn {
  const { siteId } = useSite();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insufficientCredits, setInsufficientCredits] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(0);

  const generate = async (params: { skillId?: SkillId; flowId?: string; formData: Record<string, any> }): Promise<GenerationResult | null> => {
    setGenerating(true);
    setError(null);
    setInsufficientCredits(false);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error('Not authenticated');

      const result = await apiPost(API.generate, params, token, siteId);
      return result as GenerationResult;
    } catch (err: any) {
      if (err.message?.includes('insufficient_credits')) {
        // Parse from error message or JSON response
        setInsufficientCredits(true);
        setRequiredCredits(0);
      }
      setError(err.message ?? 'Generation failed');
      return null;
    } finally {
      setGenerating(false);
    }
  };

  return {
    generate,
    generating,
    error,
    insufficientCredits,
    requiredCredits,
    clearError: () => { setError(null); setInsufficientCredits(false); },
  };
}
