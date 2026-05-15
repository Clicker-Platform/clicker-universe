'use client';

import { MarketingGeneration } from '../types';

interface Props {
  generations: MarketingGeneration[];
  days?: number;
}

function getDateKey(ts: { toDate?: () => Date } | string | number | null | undefined): string {
  if (!ts) return '';
  const d = typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof ts.toDate === 'function'
    ? ts.toDate()
    : new Date(ts as string | number);
  return d.toISOString().split('T')[0] ?? '';
}

export default function UsageChart({ generations, days = 14 }: Props) {
  // Build last N days buckets
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().split('T')[0]] = 0;
  }

  for (const gen of generations) {
    const key = getDateKey(gen.createdAt as { toDate?: () => Date } | string | number | null | undefined);
    if (key in buckets) {
      buckets[key] += 1;
    }
  }

  const labels = Object.keys(buckets);
  const values = Object.values(buckets);
  const max = Math.max(...values, 1);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-1 h-24">
        {labels.map((label, i) => {
          const height = Math.round((values[i] / max) * 100);
          const _date = new Date(label);
          void _date;
          const isToday = i === labels.length - 1;
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-1" title={`${label}: ${values[i]} generations`}>
              <div className="w-full flex flex-col justify-end" style={{ height: '80px' }}>
                <div
                  className={`w-full rounded-t-md transition-all ${isToday ? 'bg-brand-dark' : 'bg-gray-200'}`}
                  style={{ height: `${Math.max(height, values[i] > 0 ? 4 : 0)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{new Date(labels[0]).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
