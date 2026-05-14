'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useAuthToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const t = await user.getIdToken();
        setToken(t);
      } else {
        setToken(null);
      }
    });
    return unsub;
  }, []);

  return token;
}
