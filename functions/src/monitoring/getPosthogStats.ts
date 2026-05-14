import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const POSTHOG_PERSONAL_API_KEY = defineSecret('POSTHOG_PERSONAL_API_KEY');
const POSTHOG_PROJECT_ID = defineSecret('POSTHOG_PROJECT_ID');

interface ActivityRow {
    event: string;
    url: string | null;
    count: number;
    lastSeenAt: string | null;
}

interface StatsResult {
    health: {
        reachable: boolean;
        totalEvents24h: number;
        lastEventAt: string | null;
        errorCode?: 'auth' | 'rate_limit' | 'network' | 'unknown';
        errorMessage?: string;
        retryAfterSec?: number;
    };
    perActivity: ActivityRow[];
}

const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

async function hogql(
    query: string,
    apiKey: string,
    projectId: string,
): Promise<unknown[][]> {
    const resp = await fetch(`${HOST}/api/projects/${projectId}/query/`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    });
    if (!resp.ok) {
        const retryAfter = resp.headers?.get?.('Retry-After');
        const err = Object.assign(new Error(`PostHog ${resp.status}`), {
            status: resp.status,
            retryAfterSec: retryAfter ? Number(retryAfter) : undefined,
        }) as Error & { status: number; retryAfterSec?: number };
        throw err;
    }
    const json = (await resp.json()) as { results?: unknown[][] };
    return json.results ?? [];
}

export async function runPosthogStats(
    apiKey: string,
    projectId: string,
): Promise<StatsResult> {
    try {
        if (!apiKey || !projectId) {
            throw Object.assign(new Error('POSTHOG secrets not set'), { code: 'config' });
        }

        const Q_HEALTH = `SELECT count() AS c, max(timestamp) AS last FROM events WHERE timestamp > now() - INTERVAL 24 HOUR`;
        const Q_ACTIVITY = `SELECT event, properties.$current_url AS url, count() AS c, max(timestamp) AS last FROM events WHERE timestamp > now() - INTERVAL 24 HOUR GROUP BY event, properties.$current_url ORDER BY c DESC LIMIT 100`;

        const [healthRows, activityRows] = await Promise.all([
            hogql(Q_HEALTH, apiKey, projectId),
            hogql(Q_ACTIVITY, apiKey, projectId),
        ]);

        const health = {
            reachable: true,
            totalEvents24h: Number(healthRows[0]?.[0] ?? 0),
            lastEventAt: (healthRows[0]?.[1] as string | null | undefined) ?? null,
        };

        const perActivity: ActivityRow[] = activityRows.map((r) => ({
            event: String(r[0] ?? ''),
            url: (r[1] as string | null | undefined) ?? null,
            count: Number(r[2] ?? 0),
            lastSeenAt: (r[3] as string | null | undefined) ?? null,
        }));

        return { health, perActivity };
    } catch (err) {
        const e = err as { status?: number; message?: string; retryAfterSec?: number; code?: string };
        let errorCode: 'auth' | 'rate_limit' | 'network' | 'unknown' = 'unknown';
        if (e.status === 401 || e.status === 403) errorCode = 'auth';
        else if (e.status === 429) errorCode = 'rate_limit';
        else if (e.code === 'config' || e.status === undefined) errorCode = 'network';
        return {
            health: {
                reachable: false,
                totalEvents24h: 0,
                lastEventAt: null,
                errorCode,
                errorMessage: e.message ?? 'unknown error',
                retryAfterSec: e.retryAfterSec,
            },
            perActivity: [],
        };
    }
}

export const getPosthogStats = onCall(
    {
        secrets: [POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID],
        region: 'asia-southeast1',
        cors: ['https://backyard.clicker.id', 'http://localhost:3013'],
    },
    async (request) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Auth required');
        }
        return runPosthogStats(
            POSTHOG_PERSONAL_API_KEY.value(),
            POSTHOG_PROJECT_ID.value(),
        );
    },
);
