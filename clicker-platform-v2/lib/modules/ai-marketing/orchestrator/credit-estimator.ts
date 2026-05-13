// Cost is now calculated automatically from actual token usage after each AI call.
// Pre-flight estimation is no longer available.

export function estimateSingleSkillCost(_skillId: string): number {
  return 0;
}

export function estimateFlowCost(_flowId: string): number {
  return 0;
}

export function formatCreditCost(_cost: number): string {
  return '';
}
