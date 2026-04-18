// Pre-flight credit cost estimation — used in UI before user confirms generation

import { SkillId } from '../types';
import { SKILL_CREDIT_COST } from '../config/model-config';
import { MULTI_SKILL_FLOWS } from './flows';

/**
 * Estimate credit cost for a single skill.
 */
export function estimateSingleSkillCost(skillId: SkillId): number {
  return SKILL_CREDIT_COST[skillId] ?? 3;
}

/**
 * Estimate credit cost for a multi-skill flow.
 * Uses the pre-defined estimatedCredits which accounts for typical step counts.
 */
export function estimateFlowCost(flowId: string): number {
  const flow = MULTI_SKILL_FLOWS[flowId];
  if (!flow) return 0;
  // Calculate from step costs for accuracy
  return flow.steps.reduce((sum, step) => sum + (SKILL_CREDIT_COST[step.skill] ?? 3), 0);
}

/**
 * Format credit cost for display: "~5 credits"
 */
export function formatCreditCost(cost: number): string {
  return `~${cost} credit${cost !== 1 ? 's' : ''}`;
}
