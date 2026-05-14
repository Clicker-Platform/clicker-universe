/**
 * sync-to-prod.ts
 *
 * Cloud Function yang berjalan di STAGING dan mirror perubahan
 * site "go" ke PRODUCTION secara realtime.
 *
 * Trigger:
 *  - Firestore: onDocumentWritten  sites/go/{col}/{docId} (level 1, 2, 3)
 *  - Storage  : onObjectFinalized + onObjectDeleted  sites/go/**
 */

import {
    onDocumentWritten,
} from "firebase-functions/v2/firestore";
import {
    onObjectFinalized,
    onObjectDeleted,
} from "firebase-functions/v2/storage";
import * as admin from "firebase-admin";

const SITE_ID = "go";
const REGION  = "us-central1";

// ─── Init Production App (secondary) ─────────────────────────────────────────

let _prodApp: admin.app.App | null = null;

function getProdApp(): admin.app.App {
    if (_prodApp) return _prodApp;
    const existing = admin.apps.find(a => a?.name === "prod-mirror");
    if (existing) { _prodApp = existing; return _prodApp; }

    const prodSA = require("../service-account-prod.json");
    _prodApp = admin.initializeApp({
        credential:    admin.credential.cert(prodSA),
        storageBucket: "clicker-universe.firebasestorage.app",
    }, "prod-mirror");

    console.log("[sync-to-prod] Production app initialized");
    return _prodApp;
}

const getProdDb     = () => admin.firestore(getProdApp());
const getProdBucket = () => admin.storage(getProdApp()).bucket();

// ─── Helper: mirror doc ke prod ──────────────────────────────────────────────

async function mirrorDoc(
    prodRef: admin.firestore.DocumentReference,
    change: { before: admin.firestore.DocumentSnapshot; after: admin.firestore.DocumentSnapshot }
): Promise<void> {
    if (!change.after.exists) {
        await prodRef.delete();
    } else {
        await prodRef.set(change.after.data()!);
    }
}

// ─── Firestore Trigger Level 1: sites/go/{col}/{docId} ───────────────────────

export const syncGoFirestore = onDocumentWritten(
    { document: `sites/${SITE_ID}/{col}/{docId}`, region: REGION },
    async (event) => {
        const { col, docId } = event.params;
        const prodRef = getProdDb()
            .collection("sites").doc(SITE_ID)
            .collection(col).doc(docId);

        console.log(`[sync L1] ${event.data?.after.exists ? "WRITE" : "DELETE"} ${col}/${docId}`);
        await mirrorDoc(prodRef, event.data!);
    }
);

// ─── Firestore Trigger Level 2: sites/go/{col}/{docId}/{subCol}/{subDocId} ───

export const syncGoFirestoreDeep = onDocumentWritten(
    { document: `sites/${SITE_ID}/{col}/{docId}/{subCol}/{subDocId}`, region: REGION },
    async (event) => {
        const { col, docId, subCol, subDocId } = event.params;
        const prodRef = getProdDb()
            .collection("sites").doc(SITE_ID)
            .collection(col).doc(docId)
            .collection(subCol).doc(subDocId);

        console.log(`[sync L2] ${event.data?.after.exists ? "WRITE" : "DELETE"} ${col}/${docId}/${subCol}/${subDocId}`);
        await mirrorDoc(prodRef, event.data!);
    }
);

// ─── Firestore Trigger Level 3: modules/byod_pos/orders/{orderId} ────────────

export const syncGoFirestoreLevel3 = onDocumentWritten(
    { document: `sites/${SITE_ID}/{col}/{docId}/{subCol}/{subDocId}/{deepCol}/{deepDocId}`, region: REGION },
    async (event) => {
        const { col, docId, subCol, subDocId, deepCol, deepDocId } = event.params;
        const prodRef = getProdDb()
            .collection("sites").doc(SITE_ID)
            .collection(col).doc(docId)
            .collection(subCol).doc(subDocId)
            .collection(deepCol).doc(deepDocId);

        console.log(`[sync L3] ${event.data?.after.exists ? "WRITE" : "DELETE"} ${deepCol}/${deepDocId}`);
        await mirrorDoc(prodRef, event.data!);
    }
);

// ─── Storage Trigger: Upload file ke sites/go/** ──────────────────────────────

export const syncGoStorageUpload = onObjectFinalized(
    { region: REGION },
    async (event) => {
        const filePath = event.data.name || "";
        if (!filePath.startsWith(`sites/${SITE_ID}/`)) return;

        console.log(`[sync] STORAGE UPLOAD ${filePath}`);
        try {
            const stagingBucket = admin.storage().bucket();
            const prodBucket    = getProdBucket();
            const [content]     = await stagingBucket.file(filePath).download();
            await prodBucket.file(filePath).save(content, {
                contentType: event.data.contentType || "application/octet-stream",
                metadata: { ...(event.data.metadata || {}) },
            });
            console.log(`[sync] STORAGE UPLOAD done: ${filePath}`);
        } catch (e) {
            console.error('[sync] STORAGE UPLOAD error:', filePath, e);
        }
    }
);

// ─── Storage Trigger: Delete file dari sites/go/** ───────────────────────────

export const syncGoStorageDelete = onObjectDeleted(
    { region: REGION },
    async (event) => {
        const filePath = event.data.name || "";
        if (!filePath.startsWith(`sites/${SITE_ID}/`)) return;

        console.log(`[sync] STORAGE DELETE ${filePath}`);
        try {
            await getProdBucket().file(filePath).delete();
            console.log(`[sync] STORAGE DELETE done: ${filePath}`);
        } catch (e: any) {
            if (e.code === 404) {
                console.log(`[sync] STORAGE DELETE skip (not found): ${filePath}`);
            } else {
                console.error('[sync] STORAGE DELETE error:', filePath, e);
            }
        }
    }
);
