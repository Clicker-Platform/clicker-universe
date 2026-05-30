'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

type AccountAuthState = { user: User | null; loading: boolean };

const Ctx = createContext<AccountAuthState>({ user: null, loading: true });

export function useAccountAuth() {
  return useContext(Ctx);
}

export function AccountAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccountAuthState>({ user: null, loading: true });

  useEffect(() => onAuthStateChanged(auth, (user) => setState({ user, loading: false })), []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}
