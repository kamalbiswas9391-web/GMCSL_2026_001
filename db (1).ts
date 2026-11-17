import { openDB, type IDBPDatabase } from 'idb';
import { decryptLocalPayload, encryptLocalPayload } from './crypto';
import type {
  AuthSession,
  PendingSyncOperation,
} from '../types';

const DB_NAME = 'gmcsl_society_offline_db';
const DB_VERSION = 2;

// Stores specified for offline-first persistence + session_meta
export const OFFLINE_STORES = [
  'members',
  'system_users',
  'savings',
  'loans',
  'loan_repayments',
  'loan_applications',
  'shares',
  'cash_book',
  'attendance',
  'meetings',
  'online_payments',
  'notifications',
  'notices',
  'receipts',
  'certificates',
  'permissions',
  'society_settings',
  'media_metadata',
  'pending_sync_queue',
  'sync_history',
  'offline_audit_queue',
  'session_meta',
] as const;

export type OfflineStoreName = (typeof OFFLINE_STORES)[number];

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const keyPaths: Record<OfflineStoreName, string> = {
          members: 'memberId',
          system_users: 'userId',
          savings: 'savingId',
          loans: 'loanId',
          loan_repayments: 'repaymentId',
          loan_applications: 'applicationId',
          shares: 'shareId',
          cash_book: 'transactionId',
          attendance: 'attendanceId',
          meetings: 'meetingId',
          online_payments: 'paymentId',
          notifications: 'notificationId',
          notices: 'noticeId',
          receipts: 'receiptNumber',
          certificates: 'certificateNumber',
          permissions: 'id',
          society_settings: 'id',
          media_metadata: 'mediaId',
          pending_sync_queue: 'operationId',
          sync_history: 'id',
          offline_audit_queue: 'id',
          session_meta: 'key',
        };
        for (const store of OFFLINE_STORES) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: keyPaths[store] });
          }
        }
      },
    });
  }
  return dbPromise;
}

export async function putAllInStore<T extends Record<string, any>>(store: OfflineStoreName, items: T[], replace = false) {
  const db = await getOfflineDB();
  const tx = db.transaction(store, 'readwrite');
  if (replace) {
    await tx.store.clear();
  }
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export async function putOneInStore<T extends Record<string, any>>(store: OfflineStoreName, item: T) {
  const db = await getOfflineDB();
  await db.put(store, item);
}

export async function getAllFromStore<T>(store: OfflineStoreName): Promise<T[]> {
  const db = await getOfflineDB();
  return (await db.getAll(store)) as T[];
}

export async function deleteFromStore(store: OfflineStoreName, key: string) {
  const db = await getOfflineDB();
  await db.delete(store, key);
}

export async function saveSecureSession(session: AuthSession) {
  const encrypted = await encryptLocalPayload(JSON.stringify(session));
  await putOneInStore('session_meta', { key: 'active_session', value: encrypted, updatedAt: new Date().toISOString() });
}

export async function loadSecureSession(): Promise<AuthSession | null> {
  const db = await getOfflineDB();
  const row = (await db.get('session_meta', 'active_session')) as { value: string } | undefined;
  if (!row?.value) return null;
  const decrypted = await decryptLocalPayload(row.value);
  if (!decrypted) return null;
  try {
    const session = JSON.parse(decrypted) as AuthSession;
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function clearSessionTokenOnly() {
  const db = await getOfflineDB();
  await db.delete('session_meta', 'active_session');
  await db.delete('session_meta', 'hidden_since');
}

export async function saveHiddenTimestamp(ts: number) {
  await putOneInStore('session_meta', { key: 'hidden_since', value: ts, updatedAt: new Date().toISOString() });
}

export async function loadHiddenTimestamp(): Promise<number | null> {
  const db = await getOfflineDB();
  const row = (await db.get('session_meta', 'hidden_since')) as { value: number } | undefined;
  return typeof row?.value === 'number' ? row.value : null;
}

export async function clearHiddenTimestamp() {
  const db = await getOfflineDB();
  await db.delete('session_meta', 'hidden_since');
}

export async function clearSensitiveUserCacheOnLogout(preserveUnsyncedQueue = true) {
  const db = await getOfflineDB();
  await db.delete('session_meta', 'active_session');
  await db.delete('session_meta', 'hidden_since');
  const sensitiveStores: OfflineStoreName[] = [
    'members',
    'system_users',
    'savings',
    'loans',
    'loan_repayments',
    'loan_applications',
    'shares',
    'cash_book',
    'attendance',
    'online_payments',
    'notifications',
    'receipts',
    'certificates',
  ];
  // Never silently discard pending offline financial items unless explicitly flushed
  for (const s of sensitiveStores) {
    if (preserveUnsyncedQueue) {
      const items = (await db.getAll(s)) as Array<{ syncStatus?: string }>;
      const pendingItems = items.filter((i) => i.syncStatus && i.syncStatus !== 'Synced');
      const tx = db.transaction(s, 'readwrite');
      await tx.store.clear();
      for (const p of pendingItems) {
        await tx.store.put(p);
      }
      await tx.done;
    } else {
      await db.clear(s);
    }
  }
}

export async function enqueueOfflineOperation(op: PendingSyncOperation) {
  await putOneInStore('pending_sync_queue', op);
  await putOneInStore('offline_audit_queue', {
    id: `OAUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    operationId: op.operationId,
    module: op.module,
    action: op.action,
    recordId: op.recordId,
    createdBy: op.createdBy,
    timestamp: op.createdAt,
  });
}

export async function getPendingQueue(): Promise<PendingSyncOperation[]> {
  const items = await getAllFromStore<PendingSyncOperation>('pending_sync_queue');
  return items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export async function getSyncHistory(): Promise<Array<{ id: string; timestamp: string; summary: string; status: string; count: number }>> {
  const items = await getAllFromStore<any>('sync_history');
  return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}
