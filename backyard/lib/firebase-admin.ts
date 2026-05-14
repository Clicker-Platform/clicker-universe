import type * as AdminTypes from 'firebase-admin';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const admin = require('firebase-admin') as typeof AdminTypes;

const initializeApp = (opts?: AdminTypes.AppOptions) => admin.initializeApp(opts);
const getApps = () => admin.apps || [];
const cert = (cred: AdminTypes.ServiceAccount) => admin.credential.cert(cred);

import type { App } from 'firebase-admin/app';
import type { Firestore } from 'firebase-admin/firestore';

function initializeAdminApp(): App {
  const apps = getApps();
  if (apps.length > 0) return apps[0] as App;

  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      let credential: AdminTypes.ServiceAccount;
      if (serviceAccountKey.endsWith('.json') || serviceAccountKey.startsWith('/') || serviceAccountKey.startsWith('./')) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const path = require('path');
        const keyPath = path.resolve(process.cwd(), serviceAccountKey);
        credential = JSON.parse(fs.readFileSync(keyPath, 'utf-8'));
      } else {
        credential = JSON.parse(serviceAccountKey);
      }
      return initializeApp({
        credential: cert(credential),
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      }) as App;
    } catch (error) {
      console.error('[firebase-admin] Failed to load GCP_SERVICE_ACCOUNT_KEY:', error);
    }
  }

  return initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID }) as App;
}

export const adminApp: App = initializeAdminApp();
export const adminDb: Firestore = admin.firestore(adminApp);
export const adminAuth = admin.auth(adminApp);
export const FieldValue = admin.firestore.FieldValue;
