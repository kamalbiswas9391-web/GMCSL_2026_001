import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  clearHiddenTimestamp,
  clearSensitiveUserCacheOnLogout,
  clearSessionTokenOnly,
  getAllFromStore,
  getPendingQueue,
  loadHiddenTimestamp,
  loadSecureSession,
  putOneInStore,
  saveHiddenTimestamp,
  saveSecureSession,
} from '../offline/db';
import {
  apiFetch,
  loadOfflineSnapshot,
  pullAuthorizedSnapshot,
  runBidirectionalSync,
  type SyncPullSnapshot,
} from '../offline/syncEngine';
import {
  ensureFirebaseUserProfile,
  getActiveFirebaseConfig,
  saveAndReinitFirebase,
  signInWithFirebaseGoogle,
  signOutFirebase,
  subscribeFirebaseAppChange,
  subscribeFirebaseAuth,
  subscribeUserCloudRecords,
  testFirestoreConnection,
  upsertRecordsToFirestore,
  type CloudModule,
  type CloudSyncRecord,
} from '../firebase/client';
import { useOnlineStatus } from '../hooks/usePWA';
import { t, type TranslationKey } from '../i18n/translations';
import type {
  AppLanguage,
  AuthSession,
  ModuleKey,
  PendingSyncOperation,
  SocietySettings,
  ThemeMode,
} from '../types';

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes when tab is hidden / minimized

export type ModalKey =
  | 'confirm'
  | 'iosInstallGuide'
  | 'mobileMenu'
  | 'notificationsDropdown'
  | 'pinManagerModal'
  | 'officerForm'
  | 'memberForm'
  | 'savingForm'
  | 'shareForm'
  | 'loanForm'
  | 'loanRepayForm'
  | 'loanRepaymentEditForm'
  | 'cashBookForm'
  | 'meetingForm'
  | 'attendanceBulkForm'
  | 'loanApplicationForm'
  | 'loanReviewForm'
  | 'noticeForm'
  | 'conflictMergeModal'
  | 'firebaseSyncModal'
  | 'firebaseConfigModal'
  | 'kpiDrilldownModal'
  | 'loanAppsWidgetModal'
  | 'onlinePaymentsWidgetModal'
  | 'driveFilesModal'
  | 'credentialSchemaModal';

const INITIAL_MODALS: Record<ModalKey, boolean> = {
  confirm: false,
  iosInstallGuide: false,
  mobileMenu: false,
  notificationsDropdown: false,
  pinManagerModal: false,
  officerForm: false,
  memberForm: false,
  savingForm: false,
  shareForm: false,
  loanForm: false,
  loanRepayForm: false,
  loanRepaymentEditForm: false,
  cashBookForm: false,
  meetingForm: false,
  attendanceBulkForm: false,
  loanApplicationForm: false,
  loanReviewForm: false,
  noticeForm: false,
  conflictMergeModal: false,
  firebaseSyncModal: false,
  firebaseConfigModal: false,
  kpiDrilldownModal: false,
  loanAppsWidgetModal: false,
  onlinePaymentsWidgetModal: false,
  driveFilesModal: false,
  credentialSchemaModal: false,
};

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm?: () => Promise<void> | void;
}

interface AppContextValue {
  lang: AppLanguage;
  setLang: (l: AppLanguage) => void;
  tr: (key: TranslationKey) => string;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
  isOnline: boolean;
  isSyncing: boolean;
  session: AuthSession | null;
  snapshot: SyncPullSnapshot | null;
  publicData: { settings: SocietySettings | null; notices: any[]; media: any[]; systemInitialized: boolean };
  pendingQueue: PendingSyncOperation[];
  lastSyncedAt: string | null;
  toasts: ToastItem[];
  pushToast: (type: ToastItem['type'], message: string) => void;
  dismissToast: (id: string) => void;
  // Global Modal State Management
  modals: Record<ModalKey, boolean>;
  openModal: (key: ModalKey) => void;
  closeModal: (key: ModalKey) => void;
  setModalOpen: (key: ModalKey, isOpen: boolean) => void;
  closeAllModals: () => void;
  confirmState: (ConfirmOptions & { resolve: (val: boolean) => void }) | null;
  confirmBusy: boolean;
  askConfirm: (opts: ConfirmOptions) => Promise<boolean>;
  resolveConfirm: (confirmed: boolean) => Promise<void>;
  // Auth & Session
  completeLogin: (sessionData: AuthSession) => Promise<void>;
  logout: () => Promise<void>;
  expireSessionPreserveData: () => Promise<void>;
  syncNow: () => Promise<void>;
  refreshLocalView: () => Promise<void>;
  refreshPublicHome: () => Promise<void>;
  hasPermission: (mod: ModuleKey, action: 'view' | 'add' | 'edit' | 'delete') => boolean;
  canEditAutoIds: boolean;
  canDrilldownDashboard: boolean;
  bootLoading: boolean;
  // Firebase Cloud Sync (Spark Free Tier + Offline Persistence + Real-Time Sync)
  firebaseUser: FirebaseUser | null;
  firebaseReady: boolean;
  firebaseConnected: boolean;
  firebaseSyncing: boolean;
  cloudRecords: CloudSyncRecord[];
  lastFirebaseSyncAt: string | null;
  firebaseError: string | null;
  connectFirebaseGoogle: () => Promise<void>;
  disconnectFirebaseGoogle: () => Promise<void>;
  syncSnapshotToFirebase: (customSnapshot?: SyncPullSnapshot | null) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isOnline = useOnlineStatus();
  const [lang, setLangState] = useState<AppLanguage>('en');
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [snapshot, setSnapshot] = useState<SyncPullSnapshot | null>(null);
  const [pendingQueue, setPendingQueue] = useState<PendingSyncOperation[]>([]);
  const [publicData, setPublicData] = useState<{
    settings: SocietySettings | null;
    notices: any[];
    media: any[];
    systemInitialized: boolean;
  }>({ settings: null, notices: [], media: [], systemInitialized: true });
  const [isSyncing, setIsSyncing] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Global Boolean Modal Visibility States
  const [modals, setModals] = useState<Record<ModalKey, boolean>>(INITIAL_MODALS);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (val: boolean) => void }) | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  // Firebase State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [firebaseSyncing, setFirebaseSyncing] = useState(false);
  const [cloudRecords, setCloudRecords] = useState<CloudSyncRecord[]>([]);
  const [lastFirebaseSyncAt, setLastFirebaseSyncAt] = useState<string | null>(null);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  const syncingRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const hiddenSinceRef = useRef<number | null>(null);

  const pushToast = useCallback((type: ToastItem['type'], message: string) => {
    const id = `TST-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Global Modal Controls
  const openModal = useCallback((key: ModalKey) => {
    setModals((prev) => ({ ...prev, [key]: true }));
  }, []);

  const closeModal = useCallback((key: ModalKey) => {
    setModals((prev) => ({ ...prev, [key]: false }));
    if (key === 'confirm') {
      setConfirmState(null);
      setConfirmBusy(false);
    }
  }, []);

  const setModalOpen = useCallback((key: ModalKey, isOpen: boolean) => {
    setModals((prev) => ({ ...prev, [key]: isOpen }));
    if (key === 'confirm' && !isOpen) {
      setConfirmState(null);
      setConfirmBusy(false);
    }
  }, []);

  const closeAllModals = useCallback(() => {
    setModals(INITIAL_MODALS);
    setConfirmState(null);
    setConfirmBusy(false);
  }, []);

  const askConfirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ ...opts, resolve });
      setConfirmBusy(false);
      setModals((prev) => ({ ...prev, confirm: true }));
    });
  }, []);

  const resolveConfirm = useCallback(
    async (confirmed: boolean) => {
      const current = confirmState;
      if (!current) {
        setModals((prev) => ({ ...prev, confirm: false }));
        return;
      }

      if (!confirmed) {
        // Cancel clicked: immediately set modal boolean to false and close
        setModals((prev) => ({ ...prev, confirm: false }));
        setConfirmState(null);
        setConfirmBusy(false);
        current.resolve(false);
        return;
      }

      // Confirm / Logout / Revoke clicked: run callback if provided, then set boolean to false
      try {
        if (current.onConfirm) {
          setConfirmBusy(true);
          await current.onConfirm();
        }
      } finally {
        setModals((prev) => ({ ...prev, confirm: false }));
        setConfirmState(null);
        setConfirmBusy(false);
        current.resolve(true);
      }
    },
    [confirmState]
  );

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    putOneInStore('session_meta', { key: 'preferred_lang', value: next }).catch(() => undefined);
  }, []);

  const applyThemeToDom = useCallback((mode: ThemeMode, settings?: SocietySettings | null) => {
    const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'auto' && prefersDark);
    document.documentElement.classList.toggle('dark', isDark);

    if (settings) {
      const root = document.documentElement.style;
      if (settings.themePrimary) root.setProperty('--gmcsl-primary', settings.themePrimary);
      if (settings.themeSecondary) root.setProperty('--gmcsl-secondary', settings.themeSecondary);
      if (settings.themeAccent) root.setProperty('--gmcsl-accent', settings.themeAccent);
      if (settings.themeSidebar) root.setProperty('--gmcsl-sidebar', settings.themeSidebar);
      if (settings.themeHeader) root.setProperty('--gmcsl-header', settings.themeHeader);
    }
  }, []);

  const setThemeMode = useCallback(
    (next: ThemeMode) => {
      setThemeModeState(next);
      putOneInStore('session_meta', { key: 'preferred_theme', value: next }).catch(() => undefined);
      applyThemeToDom(next, snapshot?.settings || publicData.settings);
    },
    [applyThemeToDom, publicData.settings, snapshot?.settings]
  );

  const refreshPublicHome = useCallback(async () => {
    try {
      if (navigator.onLine) {
        const data = await apiFetch<{
          settings: SocietySettings;
          notices: any[];
          media: any[];
          systemInitialized: boolean;
        }>('/api/public/home');
        setPublicData(data);
        await putOneInStore('society_settings', [{ id: 'default', ...data.settings }]);
      } else {
        const cachedSettings = await getAllFromStore<any>('society_settings');
        const cachedNotices = await getAllFromStore<any>('notices');
        const cachedMedia = await getAllFromStore<any>('media_metadata');
        setPublicData({
          settings: cachedSettings[0] || null,
          notices: cachedNotices,
          media: cachedMedia,
          systemInitialized: true,
        });
      }
    } catch {
      const cachedSettings = await getAllFromStore<any>('society_settings');
      setPublicData((prev) => ({ ...prev, settings: cachedSettings[0] || prev.settings }));
    }
  }, []);

  const refreshLocalView = useCallback(async () => {
    const queue = await getPendingQueue();
    setPendingQueue(queue);
    if (session) {
      const offlineSnap = await loadOfflineSnapshot(session);
      setSnapshot(offlineSnap);
    }
  }, [session]);

  // Firebase Snapshot Synchronization (non-destructive merge, respects Spark free-tier batching)
  const syncSnapshotToFirebase = useCallback(
    async (customSnapshot?: SyncPullSnapshot | null) => {
      const targetSnap = customSnapshot || snapshot;
      if (!firebaseUser || !firebaseUser.emailVerified || !targetSnap) return;
      setFirebaseSyncing(true);
      setFirebaseError(null);
      try {
        await ensureFirebaseUserProfile({
          user: firebaseUser,
          role: session?.user.role || 'Member',
          displayName: session?.user.fullName || firebaseUser.displayName || 'GMCSL User',
          memberId: session?.user.memberId,
          mobileNumber: session?.user.mobileNumber,
        });

        const payloadItems: Array<{
          recordId: string;
          module: CloudModule;
          memberId?: string;
          summary?: string;
          status?: string;
          amount?: number;
          fields?: Record<string, any>;
          recordVersion?: number;
        }> = [];

        const pushList = (
          mod: CloudModule,
          arr: any[],
          idKey: string,
          summaryFn: (item: any) => string,
          amountFn?: (item: any) => number,
          statusFn?: (item: any) => string
        ) => {
          for (const item of (arr || []).slice(0, 60)) {
            const rid = String(item[idKey] || item.id || '');
            if (!rid) continue;
            payloadItems.push({
              recordId: rid,
              module: mod,
              memberId: item.memberId || '',
              summary: summaryFn(item),
              status: statusFn ? statusFn(item) : item.syncStatus || 'Synced',
              amount: amountFn ? amountFn(item) : 0,
              fields: item,
              recordVersion: Number(item.recordVersion || 1),
            });
          }
        };

        pushList('members', targetSnap.members, 'memberId', (m) => `${m.memberName} (${m.memberId})`, undefined, (m) => m.accountStatus);
        pushList('savings', targetSnap.savings, 'savingId', (s) => `Saving ${s.memberName} · ${s.date}`, (s) => Number(s.totalSaving || 0), (s) => s.paymentStatus);
        pushList('shares', targetSnap.shares, 'shareId', (sh) => `Shares ${sh.memberName} (${sh.numberOfShares})`, (sh) => Number(sh.totalShareValue || 0));
        pushList('loans', targetSnap.loans, 'loanId', (l) => `Loan ${l.loanNumber || l.loanId} · ${l.memberName}`, (l) => Number(l.currentLoanBalance || 0), (l) => l.loanStatus);
        pushList('loan_repayments', targetSnap.loanRepayments || [], 'repaymentId', (lr) => `Repay ${lr.loanNumber} · ${lr.memberName}`, (lr) => Number(lr.totalPaid || 0));
        pushList('loan_applications', targetSnap.loanApplications, 'applicationId', (la) => `Loan App ${la.memberName}`, (la) => Number(la.loanAmountRequired || 0), (la) => la.applicationStatus);
        pushList('online_payments', targetSnap.onlinePayments, 'paymentId', (op) => `UPI ${op.upiTransactionId || op.paymentId}`, (op) => Number(op.amount || 0), (op) => op.verificationStatus);
        pushList('cash_book', targetSnap.cashBook, 'transactionId', (cb) => `${cb.paymentMode}: ${cb.description}`, (cb) => Number(cb.totalAmount || 0));
        pushList('meetings', targetSnap.meetings, 'meetingId', (mt) => `${mt.meetingType} ${mt.meetingNumber} (${mt.meetingDate})`);
        pushList('attendance', targetSnap.attendance, 'attendanceId', (at) => `${at.meetingNumber} · ${at.memberName}`, undefined, (at) => at.attendanceStatus);
        pushList('notices', targetSnap.notices, 'noticeId', (n) => n.title);

        if (payloadItems.length > 0) {
          await upsertRecordsToFirestore({ uid: firebaseUser.uid, items: payloadItems });
        }
        setLastFirebaseSyncAt(new Date().toISOString());
      } catch (err: any) {
        const msg = err?.message || 'Firebase synchronization error.';
        setFirebaseError(msg);
      } finally {
        setFirebaseSyncing(false);
      }
    },
    [firebaseUser, session, snapshot]
  );

  const connectFirebaseGoogle = useCallback(async () => {
    try {
      setFirebaseError(null);
      const user = await signInWithFirebaseGoogle();
      setFirebaseUser(user);
      await ensureFirebaseUserProfile({
        user,
        role: session?.user.role || 'Member',
        displayName: session?.user.fullName || user.displayName || 'GMCSL User',
        memberId: session?.user.memberId,
        mobileNumber: session?.user.mobileNumber,
      });
      pushToast('success', `Connected Firebase Cloud Sync as ${user.email}`);
      if (snapshot) {
        await syncSnapshotToFirebase(snapshot);
      }
    } catch (err: any) {
      const msg = err?.message || 'Google Sign-In for Firebase failed.';
      setFirebaseError(msg);
      pushToast('error', msg);
    }
  }, [pushToast, session, snapshot, syncSnapshotToFirebase]);

  const disconnectFirebaseGoogle = useCallback(async () => {
    await signOutFirebase();
    setFirebaseUser(null);
    setCloudRecords([]);
    pushToast('info', 'Disconnected Firebase Google account. Local data remains safely preserved.');
  }, [pushToast]);

  const syncNow = useCallback(async () => {
    if (!session || !navigator.onLine || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const res = await runBidirectionalSync(session);
      setSnapshot(res.snapshot);
      const q = await getPendingQueue();
      setPendingQueue(q);
      applyThemeToDom(themeMode, res.snapshot.settings);
      if (firebaseUser && firebaseUser.emailVerified) {
        syncSnapshotToFirebase(res.snapshot).catch(() => undefined);
      }
      if (res.pushed > 0) {
        if (res.conflicts > 0 || res.failed > 0) {
          pushToast('warning', `Sync finished: ${res.synced} synced, ${res.conflicts} conflicts, ${res.failed} failed.`);
        } else {
          pushToast('success', `${res.synced} pending offline operation(s) synchronized.`);
        }
      }
    } catch (err: any) {
      pushToast('error', err?.message || 'Synchronization failed.');
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [applyThemeToDom, firebaseUser, pushToast, session, syncSnapshotToFirebase, themeMode]);

  // Session-only expiration after 30 minutes hidden/minimized — preserves ALL local data!
  const expireSessionPreserveData = useCallback(async () => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    hiddenSinceRef.current = null;
    closeAllModals();

    const activeToken = session?.token;
    await clearSessionTokenOnly();
    setSession(null);

    if (activeToken && navigator.onLine) {
      apiFetch('/api/auth/logout', { method: 'POST' }, activeToken).catch(() => undefined);
    }
    pushToast(
      'warning',
      lang === 'as'
        ? '৩০ মিনিট নিষ্ক্ৰিয় থকাৰ বাবে ছেছন সমাপ্ত হৈছে। আপোনাৰ সকলো স্থানীয় তথ্য সুৰক্ষিত আছে — অনুগ্ৰহ কৰি পুনৰ লগইন কৰক।'
        : 'Session ended after 30 minutes of inactivity. All local data is safely preserved — please log in again.'
    );
  }, [closeAllModals, lang, pushToast, session?.token]);

  // Firebase Connection Test, Auth Listener & Dynamic Reinit Watcher
  useEffect(() => {
    let unsubAuth: (() => void) | null = null;
    const attach = () => {
      if (unsubAuth) unsubAuth();
      testFirestoreConnection().then(setFirebaseConnected).catch(() => setFirebaseConnected(false));
      unsubAuth = subscribeFirebaseAuth((user) => {
        setFirebaseUser(user);
        setFirebaseReady(true);
      });
    };
    attach();
    const unsubReinit = subscribeFirebaseAppChange(() => {
      attach();
    });
    return () => {
      if (unsubAuth) unsubAuth();
      unsubReinit();
    };
  }, []);

  // Automatically sync dynamic Firebase config stored on server settings into client SDK if changed
  useEffect(() => {
    const serverCfg = snapshot?.settings?.firebaseConfig;
    if (!serverCfg || !serverCfg.apiKey || !serverCfg.authDomain || !serverCfg.projectId) return;
    const active = getActiveFirebaseConfig();
    if (
      active.apiKey !== serverCfg.apiKey ||
      active.projectId !== serverCfg.projectId ||
      active.authDomain !== serverCfg.authDomain
    ) {
      saveAndReinitFirebase(serverCfg).catch(() => undefined);
    }
  }, [snapshot?.settings?.firebaseConfig]);

  // Real-time Firestore onSnapshot listener (bounded, Spark-friendly)
  useEffect(() => {
    if (!firebaseReady || !firebaseUser || !firebaseUser.emailVerified) {
      setCloudRecords([]);
      return;
    }
    const unsub = subscribeUserCloudRecords(
      firebaseUser.uid,
      (records) => {
        setCloudRecords(records);
        setFirebaseError(null);
      },
      (err) => {
        setFirebaseError(err.message);
      }
    );
    return () => unsub();
  }, [firebaseReady, firebaseUser]);

  // Initial App Boot: restore language, theme, public homepage, and encrypted offline session
  useEffect(() => {
    (async () => {
      try {
        const meta = await getAllFromStore<any>('session_meta');
        const prefLang = meta.find((m) => m.key === 'preferred_lang')?.value as AppLanguage | undefined;
        const prefTheme = meta.find((m) => m.key === 'preferred_theme')?.value as ThemeMode | undefined;
        if (prefLang === 'en' || prefLang === 'as') setLangState(prefLang);
        if (prefTheme === 'light' || prefTheme === 'dark' || prefTheme === 'auto') {
          setThemeModeState(prefTheme);
          applyThemeToDom(prefTheme);
        }

        await refreshPublicHome();
        const savedSession = await loadSecureSession();
        const hiddenSince = await loadHiddenTimestamp();
        const queue = await getPendingQueue();
        setPendingQueue(queue);

        if (savedSession) {
          // Check if browser was left minimized/closed longer than 30 minutes
          if (hiddenSince && Date.now() - hiddenSince >= INACTIVITY_TIMEOUT_MS) {
            await clearSessionTokenOnly();
          } else {
            await clearHiddenTimestamp();
            setSession(savedSession);
            const localSnap = await loadOfflineSnapshot(savedSession);
            setSnapshot(localSnap);
            applyThemeToDom(prefTheme || 'light', localSnap.settings);
            if (navigator.onLine) {
              try {
                const res = await runBidirectionalSync(savedSession);
                setSnapshot(res.snapshot);
                setPendingQueue(await getPendingQueue());
              } catch {
                // Keep cached offline view if server session expired or unreachable
              }
            }
          }
        }
      } finally {
        setBootLoading(false);
      }
    })();
  }, [applyThemeToDom, refreshPublicHome]);

  // 30-Minute visibilitychange Inactivity Session Management + Auto-Sync
  useEffect(() => {
    if (!session) {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      hiddenSinceRef.current = null;
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        const now = Date.now();
        hiddenSinceRef.current = now;
        saveHiddenTimestamp(now).catch(() => undefined);
        if (inactivityTimerRef.current) {
          window.clearTimeout(inactivityTimerRef.current);
        }
        inactivityTimerRef.current = window.setTimeout(() => {
          expireSessionPreserveData();
        }, INACTIVITY_TIMEOUT_MS);
      } else if (document.visibilityState === 'visible') {
        if (inactivityTimerRef.current) {
          window.clearTimeout(inactivityTimerRef.current);
          inactivityTimerRef.current = null;
        }
        const hiddenAt = hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        clearHiddenTimestamp().catch(() => undefined);

        if (hiddenAt && Date.now() - hiddenAt >= INACTIVITY_TIMEOUT_MS) {
          expireSessionPreserveData();
          return;
        }
        if (navigator.onLine) {
          syncNow();
        }
      }
    };

    const onOnline = () => {
      syncNow();
    };

    const onFocus = () => {
      if (document.visibilityState === 'visible' && inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
        const hiddenAt = hiddenSinceRef.current;
        hiddenSinceRef.current = null;
        clearHiddenTimestamp().catch(() => undefined);
        if (hiddenAt && Date.now() - hiddenAt >= INACTIVITY_TIMEOUT_MS) {
          expireSessionPreserveData();
        }
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const timer = window.setInterval(() => {
      if (navigator.onLine && document.visibilityState === 'visible') {
        syncNow();
      }
    }, 45000);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(timer);
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [expireSessionPreserveData, session, syncNow]);

  const completeLogin = useCallback(
    async (sessionData: AuthSession) => {
      await clearHiddenTimestamp();
      await saveSecureSession(sessionData);
      setSession(sessionData);
      const snap = await pullAuthorizedSnapshot(sessionData.token);
      setSnapshot(snap);
      setPendingQueue(await getPendingQueue());
      applyThemeToDom(themeMode, snap.settings);
      const q = await getPendingQueue();
      if (q.length > 0 && navigator.onLine) {
        const res = await runBidirectionalSync(sessionData);
        setSnapshot(res.snapshot);
        setPendingQueue(await getPendingQueue());
      }
    },
    [applyThemeToDom, themeMode]
  );

  const logout = useCallback(async () => {
    if (inactivityTimerRef.current) {
      window.clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    hiddenSinceRef.current = null;
    if (session && navigator.onLine) {
      await apiFetch('/api/auth/logout', { method: 'POST' }, session.token).catch(() => undefined);
    }
    await clearSensitiveUserCacheOnLogout(true);
    closeAllModals();
    setSession(null);
    setSnapshot(null);
    pushToast('info', 'Logged out safely.');
  }, [closeAllModals, pushToast, session]);

  const hasPermission = useCallback(
    (mod: ModuleKey, action: 'view' | 'add' | 'edit' | 'delete'): boolean => {
      if (!session) return false;
      if (session.user.role === 'System') return true;
      const perm = snapshot?.permissions.find(
        (p) => p.role === session.user.role && p.moduleKey === mod
      );
      if (!perm || perm.isHidden) return false;
      if (action === 'view') return perm.canView;
      if (action === 'add') return perm.canAdd;
      if (action === 'edit') return perm.canEdit;
      if (action === 'delete') return perm.canDelete;
      return false;
    },
    [session, snapshot?.permissions]
  );

  const roleKey = session?.user.role;
  const canEditAutoIds = Boolean(
    roleKey === 'System' ||
      (roleKey && snapshot?.settings?.autoIdEditableRoles?.[roleKey as 'President' | 'Secretary' | 'Member'])
  );
  const canDrilldownDashboard = Boolean(
    roleKey === 'System' ||
      (roleKey ? snapshot?.settings?.dashboardDrilldownRoles?.[roleKey as 'President' | 'Secretary' | 'Member'] ?? true : false)
  );

  const tr = useCallback((key: TranslationKey) => t(lang, key), [lang]);

  return (
    <AppContext.Provider
      value={{
        lang,
        setLang,
        tr,
        themeMode,
        setThemeMode,
        isOnline,
        isSyncing,
        session,
        snapshot,
        publicData,
        pendingQueue,
        lastSyncedAt: snapshot?.syncedAt || null,
        toasts,
        pushToast,
        dismissToast,
        modals,
        openModal,
        closeModal,
        setModalOpen,
        closeAllModals,
        confirmState,
        confirmBusy,
        askConfirm,
        resolveConfirm,
        completeLogin,
        logout,
        expireSessionPreserveData,
        syncNow,
        refreshLocalView,
        refreshPublicHome,
        hasPermission,
        canEditAutoIds,
        canDrilldownDashboard,
        bootLoading,
        firebaseUser,
        firebaseReady,
        firebaseConnected,
        firebaseSyncing,
        cloudRecords,
        lastFirebaseSyncAt,
        firebaseError,
        connectFirebaseGoogle,
        disconnectFirebaseGoogle,
        syncSnapshotToFirebase,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
