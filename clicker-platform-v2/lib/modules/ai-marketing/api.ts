'use client';

// Client-side Firestore API for AI Marketing module
// All server mutations go through API routes — this file is for real-time reads only

import { db } from '@/lib/firebase';
import {
  collection, doc, onSnapshot, query, orderBy, limit,
  Unsubscribe, getDoc, getDocs,
} from 'firebase/firestore';
import {
  MarketingSettings, MarketingAsset, MarketingGeneration,
  SavedContent, MarketingCampaign,
} from './types';
import {
  COLLECTION_SETTINGS, COLLECTION_ASSETS, COLLECTION_GENERATIONS,
  COLLECTION_SAVED, COLLECTION_CAMPAIGNS, SETTINGS_DOC_ID,
} from './constants';

function siteCol(siteId: string, col: string) {
  return `sites/${siteId}/${col}`;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getMarketingSettings(siteId: string): Promise<MarketingSettings | null> {
  const snap = await getDoc(doc(db, siteCol(siteId, COLLECTION_SETTINGS), SETTINGS_DOC_ID));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as any;
}

// ─── Assets ──────────────────────────────────────────────────────────────────

export function subscribeAssets(
  siteId: string,
  callback: (assets: MarketingAsset[]) => void
): Unsubscribe {
  const q = query(
    collection(db, siteCol(siteId, COLLECTION_ASSETS)),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketingAsset)));
  });
}

export async function getAsset(siteId: string, assetId: string): Promise<MarketingAsset | null> {
  const snap = await getDoc(doc(db, siteCol(siteId, COLLECTION_ASSETS), assetId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MarketingAsset;
}

// ─── Generations ─────────────────────────────────────────────────────────────

export function subscribeRecentGenerations(
  siteId: string,
  callback: (gens: MarketingGeneration[]) => void,
  limitCount = 20
): Unsubscribe {
  const q = query(
    collection(db, siteCol(siteId, COLLECTION_GENERATIONS)),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketingGeneration)));
  });
}

// ─── Saved Content ────────────────────────────────────────────────────────────

export function subscribeSavedContent(
  siteId: string,
  callback: (items: SavedContent[]) => void
): Unsubscribe {
  const q = query(
    collection(db, siteCol(siteId, COLLECTION_SAVED)),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedContent)));
  });
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export function subscribeCampaigns(
  siteId: string,
  callback: (campaigns: MarketingCampaign[]) => void
): Unsubscribe {
  const q = query(
    collection(db, siteCol(siteId, COLLECTION_CAMPAIGNS)),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as MarketingCampaign)));
  });
}

export async function getCampaign(siteId: string, campaignId: string): Promise<MarketingCampaign | null> {
  const snap = await getDoc(doc(db, siteCol(siteId, COLLECTION_CAMPAIGNS), campaignId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as MarketingCampaign;
}

// ─── Credits ─────────────────────────────────────────────────────────────────

export function subscribeCreditBalance(
  siteId: string,
  callback: (balance: number, lifetimeUsed: number) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, `sites/${siteId}/platform/aiCredits`),
    (snap) => {
      if (!snap.exists()) {
        callback(0, 0);
        return;
      }
      const data = snap.data();
      callback(data.balance ?? 0, data.lifetimeUsed ?? 0);
    }
  );
}

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

export async function apiPost(url: string, body: any, token: string, siteId: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-site-id': siteId,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

export async function apiGet(url: string, token: string, siteId: string) {
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'x-site-id': siteId,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }
  return res.json();
}
