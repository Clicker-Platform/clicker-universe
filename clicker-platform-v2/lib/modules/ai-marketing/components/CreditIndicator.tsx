'use client';

import { Zap, AlertTriangle } from 'lucide-react';
import { useCredits } from '../hooks/use-credits';

interface Props {
  estimatedCost?: number;
  showEstimate?: boolean;
}

export default function CreditIndicator({ estimatedCost, showEstimate }: Props) {
  const { balance, loading } = useCredits();

  const insufficient = estimatedCost !== undefined && balance < estimatedCost;

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
      insufficient
        ? 'bg-red-50 border-red-200 text-red-600'
        : balance < 20
          ? 'bg-amber-50 border-amber-200 text-amber-700'
          : 'bg-green-50 border-green-200 text-green-700'
    }`}>
      {insufficient ? <AlertTriangle className="w-3.5 h-3.5" /> : <Zap className="w-3.5 h-3.5" />}
      <span>{balance} credits</span>
      {showEstimate && estimatedCost !== undefined && (
        <span className="text-gray-400 font-normal">· ~{estimatedCost} to generate</span>
      )}
    </div>
  );
}
