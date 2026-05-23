'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useAICreditStatus, type AICreditStatus } from '@/lib/hooks/use-ai-credit-status';

const Ctx = createContext<AICreditStatus | null>(null);

/**
 * Mount once near the admin top bar. All AI-credit consumers
 * (pill, launcher card, popover card) read from this context so the
 * Firestore subscriptions and /api/admin/ai-credits fetch happen once,
 * not once per consumer.
 */
export function AICreditStatusProvider({ children }: { children: ReactNode }) {
  const status = useAICreditStatus();
  return <Ctx.Provider value={status}>{children}</Ctx.Provider>;
}

/**
 * Read AI credit status from the shared provider. Throws if no provider is
 * mounted above — all AI-credit consumers must be descendants of
 * <AICreditStatusProvider> (mounted in AdminTopBar).
 */
export function useAICreditStatusContext(): AICreditStatus {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAICreditStatusContext must be used inside <AICreditStatusProvider>');
  return v;
}
