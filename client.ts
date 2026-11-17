import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  initializeFirestore,
  limit,
  onSnapshot,
  orderBy,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';
import type { DynamicFirebaseConfig, UserRole } from '../types';

export const FIREBASE_CONFIG_STORAGE_KEY = 'gmcsl_firebase_config_v1';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function loadStoredFirebaseConfig(): DynamicFirebaseConfig | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = window.localStorage.getItem(FIREBASE_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DynamicFirebaseConfig;
    if (parsed && parsed.apiKey && parsed.authDomain && parsed.projectId) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function getActiveFirebaseConfig(): DynamicFirebaseConfig & { isCustomOverride: boolean } {
  const stored = loadStoredFirebaseConfig();
  if (stored) {
    return {
      ...stored,
      firestoreDatabaseId: stored.firestoreDatabaseId || defaultFirebaseConfig.firestoreDatabaseId,
      isCustomOverride: true,
    };
  }
  return {
    ...(defaultFirebaseConfig as DynamicFirebaseConfig),
    isCustomOverride: false,
  };
}

function createFirebaseHandles(cfg: DynamicFirebaseConfig): {
  app: FirebaseApp;
  db: Firestore;
  auth: Auth;
} {
  const existing = getApps();
  const appInstance =
    existing.length > 0
      ? existing[0]
      : initializeApp({
          apiKey: cfg.apiKey,
          authDomain: cfg.authDomain,
          databaseURL: cfg.databaseURL || undefined,
          projectId: cfg.projectId,
          storageBucket: cfg.storageBucket || undefined,
          messagingSenderId: cfg.messagingSenderId || undefined,
          appId: cfg.appId || undefined,
          measurementId: cfg.measurementId || undefined,
        });

  let firestoreInstance: Firestore;
  try {
    firestoreInstance = initializeFirestore(
      appInstance,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      cfg.firestoreDatabaseId || undefined
    );
  } catch {
    firestoreInstance = initializeFirestore(appInstance, {}, cfg.firestoreDatabaseId || undefined);
  }

  return {
    app: appInstance,
    db: firestoreInstance,
    auth: getAuth(appInstance),
  };
}

const initialHandles = createFirebaseHandles(getActiveFirebaseConfig());
export let app: FirebaseApp = initialHandles.app;
export let db: Firestore = initialHandles.db;
export let auth: Auth = initialHandles.auth;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

const reinitListeners = new Set<() => void>();
export function subscribeFirebaseAppChange(cb: () => void): () => void {
  reinitListeners.add(cb);
  return () => {
    reinitListeners.delete(cb);
  };
}

export async function saveAndReinitFirebase(cfg: DynamicFirebaseConfig): Promise<void> {
  if (!cfg.apiKey || !cfg.authDomain || !cfg.projectId) {
    throw new Error('apiKey, authDomain, and projectId are required for Firebase initialization.');
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(FIREBASE_CONFIG_STORAGE_KEY, JSON.stringify(cfg));
  }
  for (const existingApp of getApps()) {
    await deleteApp(existingApp).catch(() => undefined);
  }
  const next = createFirebaseHandles(cfg);
  app = next.app;
  db = next.db;
  auth = next.auth;
  reinitListeners.forEach((cb) => cb());
}

export async function resetFirebaseToDefault(): Promise<void> {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(FIREBASE_CONFIG_STORAGE_KEY);
  }
  for (const existingApp of getApps()) {
    await deleteApp(existingApp).catch(() => undefined);
  }
  const next = createFirebaseHandles(defaultFirebaseConfig as DynamicFirebaseConfig);
  app = next.app;
  db = next.db;
  auth = next.auth;
  reinitListeners.forEach((cb) => cb());
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      return false;
    }
    return true;
  }
}

function sanitizeId(raw: string): string {
  const cleaned = String(raw || 'REC')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || 'REC';
}

function sanitizeFieldsMap(input: Record<string, any>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const entries = Object.entries(input || {}).slice(0, 40);
  for (const [k, v] of entries) {
    const cleanKey = k.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 48);
    if (!cleanKey) continue;
    if (typeof v === 'string') {
      if (v.startsWith('data:') && v.length > 4000) continue;
      out[cleanKey] = v.slice(0, 500);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      out[cleanKey] = v;
    } else if (typeof v === 'boolean') {
      out[cleanKey] = v;
    }
  }
  return out;
}

export async function signInWithFirebaseGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function acquireGoogleDriveAccessToken(): Promise<{ accessToken: string; email: string | null }> {
  const driveProvider = new GoogleAuthProvider();
  driveProvider.addScope('https://www.googleapis.com/auth/drive.file');
  driveProvider.setCustomParameters({ prompt: 'consent' });
  const result = await signInWithPopup(auth, driveProvider);
  const cred = GoogleAuthProvider.credentialFromResult(result);
  const accessToken = cred?.accessToken || '';
  if (!accessToken) {
    throw new Error('Google OAuth completed, but no Drive access token was returned.');
  }
  return { accessToken, email: result.user.email };
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function subscribeFirebaseAuth(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb);
}

async function docExistsSafe(ref: ReturnType<typeof doc>): Promise<boolean> {
  try {
    const cached = await getDocFromCache(ref);
    if (cached.exists()) return true;
  } catch {
    // Not cached
  }
  try {
    const snap = await getDoc(ref);
    return snap.exists();
  } catch {
    return false;
  }
}

export async function ensureFirebaseUserProfile(params: {
  user: User;
  role: UserRole;
  displayName: string;
  memberId?: string;
  mobileNumber?: string;
}) {
  const uid = sanitizeId(params.user.uid);
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;

  const userRef = doc(db, 'users', uid);
  const privRef = doc(db, 'users', uid, 'private', 'info');
  const [userExists, privExists] = await Promise.all([docExistsSafe(userRef), docExistsSafe(privRef)]);

  const batch = writeBatch(db);
  if (userExists) {
    batch.set(
      userRef,
      {
        displayName: (params.displayName || params.user.displayName || 'GMCSL User').slice(0, 120),
        memberId: (params.memberId || '').slice(0, 64),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    batch.set(userRef, {
      uid,
      displayName: (params.displayName || params.user.displayName || 'GMCSL User').slice(0, 120),
      role: params.role,
      memberId: (params.memberId || '').slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (privExists) {
    batch.set(
      privRef,
      {
        email: (params.user.email || '').slice(0, 180),
        mobileNumber: (params.mobileNumber || '').slice(0, 20),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } else {
    batch.set(privRef, {
      uid,
      email: (params.user.email || '').slice(0, 180),
      mobileNumber: (params.mobileNumber || '').slice(0, 20),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${userPath} + ${privatePath}`);
  }
}

export type CloudModule =
  | 'members'
  | 'savings'
  | 'shares'
  | 'loans'
  | 'loan_repayments'
  | 'cash_book'
  | 'attendance'
  | 'loan_applications'
  | 'online_payments'
  | 'meetings'
  | 'notices'
  | 'receipts'
  | 'certificates'
  | 'society_settings';

export interface CloudSyncRecord {
  recordId: string;
  module: CloudModule;
  ownerUid: string;
  memberId?: string;
  summary?: string;
  status?: string;
  amount?: number;
  fields?: Record<string, string | number | boolean>;
  isDeleted: boolean;
  recordVersion: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function upsertRecordsToFirestore(params: {
  uid: string;
  items: Array<{
    recordId: string;
    module: CloudModule;
    memberId?: string;
    summary?: string;
    status?: string;
    amount?: number;
    fields?: Record<string, any>;
    recordVersion?: number;
  }>;
}): Promise<number> {
  const cleanUid = sanitizeId(params.uid);
  const path = `users/${cleanUid}/records`;
  if (params.items.length === 0) return 0;

  const chunkSize = 400;
  let totalSynced = 0;

  for (let i = 0; i < params.items.length; i += chunkSize) {
    const chunk = params.items.slice(i, i + chunkSize);
    const existenceChecks = await Promise.all(
      chunk.map((item) => {
        const recId = sanitizeId(`${item.module}_${item.recordId}`);
        return docExistsSafe(doc(db, 'users', cleanUid, 'records', recId));
      })
    );
    const batch = writeBatch(db);
    chunk.forEach((item, idx) => {
      const recId = sanitizeId(`${item.module}_${item.recordId}`);
      const ref = doc(db, 'users', cleanUid, 'records', recId);
      const exists = existenceChecks[idx];
      if (exists) {
        batch.set(
          ref,
          {
            summary: (item.summary || '').slice(0, 300),
            status: (item.status || 'Synced').slice(0, 64),
            amount: typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : 0,
            fields: sanitizeFieldsMap(item.fields || {}),
            isDeleted: false,
            recordVersion: Math.max(1, Number(item.recordVersion || 1)),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        batch.set(ref, {
          recordId: recId,
          module: item.module,
          ownerUid: cleanUid,
          memberId: (item.memberId || '').slice(0, 64),
          summary: (item.summary || '').slice(0, 300),
          status: (item.status || 'Synced').slice(0, 64),
          amount: typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : 0,
          fields: sanitizeFieldsMap(item.fields || {}),
          isDeleted: false,
          recordVersion: Math.max(1, Number(item.recordVersion || 1)),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      totalSynced++;
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  return totalSynced;
}

export async function deleteCloudRecordExplicitly(uid: string, recordId: string): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const cleanRecId = sanitizeId(recordId);
  const path = `users/${cleanUid}/records/${cleanRecId}`;
  try {
    await deleteDoc(doc(db, 'users', cleanUid, 'records', cleanRecId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeUserCloudRecords(
  uid: string,
  onData: (records: CloudSyncRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const cleanUid = sanitizeId(uid);
  const path = `users/${cleanUid}/records`;
  const q = query(
    collection(db, 'users', cleanUid, 'records'),
    where('isDeleted', '==', false),
    orderBy('updatedAt', 'desc'),
    limit(200)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: CloudSyncRecord[] = [];
      snapshot.forEach((docSnap) => {
        list.push(docSnap.data() as CloudSyncRecord);
      });
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        if (onError) onError(wrapped as Error);
      }
    }
  );
}

export async function saveSingleCloudRecord(
  uid: string,
  module: CloudModule,
  recordId: string,
  fields: Record<string, any>,
  meta?: { memberId?: string; summary?: string; status?: string; amount?: number; recordVersion?: number }
): Promise<void> {
  const cleanUid = sanitizeId(uid);
  const recId = sanitizeId(`${module}_${recordId}`);
  const path = `users/${cleanUid}/records/${recId}`;
  const ref = doc(db, 'users', cleanUid, 'records', recId);
  const exists = await docExistsSafe(ref);
  try {
    if (exists) {
      await setDoc(
        ref,
        {
          summary: (meta?.summary || '').slice(0, 300),
          status: (meta?.status || 'Synced').slice(0, 64),
          amount: typeof meta?.amount === 'number' && Number.isFinite(meta.amount) ? meta.amount : 0,
          fields: sanitizeFieldsMap(fields),
          isDeleted: false,
          recordVersion: Math.max(1, Number(meta?.recordVersion || 1)),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      await setDoc(ref, {
        recordId: recId,
        module,
        ownerUid: cleanUid,
        memberId: (meta?.memberId || '').slice(0, 64),
        summary: (meta?.summary || '').slice(0, 300),
        status: (meta?.status || 'Synced').slice(0, 64),
        amount: typeof meta?.amount === 'number' && Number.isFinite(meta.amount) ? meta.amount : 0,
        fields: sanitizeFieldsMap(fields),
        isDeleted: false,
        recordVersion: Math.max(1, Number(meta?.recordVersion || 1)),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}
