// clicker-platform-v2/components/admin/blocks/rich-text/hooks/useRecentColors.ts
import { useCallback, useEffect, useState } from 'react';
import { isHex } from '../tokens';

const STORAGE_KEY = 'rte:recent-colors';
const MAX = 6;

function read(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((v): v is string => typeof v === 'string' && isHex(v)).slice(0, MAX);
    } catch {
        return [];
    }
}

export function useRecentColors() {
    const [recent, setRecent] = useState<string[]>(() => read());

    useEffect(() => {
        // Sync once on mount in case localStorage changed in another tab.
        setRecent(read());
    }, []);

    const push = useCallback((hex: string) => {
        if (!isHex(hex)) return;
        setRecent(prev => {
            const next = [hex, ...prev.filter(c => c.toLowerCase() !== hex.toLowerCase())].slice(0, MAX);
            try {
                window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch { /* quota / private mode — silently ignore */ }
            return next;
        });
    }, []);

    return { recent, push };
}
