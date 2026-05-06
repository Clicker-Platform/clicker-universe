import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { EmailContext } from './types';

const Ctx = createContext<EmailContext | null>(null);

export function EmailContextProvider({
  context,
  children,
}: {
  context: EmailContext;
  children: ReactNode;
}) {
  return <Ctx.Provider value={context}>{children}</Ctx.Provider>;
}

export function useEmailContext(): EmailContext {
  const value = useContext(Ctx);
  if (!value) {
    throw new Error('useEmailContext must be used inside EmailContextProvider');
  }
  return value;
}
