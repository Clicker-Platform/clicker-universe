import { db } from '@/lib/firebase';
import { doc, collection, getAggregateFromServer, sum } from 'firebase/firestore';

export const SHARD_COUNT = 10;

/** Returns a random shard id between '0' and '9' */
export function randomShardId(): string {
    return String(Math.floor(Math.random() * SHARD_COUNT));
}

/** Returns the DocumentReference for a specific analytics shard */
export function analyticsShardRef(siteId: string, shardId: string) {
    return doc(db, 'sites', siteId, 'analytics_shards', shardId);
}

/**
 * Sums pageViews and totalClicks across all shards.
 * Uses Firestore Aggregation API — no document downloads needed.
 */
export async function getSiteStatsTotals(
    siteId: string
): Promise<{ pageViews: number; totalClicks: number }> {
    const shardsCol = collection(db, 'sites', siteId, 'analytics_shards');
    const snap = await getAggregateFromServer(shardsCol, {
        pageViews: sum('pageViews'),
        totalClicks: sum('totalClicks'),
    });
    return {
        pageViews: snap.data().pageViews ?? 0,
        totalClicks: snap.data().totalClicks ?? 0,
    };
}
