import {
  deleteFromStore,
  enqueueOfflineOperation,
  getAllFromStore,
  getPendingQueue,
  putAllInStore,
  putOneInStore,
  type OfflineStoreName,
} from './db';
import type {
  AuthSession,
  DashboardStats,
  PendingSyncOperation,
  RolePermission,
  SocietySettings,
} from '../types';

export interface SyncPullSnapshot {
  syncedAt: string;
  settings: SocietySettings;
  permissions: RolePermission[];
  stats: DashboardStats;
  members: any[];
  savings: any[];
  shares: any[];
  loans: any[];
  loanRepayments: any[];
  cashBook: any[];
  attendance: any[];
  loanApplications: any[];
  onlinePayments: any[];
  meetings: any[];
  notices: any[];
  notifications: any[];
  receipts: any[];
  certificates: any[];
  media: any[];
  systemUsers: any[];
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function pullAuthorizedSnapshot(token: string): Promise<SyncPullSnapshot> {
  const snap = await apiFetch<SyncPullSnapshot>('/api/sync/pull', { method: 'GET' }, token);

  // Persist each authorized dataset into its dedicated IndexedDB store
  await Promise.all([
    putAllInStore('society_settings', [{ id: 'default', ...snap.settings }], true),
    putAllInStore('permissions', snap.permissions, true),
    putAllInStore('members', snap.members, false),
    putAllInStore('savings', snap.savings, false),
    putAllInStore('shares', snap.shares, false),
    putAllInStore('loans', snap.loans, false),
    putAllInStore('loan_repayments', snap.loanRepayments || [], false),
    putAllInStore('cash_book', snap.cashBook, false),
    putAllInStore('attendance', snap.attendance, false),
    putAllInStore('loan_applications', snap.loanApplications, false),
    putAllInStore('online_payments', snap.onlinePayments, false),
    putAllInStore('meetings', snap.meetings, false),
    putAllInStore('notices', snap.notices, true),
    putAllInStore('notifications', snap.notifications, true),
    putAllInStore('receipts', snap.receipts, false),
    putAllInStore('certificates', snap.certificates, false),
    putAllInStore('media_metadata', snap.media, true),
    putAllInStore('system_users', snap.systemUsers || [], true),
  ]);

  await putOneInStore('session_meta', {
    key: 'last_synced_at',
    value: snap.syncedAt,
  });

  return snap;
}

export async function loadOfflineSnapshot(session: AuthSession): Promise<SyncPullSnapshot> {
  const [
    settingsRows,
    permissions,
    members,
    savings,
    shares,
    loans,
    loanRepayments,
    cashBook,
    attendance,
    loanApplications,
    onlinePayments,
    meetings,
    notices,
    notifications,
    receipts,
    certificates,
    media,
    systemUsers,
    metaRows,
  ] = await Promise.all([
    getAllFromStore<any>('society_settings'),
    getAllFromStore<RolePermission>('permissions'),
    getAllFromStore<any>('members'),
    getAllFromStore<any>('savings'),
    getAllFromStore<any>('shares'),
    getAllFromStore<any>('loans'),
    getAllFromStore<any>('loan_repayments'),
    getAllFromStore<any>('cash_book'),
    getAllFromStore<any>('attendance'),
    getAllFromStore<any>('loan_applications'),
    getAllFromStore<any>('online_payments'),
    getAllFromStore<any>('meetings'),
    getAllFromStore<any>('notices'),
    getAllFromStore<any>('notifications'),
    getAllFromStore<any>('receipts'),
    getAllFromStore<any>('certificates'),
    getAllFromStore<any>('media_metadata'),
    getAllFromStore<any>('system_users'),
    getAllFromStore<any>('session_meta'),
  ]);

  const lastSyncMeta = metaRows.find((m) => m.key === 'last_synced_at');
  const syncedAt = lastSyncMeta?.value || session.issuedAt;
  const isMember = session.user.role === 'Member';
  const mid = session.user.memberId || '';

  // Strict member isolation even when reading local IndexedDB cache
  const filterOwn = <T extends { memberId?: string }>(arr: T[]) =>
    isMember ? arr.filter((r) => r.memberId === mid) : arr;

  const filteredMembers = filterOwn(members);
  const filteredSavings = filterOwn(savings);
  const filteredShares = filterOwn(shares);
  const filteredLoans = filterOwn(loans);
  const filteredLoanRepayments = filterOwn(loanRepayments);
  const filteredAttendance = filterOwn(attendance);
  const filteredLoanApps = filterOwn(loanApplications);
  const filteredPayments = filterOwn(onlinePayments);
  const filteredReceipts = filterOwn(receipts);
  const filteredCerts = filterOwn(certificates);
  const filteredCashBook = isMember ? [] : cashBook;

  const activeLoans = filteredLoans.filter((l) => l.loanStatus === 'Active' || l.loanStatus === 'Running').length;
  const closedLoans = filteredLoans.filter((l) => l.loanStatus === 'Close').length;
  const inactiveLoans = filteredLoans.filter((l) => l.loanStatus === 'Inactive').length;

  let totalBankBalance = 0;
  let totalCashBalance = 0;
  let totalCashDepositCount = 0;
  let totalCashDepositAmount = 0;
  let totalCashPaymentCount = 0;
  let totalCashPaymentAmount = 0;
  for (const cb of filteredCashBook) {
    if (cb.paymentMode === 'Deposit') {
      totalBankBalance += Number(cb.bankAmount || 0);
      totalCashBalance += Number(cb.cashAmount || 0);
      totalCashDepositCount += 1;
      totalCashDepositAmount += Number(cb.totalAmount || 0);
    } else {
      totalBankBalance -= Number(cb.bankAmount || 0);
      totalCashBalance -= Number(cb.cashAmount || 0);
      totalCashPaymentCount += 1;
      totalCashPaymentAmount += Number(cb.totalAmount || 0);
    }
  }

  const currentMonth = new Date().toISOString().slice(0, 7);
  const stats: DashboardStats = {
    totalMembers: filteredMembers.length,
    activeMembers: filteredMembers.filter((m) => m.accountStatus === 'Active').length,
    inactiveMembers: filteredMembers.filter((m) => m.accountStatus !== 'Active').length,
    totalMonthlySavings: filteredSavings
      .filter((s) => String(s.date).startsWith(currentMonth))
      .reduce((acc, s) => acc + Number(s.monthlySavingAmount || 0), 0),
    totalSavings: filteredSavings.reduce((acc, s) => acc + Number(s.totalSaving || 0), 0),
    totalShares: filteredShares.reduce((acc, s) => acc + Number(s.numberOfShares || 0), 0),
    totalShareValue: filteredShares.reduce((acc, s) => acc + Number(s.totalShareValue || 0), 0),
    totalLoanDisbursed: filteredLoans.reduce((acc, l) => acc + Number(l.loanAmount || 0), 0),
    totalLoanBalance: filteredLoans.reduce((acc, l) => acc + Number(l.currentLoanBalance || 0), 0),
    totalLoanInterest: filteredLoans.reduce((acc, l) => acc + Number(l.interest || 0), 0),
    totalLoanFine: filteredLoans.reduce((acc, l) => acc + Number(l.fine || 0), 0),
    totalLoanRepaid: filteredLoans.reduce((acc, l) => acc + Number(l.loanRepayment || 0), 0),
    activeLoans,
    closedLoans,
    inactiveLoans,
    totalBankBalance,
    totalCashBalance,
    totalCashDepositCount,
    totalCashDepositAmount,
    totalCashPaymentCount,
    totalCashPaymentAmount,
    totalLoanApplications: filteredLoanApps.length,
    totalOnlinePayments: filteredPayments.length,
    totalLoanRepayments: filteredLoanRepayments.length,
    pendingLoanApplications: filteredLoanApps.filter((a) => ['Pending', 'Under Review', 'Recommended'].includes(a.applicationStatus)).length,
    pendingOnlinePayments: filteredPayments.filter((p) => p.verificationStatus === 'Pending').length,
    totalMeetings: meetings.length,
    isLive: false,
    lastSyncedAt: syncedAt,
  };

  return {
    syncedAt,
    settings: settingsRows[0] || ({} as SocietySettings),
    permissions,
    stats,
    members: filteredMembers,
    savings: filteredSavings,
    shares: filteredShares,
    loans: filteredLoans,
    loanRepayments: filteredLoanRepayments,
    cashBook: filteredCashBook,
    attendance: filteredAttendance,
    loanApplications: filteredLoanApps,
    onlinePayments: filteredPayments,
    meetings,
    notices,
    notifications,
    receipts: filteredReceipts,
    certificates: filteredCerts,
    media,
    systemUsers: session.user.role === 'System' ? systemUsers : [],
  };
}

export async function queueOfflineRecord(params: {
  store: OfflineStoreName;
  module: string;
  action: 'create' | 'update' | 'delete';
  recordId: string;
  baseVersion?: number;
  localRecord: Record<string, any>;
  payload: Record<string, any>;
  session: AuthSession;
  provisionalReceipt?: Record<string, any>;
}) {
  const operationId = `OP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const now = new Date().toISOString();

  const enrichedLocal = {
    ...params.localRecord,
    id: params.recordId,
    createdDate: params.localRecord.createdDate || now,
    updatedDate: now,
    createdBy: params.localRecord.createdBy || params.session.user.fullName,
    updatedBy: params.session.user.fullName,
    syncStatus: 'Pending',
    lastSyncedTime: '',
    recordVersion: params.baseVersion || 1,
    offlineOperationId: operationId,
  };

  await putOneInStore(params.store, enrichedLocal);

  if (params.provisionalReceipt) {
    await putOneInStore('receipts', params.provisionalReceipt);
  }

  const op: PendingSyncOperation = {
    operationId,
    module: params.module,
    action: params.action,
    recordId: params.recordId,
    baseVersion: params.baseVersion || 1,
    payload: params.payload,
    createdAt: now,
    createdBy: params.session.user.fullName,
    userRole: params.session.user.role,
    status: 'Pending',
  };

  await enqueueOfflineOperation(op);

  // Attempt Background Sync registration where browser supports it (always paired with foreground fallback)
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync?.register('gmcsl-sync-queue');
    } catch {
      // Foreground sync handles fallback reliably
    }
  }

  return op;
}

export async function runBidirectionalSync(session: AuthSession): Promise<{
  pushed: number;
  synced: number;
  conflicts: number;
  failed: number;
  snapshot: SyncPullSnapshot;
}> {
  const queue = await getPendingQueue();
  const pending = queue.filter((q) => q.status === 'Pending' || q.status === 'Failed');

  let synced = 0;
  let conflicts = 0;
  let failed = 0;

  if (pending.length > 0) {
    for (const item of pending) {
      await putOneInStore('pending_sync_queue', { ...item, status: 'Syncing' });
    }

    const res = await apiFetch<{
      results: Array<{
        operationId: string;
        status: 'Synced' | 'Conflict' | 'Failed';
        message: string;
        conflictData?: any;
      }>;
    }>('/api/sync/push', { method: 'POST', body: JSON.stringify({ operations: pending }) }, session.token);

    for (const r of res.results) {
      const orig = pending.find((p) => p.operationId === r.operationId);
      if (!orig) continue;
      if (r.status === 'Synced') {
        synced += 1;
        await deleteFromStore('pending_sync_queue', r.operationId);
        // Also remove temporary offline record if server assigned canonical ID, pull will refresh canonical rows
        const storeName = mapModuleToStore(orig.module);
        if (storeName) {
          await deleteFromStore(storeName, orig.recordId).catch(() => undefined);
        }
      } else if (r.status === 'Conflict') {
        conflicts += 1;
        await putOneInStore('pending_sync_queue', {
          ...orig,
          status: 'Conflict',
          errorMessage: r.message,
          conflictData: r.conflictData,
        });
      } else {
        failed += 1;
        await putOneInStore('pending_sync_queue', {
          ...orig,
          status: 'Failed',
          errorMessage: r.message,
        });
      }
    }

    await putOneInStore('sync_history', {
      id: `SYN-${Date.now()}`,
      timestamp: new Date().toISOString(),
      summary: `Synced: ${synced}, Conflicts: ${conflicts}, Failed: ${failed}`,
      status: conflicts > 0 ? 'Conflict' : failed > 0 ? 'Partial' : 'Success',
      count: pending.length,
    });
  }

  const snapshot = await pullAuthorizedSnapshot(session.token);
  return {
    pushed: pending.length,
    synced,
    conflicts,
    failed,
    snapshot,
  };
}

function mapModuleToStore(module: string): OfflineStoreName | null {
  const m: Record<string, OfflineStoreName> = {
    members: 'members',
    savings: 'savings',
    shares: 'shares',
    loans: 'loans',
    loan_repayments: 'loan_repayments',
    cash_book: 'cash_book',
    attendance: 'attendance',
    meetings: 'meetings',
    loan_applications: 'loan_applications',
    online_payments: 'online_payments',
  };
  return m[module] || null;
}
