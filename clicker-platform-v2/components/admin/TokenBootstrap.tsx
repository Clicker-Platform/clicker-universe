'use client';

import { useEffect } from 'react';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useSite } from '@/lib/site-context';

export function TokenBootstrap() {
    const { setSiteId } = useSite();

    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const token = params.get('token');
        if (!token) return;

        // Tandai ke UserProvider: jangan conclude loading=false dulu
        sessionStorage.setItem('__token_bootstrapping', '1');

        // Hapus dari URL segera — tidak boleh ada di browser history
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Set __session cookie di origin platform (penting untuk localhost — gateway di port berbeda)
        const siteId = params.get('siteId');
        if (siteId) {
            const isSecure = window.location.protocol === 'https:';
            const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || 'clicker.id';
            const domainAttr = isSecure ? `; Domain=.${baseDomain}` : '';
            const secureAttr = isSecure ? '; Secure' : '';
            document.cookie = `__session=${siteId}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax${secureAttr}${domainAttr}`;
            // Update SiteContext langsung — tidak perlu reload halaman
            setSiteId(siteId);
        }

        signInWithCustomToken(auth, decodeURIComponent(token))
            .then(() => {
                sessionStorage.removeItem('__token_bootstrapping');
            })
            .catch(() => {
                sessionStorage.removeItem('__token_bootstrapping');
                const gatewayUrl = process.env.NEXT_PUBLIC_AUTH_GATEWAY_URL;
                if (gatewayUrl) window.location.href = `${gatewayUrl}?error=auth_failed`;
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally runs once on mount to process URL hash token
    }, []);

    return null;
}
