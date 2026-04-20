import { auth } from '@/lib/firebase';

export async function purgeTenantCache(siteId: string): Promise<void> {
    try {
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        await fetch('/api/admin/cache/purge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ siteId }),
        });
    } catch {
        // silent fail — cache goes stale max 60s then auto-refreshes
    }
}
