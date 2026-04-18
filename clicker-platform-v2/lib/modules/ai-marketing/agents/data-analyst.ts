// Data Analyst agent — performance analysis and optimization prompts

export function buildAnalyzePerformancePrompt(input: {
  metrics: string;
  period: string;
  platform?: string;
}): { system: string; user: string } {
  const system = `You are a Marketing Data Analyst. Analyze campaign performance data and extract meaningful insights. Respond with valid JSON only.`;

  const user = `Analyze this campaign performance data:

Platform: ${input.platform || 'Multiple platforms'}
Period: ${input.period}

Metrics Data:
${input.metrics}

Return ONLY this JSON:
{
  "summary": "2-3 sentence performance summary",
  "kpi_analysis": [
    { "metric": "metric name", "value": "value", "benchmark": "industry benchmark", "status": "good/warning/poor", "insight": "what this means" }
  ],
  "top_performers": ["best performing element 1", "element 2"],
  "underperformers": ["underperforming element 1"],
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "overall_score": 1–10
}`;

  return { system, user };
}

export function buildIdentifyTrendsPrompt(input: {
  data: string;
  period: string;
}): { system: string; user: string } {
  const system = `You are a Marketing Analyst specializing in trend identification. Find patterns and signals in performance data. Respond with valid JSON only.`;

  const user = `Identify trends in this marketing data over ${input.period}:

${input.data}

Return ONLY this JSON:
{
  "trends": [
    {
      "trend": "trend description",
      "direction": "upward/downward/stable",
      "significance": "high/medium/low",
      "implication": "what this means for the campaign"
    }
  ],
  "anomalies": ["unexpected finding 1"],
  "seasonal_patterns": ["pattern observed"],
  "forecast": "brief 30-day outlook based on trends"
}`;

  return { system, user };
}

export function buildOptimizationsPrompt(input: {
  performanceData: string;
  currentStrategy?: string;
  goals: string;
}): { system: string; user: string } {
  const system = `You are a Performance Marketing Optimizer. Provide specific, prioritized optimization recommendations. Respond with valid JSON only.`;

  const user = `Recommend optimizations based on:

Performance Data:
${input.performanceData}

${input.currentStrategy ? `Current Strategy: ${input.currentStrategy}` : ''}
Goals: ${input.goals}

Return ONLY this JSON:
{
  "optimizations": [
    {
      "priority": "high/medium/low",
      "area": "what to optimize",
      "action": "specific action to take",
      "expected_impact": "expected result",
      "effort": "easy/medium/complex",
      "timeline": "when to implement"
    }
  ],
  "quick_wins": ["immediate action 1", "action 2"],
  "stop_doing": ["what to stop or reduce"],
  "test_ideas": ["A/B test idea 1", "test idea 2"]
}`;

  return { system, user };
}

export function buildROIPrompt(input: {
  spend: string;
  revenue: string;
  period: string;
  channel?: string;
}): { system: string; user: string } {
  const system = `You are a Marketing Finance Analyst. Calculate and interpret ROI metrics. Respond with valid JSON only.`;

  const user = `Calculate ROI for:

Total Spend: ${input.spend}
Revenue Generated: ${input.revenue}
Period: ${input.period}
${input.channel ? `Channel: ${input.channel}` : ''}

Return ONLY this JSON:
{
  "roi_percentage": number,
  "roas": number,
  "cpa": "cost per acquisition",
  "ltv_estimate": "estimated customer LTV",
  "profit": "calculated profit",
  "interpretation": "what these numbers mean",
  "benchmark_comparison": "vs industry average",
  "recommendations": ["recommendation 1", "recommendation 2"]
}`;

  return { system, user };
}

export function buildReportPrompt(input: {
  metrics: string;
  period: string;
  goals: string;
  brandName?: string;
}): { system: string; user: string } {
  const system = `You are a Senior Marketing Analyst. Create comprehensive, executive-ready performance reports. Respond with valid JSON only.`;

  const user = `Create a performance report for:

${input.brandName ? `Brand: ${input.brandName}` : ''}
Reporting Period: ${input.period}
Campaign Goals: ${input.goals}

Performance Data:
${input.metrics}

Return ONLY this JSON:
{
  "executive_summary": "3-4 sentence high-level summary for leadership",
  "period": "${input.period}",
  "highlights": ["key win 1", "key win 2"],
  "challenges": ["challenge 1"],
  "metrics_overview": [
    { "metric": "name", "actual": "value", "target": "target", "variance": "% vs target" }
  ],
  "channel_performance": [
    { "channel": "name", "spend": "amount", "revenue": "amount", "roas": number, "assessment": "good/ok/poor" }
  ],
  "recommendations_next_period": ["recommendation 1", "recommendation 2"],
  "conclusion": "closing statement and outlook"
}`;

  return { system, user };
}
