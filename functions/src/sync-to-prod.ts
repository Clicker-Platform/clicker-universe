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

const PROD_PROJECT_ID = "clicker-universe";
const PROD_BUCKET = "clicker-universe.firebasestorage.app";

// Self-loop guard: this module mirrors staging → prod. If deployed to prod
// itself, the trigger on sites/go/* would fire on its OWN writes, causing an
// infinite write loop (10k+ writes/sec, caused the May 25 incident).
// Detect host project via GCP env vars and short-circuit any handler.
const CURRENT_PROJECT_ID =
    process.env.GCP_PROJECT
    || process.env.GCLOUD_PROJECT
    || process.env.GOOGLE_CLOUD_PROJECT
    || '';
const IS_PROD_DEPLOY = CURRENT_PROJECT_ID === PROD_PROJECT_ID;
if (IS_PROD_DEPLOY) {
    console.warn(
        `[sync-to-prod] DISABLED: this module is deployed in prod project ` +
        `(${CURRENT_PROJECT_ID}). Mirror direction is staging→prod only — running ` +
        `in prod would create a self-write loop. All handlers will no-op.`
    );
}

function getProdApp(): admin.app.App {
    if (_prodApp) return _prodApp;
    const existing = admin.apps.find(a => a?.name === "prod-mirror");
    if (existing) { _prodApp = existing; return _prodApp; }

    // Use Application Default Credentials (ADC) — staging compute SA has
    // cross-project IAM bindings on prod (roles/datastore.user, roles/storage.objectAdmin).
    // No service account JSON or secret needed.
    _prodApp = admin.initializeApp({
        credential:    admin.credential.applicationDefault(),
        projectId:     PROD_PROJECT_ID,
        storageBucket: PROD_BUCKET,
    }, "prod-mirror");

    console.log("[sync-to-prod] Production app initialized via ADC");
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
        if (IS_PROD_DEPLOY) return;
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
        if (IS_PROD_DEPLOY) return;
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
        if (IS_PROD_DEPLOY) return;
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
        if (IS_PROD_DEPLOY) return;
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
        if (IS_PROD_DEPLOY) return;
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
