'use client';

import { Zap } from 'lucide-react';
import { useCredits } from '../hooks/use-credits';

export default function CreditIndicator() {
  const { balance, loading } = useCredits();

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 rounded-xl text-xs text-gray-400 animate-pulse">
        <Zap className="w-3.5 h-3.5" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
      balance < 0.10
        ? 'bg-red-50 border-red-200 text-red-600'
        : balance < 0.50
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-green-50 border-green-200 text-green-700'
    }`}>
      <Zap className="w-3.5 h-3.5" />
      <span>${balance.toFixed(4)}</span>
    </div>
  );
}
