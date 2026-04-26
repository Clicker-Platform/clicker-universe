'use client';

import { useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function TokenBootstrap() {
    useEffect(() => {
        const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
        if (!token) return;

        // Hapus dari URL segera — tidak boleh ada di browser history
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Sign in background — onAuthStateChanged di UserProvider akan fire setelah ini
        signInWithCustomToken(auth, decodeURIComponent(token)).catch(() => {
            const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
            if (gatewayUrl) window.location.href = `${gatewayUrl}?error=auth_failed`;
        });
    }, []);

    return null;
}
