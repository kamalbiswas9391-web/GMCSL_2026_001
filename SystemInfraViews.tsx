import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Database,
  Download,
  ExternalLink,
  HardDrive,
  History,
  KeyRound,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { deleteFromStore, getSyncHistory, putOneInStore } from '../offline/db';
import { apiFetch } from '../offline/syncEngine';
import {
  acquireGoogleDriveAccessToken,
  deleteCloudRecordExplicitly,
  getActiveFirebaseConfig,
  resetFirebaseToDefault,
  saveAndReinitFirebase,
} from '../firebase/client';
import { EmptyState, StatusLabel } from '../components/UiPrimitives';
import type {
  AuditLogRecord,
  BackupLogRecord,
  DynamicFirebaseConfig,
  GoogleDriveConfigStatus,
  GoogleSheetsStatus,
  PendingSyncOperation,
  SessionLogRecord,
} from '../types';

// ==========================================
// 1. GOOGLE SHEETS INTEGRATION SETTINGS
// ==========================================
export const GoogleSheetsIntegrationView: React.FC = () => {
  const { session, isOnline, pushToast } = useApp();
  const [status, setStatus] = useState<GoogleSheetsStatus | null>(null);
  const [appsScriptTemplate, setAppsScriptTemplate] = useState('');
  const [mode, setMode] = useState<'service_account' | 'apps_script' | 'not_configured'>('not_configured');
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [appsScriptSecret, setAppsScriptSecret] = useState('');
  const [serviceAccountEmail, setServiceAccountEmail] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = async () => {
    if (!session || !isOnline) return;
    const res = await apiFetch<{ status: GoogleSheetsStatus; appsScriptTemplate: string }>('/api/sheets/status', { method: 'GET' }, session.token);
    setStatus(res.status);
    setAppsScriptTemplate(res.appsScriptTemplate);
    setMode(res.status.mode);
    setSpreadsheetId(res.status.spreadsheetId);
    setAppsScriptUrl(res.status.appsScriptUrl);
  };

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, [session, isOnline]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ status: GoogleSheetsStatus }>(
        '/api/sheets/config',
        {
          method: 'POST',
          body: JSON.stringify({ mode, spreadsheetId, appsScriptUrl, appsScriptSecret, serviceAccountEmail, serviceAccountKey }),
        },
        session.token
      );
      setStatus(res.status);
      setServiceAccountKey('');
      pushToast('success', 'Google Sheets integration configuration saved server-side.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save config.');
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (endpoint: string, label: string) => {
    if (!session || !isOnline) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string; status: GoogleSheetsStatus }>(endpoint, { method: 'POST' }, session.token);
      setStatus(res.status);
      pushToast(res.ok ? 'success' : 'error', res.message || label);
    } catch (err: any) {
      pushToast('error', err?.message || `${label} failed.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">Google Sheets Integration Settings</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Configure Google Sheets as the official business-record database. All credentials remain strictly server-side.
          </p>
        </div>
        {status && <StatusLabel status={status.connected ? 'Active' : 'Pending'} />}
      </div>

      {!isOnline && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          Google Sheets synchronization requires active internet connectivity.
        </div>
      )}

      {/* Connection Status Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Connection Status</p>
          <p className="text-sm font-bold mt-1">{status?.connected ? 'Connected (Verified)' : 'Not Connected'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Integration Mode</p>
          <p className="text-sm font-bold mt-1 capitalize">{status?.mode.replace('_', ' ') || 'Not Configured'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Last Synced Time</p>
          <p className="text-xs font-mono-tabular font-semibold mt-1">{status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Mapped Sheets</p>
          <p className="text-sm font-mono-tabular font-bold mt-1">{status?.mappedSheets.length || 23} Sheets</p>
        </div>
      </div>

      {/* Configuration Form */}
      <form onSubmit={handleSaveConfig} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Integration Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as any)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <option value="not_configured">Not Configured</option>
              <option value="service_account">Google Sheets API v4 (Service Account)</option>
              <option value="apps_script">Google Apps Script Web App</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Spreadsheet ID</label>
            <input type="text" value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>

          {mode === 'service_account' && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Service Account Email</label>
                <input type="email" value={serviceAccountEmail} onChange={(e) => setServiceAccountEmail(e.target.value)} placeholder="gmcsl-sync@project.iam.gserviceaccount.com" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Service Account Private Key (stored server-side only)</label>
                <input type="password" value={serviceAccountKey} onChange={(e) => setServiceAccountKey(e.target.value)} placeholder="Paste private key (leave blank to keep existing)" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
              </div>
            </>
          )}

          {mode === 'apps_script' && (
            <>
              <div>
                <label className="block text-xs font-medium mb-1">Apps Script Web App URL</label>
                <input type="url" value={appsScriptUrl} onChange={(e) => setAppsScriptUrl(e.target.value)} placeholder="https://script.google.com/macros/s/.../exec" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Apps Script Shared Secret</label>
                <input type="password" value={appsScriptSecret} onChange={(e) => setAppsScriptSecret(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
              </div>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={busy || !isOnline} className="px-4 py-2 rounded-lg bg-[#142D4E] text-white text-xs sm:text-sm font-semibold disabled:opacity-50">
            Save Configuration
          </button>
          <button type="button" disabled={busy || !isOnline} onClick={() => runAction('/api/sheets/test', 'Test Connection')} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold">
            Test Connection
          </button>
          <button type="button" disabled={busy || !isOnline} onClick={() => runAction('/api/sheets/ensure-sheets', 'Create Sheets')} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold">
            Auto-Create All 23 Sheets
          </button>
          <button type="button" disabled={busy || !isOnline} onClick={() => runAction('/api/sheets/sync-now', 'Sync Sheets')} className="px-4 py-2 rounded-lg bg-[#087443] text-white text-xs sm:text-sm font-semibold disabled:opacity-50">
            Sync All Sheets Now
          </button>
        </div>
      </form>

      {/* Setup Instructions & Sheet Mapping */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#142D4E] dark:text-white">Setup Instructions</h3>
          <ol className="list-decimal list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1.5 leading-relaxed">
            <li>Create a Google Spreadsheet and copy its Spreadsheet ID from the URL.</li>
            <li>Either share the sheet (Editor) with your Google Service Account Email and set credentials above / in <code>.env</code>, OR open <strong>Extensions → Apps Script</strong> inside your sheet and deploy the bridge script below as a Web App.</li>
            <li>Click <strong>Test Connection</strong>, then <strong>Auto-Create All 23 Sheets</strong>, then <strong>Sync All Sheets Now</strong>.</li>
          </ol>
          {appsScriptTemplate && (
            <textarea
              readOnly
              rows={8}
              value={appsScriptTemplate}
              className="w-full p-3 text-[11px] font-mono-tabular rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="font-display text-sm font-bold text-[#142D4E] dark:text-white">Sheet Mapping & Error Logs</h3>
          <div className="flex flex-wrap gap-1.5">
            {(status?.mappedSheets || []).map((name) => (
              <span key={name} className="px-2 py-1 text-[11px] font-mono-tabular bg-slate-100 dark:bg-slate-800 rounded">
                {name}
              </span>
            ))}
          </div>
          {status?.errorLogs && status.errorLogs.length > 0 && (
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
              <p className="text-xs font-semibold text-red-600">Recent Connection Logs:</p>
              {status.errorLogs.slice(0, 5).map((l, i) => (
                <p key={i} className="text-[11px] text-slate-600 dark:text-slate-400 font-mono-tabular">
                  {new Date(l.timestamp).toLocaleString()} — {l.message}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 2. OFFLINE DATA, SYNC & CONFLICT RESOLUTION
// ==========================================
export const OfflineSyncAndConflictView: React.FC = () => {
  const {
    session,
    snapshot,
    isOnline,
    isSyncing,
    pendingQueue,
    lastSyncedAt,
    syncNow,
    refreshLocalView,
    pushToast,
    tr,
    modals,
    openModal,
    closeModal,
    askConfirm,
    firebaseUser,
    firebaseConnected,
    firebaseSyncing,
    cloudRecords,
    lastFirebaseSyncAt,
    firebaseError,
    connectFirebaseGoogle,
    disconnectFirebaseGoogle,
    syncSnapshotToFirebase,
  } = useApp();
  const [history, setHistory] = useState<any[]>([]);
  const [reviewOp, setReviewOp] = useState<PendingSyncOperation | null>(null);
  const [mergeFields, setMergeFields] = useState({ village: '', postOffice: '', gmailId: '' });

  useEffect(() => {
    getSyncHistory().then(setHistory).catch(() => undefined);
  }, [pendingQueue, lastSyncedAt]);

  const handleResolve = async (op: PendingSyncOperation, resolution: 'keep_server' | 'merge_non_financial' | 'submit_correction') => {
    if (!session || !isOnline) {
      pushToast('warning', 'Conflict resolution requires internet connectivity.');
      return;
    }
    try {
      await apiFetch(
        '/api/sync/resolve-conflict',
        {
          method: 'POST',
          body: JSON.stringify({
            operationId: op.operationId,
            resolution,
            module: op.module,
            recordId: op.recordId,
            mergedFields: resolution === 'merge_non_financial' ? mergeFields : undefined,
          }),
        },
        session.token
      );
      await deleteFromStore('pending_sync_queue', op.operationId);
      closeModal('conflictMergeModal');
      setReviewOp(null);
      pushToast('success', 'Conflict resolved safely.');
      await syncNow();
      await refreshLocalView();
    } catch (err: any) {
      pushToast('error', err?.message || 'Conflict resolution failed.');
    }
  };

  const retryFailed = async (op: PendingSyncOperation) => {
    await putOneInStore('pending_sync_queue', { ...op, status: 'Pending' });
    await refreshLocalView();
    if (isOnline) await syncNow();
  };

  const handleDeleteCloudDoc = async (recordId: string) => {
    if (!firebaseUser) return;
    await askConfirm({
      title: 'Delete Cloud Record Permanently',
      message: `Are you sure you want to explicitly delete cloud record "${recordId}" from Firebase? Records are never removed automatically.`,
      confirmLabel: 'Delete Record',
      danger: true,
      onConfirm: async () => {
        await deleteCloudRecordExplicitly(firebaseUser.uid, recordId);
        pushToast('info', `Deleted cloud record ${recordId}.`);
      },
    });
  };

  const conflicts = pendingQueue.filter((q) => q.status === 'Conflict');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">{tr('nav_offline_sync')}</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            {tr('lastSynchronized')}: <span className="font-mono-tabular">{lastSyncedAt ? new Date(lastSyncedAt).toLocaleString() : 'Never'}</span>
          </p>
        </div>
        <button
          onClick={syncNow}
          disabled={!isOnline || isSyncing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? tr('syncing') : tr('syncNow')}</span>
        </button>
      </div>

      {/* Firebase Cloud Sync & Offline Cache Card (Spark Free Tier) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
              {firebaseConnected ? (
                <Cloud className="w-5 h-5 text-[#087443]" />
              ) : (
                <CloudOff className="w-5 h-5 text-amber-600" />
              )}
              <span>Firebase Real-Time Cloud Sync & Offline Cache (Spark Free Tier)</span>
            </h3>
            <p className="text-xs text-[#667085] dark:text-slate-400">
              Persistent IndexedDB caching keeps records safe offline and syncs automatically in real time when online. No record is ever deleted unless explicitly deleted by you.
            </p>
          </div>
          <StatusLabel status={firebaseUser ? 'Connected' : firebaseConnected ? 'Ready' : 'Offline Mode'} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">Cloud Account</p>
            <p className="font-semibold text-[#142D4E] dark:text-white mt-0.5 truncate">
              {firebaseUser ? firebaseUser.email : 'Not connected (Local cache active)'}
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">Real-Time Cloud Records</p>
            <p className="font-mono-tabular font-bold text-[#087443] dark:text-emerald-400 mt-0.5">
              {cloudRecords.length} synced (Bounded Spark Stream)
            </p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
            <p className="text-slate-500 dark:text-slate-400">Last Firebase Sync</p>
            <p className="font-mono-tabular font-semibold mt-0.5">
              {lastFirebaseSyncAt ? new Date(lastFirebaseSyncAt).toLocaleString() : 'Waiting for sync'}
            </p>
          </div>
        </div>

        {firebaseError && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
            {firebaseError}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {!firebaseUser ? (
            <button
              type="button"
              onClick={connectFirebaseGoogle}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#142D4E] hover:bg-[#0f223b] text-white text-xs sm:text-sm font-semibold"
            >
              <Cloud className="w-4 h-4" />
              <span>Connect Google for Firebase Cloud Sync</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={firebaseSyncing || !snapshot}
                onClick={() => syncSnapshotToFirebase()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${firebaseSyncing ? 'animate-spin' : ''}`} />
                <span>{firebaseSyncing ? 'Syncing to Firebase...' : 'Sync Snapshot to Firebase'}</span>
              </button>
              <button
                type="button"
                onClick={() => openModal('firebaseSyncModal')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Database className="w-4 h-4 text-[#087443]" />
                <span>Inspect Cloud Records ({cloudRecords.length})</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  askConfirm({
                    title: 'Disconnect Firebase Google Sync',
                    message: 'Disconnecting Google sync stops cloud uploads without deleting any local or cloud records. Continue?',
                    confirmLabel: 'Disconnect',
                    danger: false,
                    onConfirm: async () => {
                      await disconnectFirebaseGoogle();
                    },
                  })
                }
                className="px-4 py-2 rounded-lg border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 text-xs sm:text-sm font-semibold hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Disconnect Cloud Sync
              </button>
            </>
          )}
        </div>
      </div>

      {/* Firebase Cloud Records Modal */}
      {modals.firebaseSyncModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 no-print">
          <div className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-[#142D4E] dark:text-white">
                  Firebase Cloud Records ({cloudRecords.length})
                </h3>
                <p className="text-xs text-slate-500">Live Firestore snapshot cache. Records persist until explicitly deleted.</p>
              </div>
              <button
                type="button"
                onClick={() => closeModal('firebaseSyncModal')}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close cloud records modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {cloudRecords.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500">
                  No cloud records synced yet. Click "Sync Snapshot to Firebase" to mirror your current data.
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/70 border-b">
                      <th className="py-2 px-3">Module</th>
                      <th className="py-2 px-3">Record ID</th>
                      <th className="py-2 px-3">Summary</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-right">Explicit Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cloudRecords.map((rec) => (
                      <tr key={rec.recordId}>
                        <td className="py-2 px-3 capitalize font-medium">{rec.module.replace(/_/g, ' ')}</td>
                        <td className="py-2 px-3 font-mono-tabular">{rec.recordId}</td>
                        <td className="py-2 px-3">{rec.summary || '—'}</td>
                        <td className="py-2 px-3 text-right font-mono-tabular">
                          {rec.amount ? `₹${Number(rec.amount).toFixed(2)}` : '—'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCloudDoc(rec.recordId)}
                            className="inline-flex items-center gap-1 text-red-600 hover:underline"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => closeModal('firebaseSyncModal')}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conflict Alert & Resolution Screen */}
      {conflicts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5" />
            <span>{conflicts.length} Synchronization Conflict(s) Require Authorized Resolution</span>
          </div>
          {conflicts.map((op) => (
            <div key={op.operationId} className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-mono-tabular font-bold">{op.module} · {op.recordId}</span>
                <span>Server modified by: <strong>{op.conflictData?.modifiedBy || 'Unknown'}</strong> ({op.conflictData?.lastModifiedTime})</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <p className="font-semibold mb-1">Server Version (v{op.conflictData?.serverVersion})</p>
                  <pre className="whitespace-pre-wrap font-mono-tabular text-[11px]">{JSON.stringify(op.conflictData?.serverRecord, null, 2)}</pre>
                </div>
                <div className="p-3 rounded bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <p className="font-semibold mb-1">Local Offline Version (Base v{op.baseVersion})</p>
                  <pre className="whitespace-pre-wrap font-mono-tabular text-[11px]">{JSON.stringify(op.conflictData?.localRecord, null, 2)}</pre>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleResolve(op, 'keep_server')} className="px-3 py-1.5 rounded bg-[#142D4E] text-white text-xs font-semibold">
                  Keep Server Version
                </button>
                {op.module === 'members' && (
                  <button
                    onClick={() => {
                      setReviewOp(op);
                      setMergeFields({
                        village: String((op.payload as any).village || ''),
                        postOffice: String((op.payload as any).postOffice || ''),
                        gmailId: String((op.payload as any).gmailId || ''),
                      });
                      openModal('conflictMergeModal');
                    }}
                    className="px-3 py-1.5 rounded bg-[#087443] text-white text-xs font-semibold"
                  >
                    Merge Non-Financial Fields
                  </button>
                )}
                <button onClick={() => handleResolve(op, 'submit_correction')} className="px-3 py-1.5 rounded border border-red-300 text-red-700 text-xs font-semibold">
                  Submit Correction Request
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modals.conflictMergeModal && reviewOp && (
        <div className="bg-white dark:bg-slate-900 border border-[#087443] rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-bold">Merge Permitted Non-Financial Member Fields ({reviewOp.recordId})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" placeholder="Village" value={mergeFields.village} onChange={(e) => setMergeFields({ ...mergeFields, village: e.target.value })} className="px-3 py-2 text-sm rounded border" />
            <input type="text" placeholder="Post Office" value={mergeFields.postOffice} onChange={(e) => setMergeFields({ ...mergeFields, postOffice: e.target.value })} className="px-3 py-2 text-sm rounded border" />
            <input type="email" placeholder="Gmail ID" value={mergeFields.gmailId} onChange={(e) => setMergeFields({ ...mergeFields, gmailId: e.target.value })} className="px-3 py-2 text-sm rounded border" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleResolve(reviewOp, 'merge_non_financial')} className="px-4 py-1.5 rounded bg-[#087443] text-white text-xs font-semibold">Apply Merge</button>
            <button
              type="button"
              onClick={() => {
                closeModal('conflictMergeModal');
                setReviewOp(null);
              }}
              className="px-4 py-1.5 rounded border text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Pending Queue Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold">Pending Offline Operation Queue ({pendingQueue.length})</h3>
        </div>
        {pendingQueue.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>All local IndexedDB records are synchronized with the server.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b text-xs">
                  <th className="py-2.5 px-4">Operation ID</th>
                  <th className="py-2.5 px-4">Module / Action</th>
                  <th className="py-2.5 px-4">Record ID</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pendingQueue.map((op) => (
                  <tr key={op.operationId}>
                    <td className="py-2.5 px-4 font-mono-tabular">{op.operationId}</td>
                    <td className="py-2.5 px-4 capitalize">{op.module} ({op.action})</td>
                    <td className="py-2.5 px-4 font-mono-tabular">{op.recordId}</td>
                    <td className="py-2.5 px-4"><StatusLabel status={op.status} /></td>
                    <td className="py-2.5 px-4 text-xs text-red-600">{op.errorMessage || 'Queued locally'}</td>
                    <td className="py-2.5 px-4 text-right">
                      {op.status === 'Failed' && (
                        <button onClick={() => retryFailed(op)} className="text-xs font-semibold text-[#087443] hover:underline">Retry</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sync History */}
      {history.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5">
          <h3 className="font-display text-sm font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Synchronization History</h3>
          <div className="space-y-2 text-xs">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <span>{h.summary}</span>
                <span className="font-mono-tabular text-slate-500">{new Date(h.timestamp).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 3. BACKUP & RESTORE, AUDIT LOG & SECURITY
// ==========================================
export const BackupAndRestoreView: React.FC = () => {
  const { session, isOnline, pushToast, askConfirm, syncNow } = useApp();
  const [backups, setBackups] = useState<BackupLogRecord[]>([]);

  const loadBackups = async () => {
    if (!session || !isOnline) return;
    const rows = await apiFetch<BackupLogRecord[]>('/api/backups', { method: 'GET' }, session.token);
    setBackups(rows);
  };

  useEffect(() => {
    loadBackups().catch(() => undefined);
  }, [session, isOnline]);

  const handleCreateBackup = async () => {
    if (!session || !isOnline) {
      pushToast('warning', 'Official server backup requires internet connectivity.');
      return;
    }
    const res = await apiFetch<{ backupId: string; timestamp: string; recordCount: number; snapshot: any }>(
      '/api/backups/create',
      { method: 'POST', body: JSON.stringify({ notes: 'Manual System Snapshot' }) },
      session.token
    );
    const blob = new Blob([JSON.stringify(res, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `GMCSL_Backup_${res.backupId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', `Backup ${res.backupId} created (${res.recordCount} records).`);
    await loadBackups();
  };

  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !session || !isOnline) return;
    await askConfirm({
      title: 'Confirm Data Restoration',
      message: 'Restoring from a backup file will overwrite matching settings, permissions, notices, and meetings. Continue?',
      confirmLabel: 'Restore Now',
      danger: true,
      onConfirm: async () => {
        try {
          const text = await file.text();
          const parsed = JSON.parse(text);
          const snapshotData = parsed.snapshot || parsed;
          const res = await apiFetch<{ ok: boolean; restoredCount: number }>(
            '/api/backups/restore',
            { method: 'POST', body: JSON.stringify({ snapshot: snapshotData }) },
            session.token
          );
          pushToast('success', `Restored ${res.restoredCount} records cleanly.`);
          await loadBackups();
          await syncNow();
        } catch (err: any) {
          pushToast('error', err?.message || 'Backup restoration failed.');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-[#087443]" />
            <span>Backup & Restore</span>
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">Create full encrypted/JSON database snapshots and restore authorized records.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleCreateBackup} disabled={!isOnline} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold disabled:opacity-50">
            <Download className="w-4 h-4" />
            <span>Create & Download Backup</span>
          </button>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
            <Upload className="w-4 h-4" />
            <span>Restore Snapshot</span>
            <input type="file" accept=".json" onChange={handleRestoreFile} className="hidden" />
          </label>
        </div>
      </div>

      {backups.length === 0 ? (
        <EmptyState title="No Backups Recorded" subtitle="Create your first database snapshot to record backup history." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b text-xs font-semibold">
                <th className="py-3 px-4">Backup ID</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Created By</th>
                <th className="py-3 px-4 text-right">Records</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {backups.map((b) => (
                <tr key={b.backupId}>
                  <td className="py-3 px-4 font-mono-tabular">{b.backupId}</td>
                  <td className="py-3 px-4">{b.backupType}</td>
                  <td className="py-3 px-4">{b.createdBy}</td>
                  <td className="py-3 px-4 text-right font-mono-tabular">{b.recordCount}</td>
                  <td className="py-3 px-4"><StatusLabel status={b.status} /></td>
                  <td className="py-3 px-4 text-xs font-mono-tabular">{new Date(b.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AuditLogView: React.FC = () => {
  const { session, isOnline } = useApp();
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);

  useEffect(() => {
    if (session && isOnline) {
      apiFetch<AuditLogRecord[]>('/api/audit-logs', { method: 'GET' }, session.token)
        .then(setLogs)
        .catch(() => undefined);
    }
  }, [session, isOnline]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white">Immutable Audit Log</h2>
        <p className="text-xs text-[#667085] dark:text-slate-400">Tracks logins, financial postings, reversals, permission updates, syncs, and conflict resolutions.</p>
      </div>
      {logs.length === 0 ? (
        <EmptyState title="No Audit Entries Loaded" subtitle="Audit history loads live when online." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b text-xs font-semibold">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor (Role)</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Record ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {logs.map((l) => (
                <tr key={l.auditId}>
                  <td className="py-2.5 px-4 font-mono-tabular text-xs">{new Date(l.timestamp).toLocaleString()}</td>
                  <td className="py-2.5 px-4">{l.userName} ({l.userRole})</td>
                  <td className="py-2.5 px-4 font-mono-tabular font-semibold">{l.action}</td>
                  <td className="py-2.5 px-4">{l.module}</td>
                  <td className="py-2.5 px-4 font-mono-tabular">{l.recordId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const AdminFirebaseSetupView: React.FC = () => {
  const { session, snapshot, isOnline, pushToast, syncNow, firebaseUser, cloudRecords } = useApp();
  const isSystem = session?.user.role === 'System';

  const [fbConfig, setFbConfig] = useState<DynamicFirebaseConfig>(() => {
    const active = snapshot?.settings?.firebaseConfig || getActiveFirebaseConfig();
    return {
      apiKey: active?.apiKey || '',
      authDomain: active?.authDomain || '',
      databaseURL: active?.databaseURL || '',
      projectId: active?.projectId || '',
      storageBucket: active?.storageBucket || '',
      messagingSenderId: active?.messagingSenderId || '',
      appId: active?.appId || '',
      measurementId: active?.measurementId || '',
      firestoreDatabaseId: active?.firestoreDatabaseId || '',
    };
  });
  const [fbBusy, setFbBusy] = useState(false);

  useEffect(() => {
    if (!isSystem || !session || !isOnline) return;
    apiFetch<{ firebaseConfig: DynamicFirebaseConfig | null }>('/api/system/firebase-config', { method: 'GET' }, session.token)
      .then((res) => {
        if (res.firebaseConfig) {
          setFbConfig({
            apiKey: res.firebaseConfig.apiKey || '',
            authDomain: res.firebaseConfig.authDomain || '',
            databaseURL: res.firebaseConfig.databaseURL || '',
            projectId: res.firebaseConfig.projectId || '',
            storageBucket: res.firebaseConfig.storageBucket || '',
            messagingSenderId: res.firebaseConfig.messagingSenderId || '',
            appId: res.firebaseConfig.appId || '',
            measurementId: res.firebaseConfig.measurementId || '',
            firestoreDatabaseId: res.firebaseConfig.firestoreDatabaseId || '',
          });
        }
      })
      .catch(() => undefined);
  }, [session, isOnline, isSystem]);

  if (!isSystem) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-xl p-6 text-sm text-red-700 dark:text-red-300">
        Access Denied: Admin Firebase Setup is restricted exclusively to logged-in System Administrators.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
            <Cloud className="w-5 h-5 text-[#087443]" />
            <span>Admin Firebase Setup (Dynamic Project Configuration)</span>
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Configure Firebase SDK credentials dynamically for real-time Spark Free Tier Firestore sync and offline caching.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`px-3 py-1.5 rounded-lg border font-semibold ${
              firebaseUser
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {firebaseUser ? `Connected (${cloudRecords.length} cached)` : `Project: ${fbConfig.projectId || 'Default'}`}
          </span>
        </div>
      </div>

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!fbConfig.apiKey.trim() || !fbConfig.authDomain.trim() || !fbConfig.projectId.trim()) {
            pushToast('error', 'apiKey, authDomain, and projectId are required.');
            return;
          }
          setFbBusy(true);
          try {
            if (session && isOnline) {
              await apiFetch('/api/system/firebase-config', { method: 'PUT', body: JSON.stringify({ firebaseConfig: fbConfig }) }, session.token);
            }
            await saveAndReinitFirebase(fbConfig);
            pushToast('success', 'Dynamic Firebase configuration saved & SDK re-initialized.');
            if (session && isOnline) await syncNow();
          } catch (err: any) {
            pushToast('error', err?.message || 'Failed to save Firebase config.');
          } finally {
            setFbBusy(false);
          }
        }}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-[#142D4E] dark:text-white">Firebase Web SDK Parameters</h3>
            <p className="text-xs text-slate-500">
              Saved securely in localStorage and server settings so the app dynamically initializes on every launch.
            </p>
          </div>
          <button
            type="button"
            disabled={fbBusy}
            onClick={async () => {
              setFbBusy(true);
              try {
                if (session && isOnline) {
                  await apiFetch('/api/system/firebase-config', { method: 'DELETE' }, session.token);
                }
                await resetFirebaseToDefault();
                const def = getActiveFirebaseConfig();
                setFbConfig({
                  apiKey: def?.apiKey || '',
                  authDomain: def?.authDomain || '',
                  databaseURL: def?.databaseURL || '',
                  projectId: def?.projectId || '',
                  storageBucket: def?.storageBucket || '',
                  messagingSenderId: def?.messagingSenderId || '',
                  appId: def?.appId || '',
                  measurementId: def?.measurementId || '',
                  firestoreDatabaseId: def?.firestoreDatabaseId || '',
                });
                pushToast('info', 'Reset Firebase configuration to default project.');
              } catch (err: any) {
                pushToast('error', err?.message || 'Failed to reset Firebase config.');
              } finally {
                setFbBusy(false);
              }
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Reset to Default
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">apiKey <span className="text-red-600">*</span></label>
            <input type="text" required value={fbConfig.apiKey} onChange={(e) => setFbConfig({ ...fbConfig, apiKey: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">authDomain <span className="text-red-600">*</span></label>
            <input type="text" required value={fbConfig.authDomain} onChange={(e) => setFbConfig({ ...fbConfig, authDomain: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">projectId <span className="text-red-600">*</span></label>
            <input type="text" required value={fbConfig.projectId} onChange={(e) => setFbConfig({ ...fbConfig, projectId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">databaseURL</label>
            <input type="text" value={fbConfig.databaseURL || ''} onChange={(e) => setFbConfig({ ...fbConfig, databaseURL: e.target.value })} placeholder="https://project.firebaseio.com" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">storageBucket</label>
            <input type="text" value={fbConfig.storageBucket || ''} onChange={(e) => setFbConfig({ ...fbConfig, storageBucket: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">messagingSenderId</label>
            <input type="text" value={fbConfig.messagingSenderId || ''} onChange={(e) => setFbConfig({ ...fbConfig, messagingSenderId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">appId</label>
            <input type="text" value={fbConfig.appId || ''} onChange={(e) => setFbConfig({ ...fbConfig, appId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">measurementId</label>
            <input type="text" value={fbConfig.measurementId || ''} onChange={(e) => setFbConfig({ ...fbConfig, measurementId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">firestoreDatabaseId</label>
            <input type="text" value={fbConfig.firestoreDatabaseId || ''} onChange={(e) => setFbConfig({ ...fbConfig, firestoreDatabaseId: e.target.value })} placeholder="(default)" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button type="submit" disabled={fbBusy} className="px-5 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-xs sm:text-sm font-semibold disabled:opacity-50">
            {fbBusy ? 'Re-initializing...' : 'Save & Dynamically Initialize Firebase'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const SecurityAndCredentialsView: React.FC = () => {
  const { session, snapshot, isOnline, pushToast, askConfirm, logout, syncNow } = useApp();
  const isSystem = session?.user.role === 'System';
  const [sessionsList, setSessionsList] = useState<SessionLogRecord[]>([]);
  const [currentSecret, setCurrentSecret] = useState('');
  const [newSecret, setNewSecret] = useState('');
  const [newMobile, setNewMobile] = useState(session?.user.mobileNumber || '');
  const [newEmail, setNewEmail] = useState(session?.user.email || '');

  const [fbConfig, setFbConfig] = useState<DynamicFirebaseConfig>(() => {
    const active = snapshot?.settings?.firebaseConfig || getActiveFirebaseConfig();
    return {
      apiKey: active?.apiKey || '',
      authDomain: active?.authDomain || '',
      databaseURL: active?.databaseURL || '',
      projectId: active?.projectId || '',
      storageBucket: active?.storageBucket || '',
      messagingSenderId: active?.messagingSenderId || '',
      appId: active?.appId || '',
      measurementId: active?.measurementId || '',
      firestoreDatabaseId: active?.firestoreDatabaseId || '',
    };
  });
  const [fbBusy, setFbBusy] = useState(false);

  const loadSessions = async () => {
    if (!session || !isOnline || !isSystem) return;
    const rows = await apiFetch<SessionLogRecord[]>('/api/security/sessions', { method: 'GET' }, session.token);
    setSessionsList(rows);
  };

  useEffect(() => {
    loadSessions().catch(() => undefined);
    if (isSystem && session && isOnline) {
      apiFetch<{ firebaseConfig: DynamicFirebaseConfig | null }>('/api/system/firebase-config', { method: 'GET' }, session.token)
        .then((res) => {
          if (res.firebaseConfig) {
            setFbConfig({
              apiKey: res.firebaseConfig.apiKey || '',
              authDomain: res.firebaseConfig.authDomain || '',
              databaseURL: res.firebaseConfig.databaseURL || '',
              projectId: res.firebaseConfig.projectId || '',
              storageBucket: res.firebaseConfig.storageBucket || '',
              messagingSenderId: res.firebaseConfig.messagingSenderId || '',
              appId: res.firebaseConfig.appId || '',
              measurementId: res.firebaseConfig.measurementId || '',
              firestoreDatabaseId: res.firebaseConfig.firestoreDatabaseId || '',
            });
          }
        })
        .catch(() => undefined);
    }
  }, [session, isOnline, isSystem]);

  const handleChangeCreds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline) {
      pushToast('warning', 'Credential changes require online verification.');
      return;
    }
    try {
      await apiFetch(
        '/api/auth/change-credentials',
        { method: 'POST', body: JSON.stringify({ currentSecret, newSecret, newMobile, newEmail }) },
        session.token
      );
      pushToast('success', 'Credentials updated securely.');
      setCurrentSecret('');
      setNewSecret('');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to update credentials.');
    }
  };

  const handleLogoutAll = async () => {
    if (!session || !isOnline) return;
    await askConfirm({
      title: 'Logout From All Sessions',
      message: 'This will immediately revoke all active sessions across all devices (including this one). Continue?',
      confirmLabel: 'Revoke All Sessions',
      danger: true,
      onConfirm: async () => {
        await apiFetch('/api/security/logout-all', { method: 'POST', body: JSON.stringify({ keepCurrent: false }) }, session.token);
        await logout();
      },
    });
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
        <KeyRound className="w-5 h-5 text-[#087443]" />
        <span>{isSystem ? 'System Security & Session Control' : 'My Account Security & PIN'}</span>
      </h2>

      <form onSubmit={handleChangeCreds} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 max-w-xl space-y-4">
        <h3 className="text-sm font-bold">{isSystem ? 'Change System Password / Mobile / Email' : 'Change 4-Digit Login PIN'}</h3>
        {isSystem && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">System Email</label>
              <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">System Mobile</label>
              <input type="tel" value={newMobile} onChange={(e) => setNewMobile(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">{isSystem ? 'Current Password *' : 'Current 4-Digit PIN *'}</label>
            <input type="password" required value={currentSecret} onChange={(e) => setCurrentSecret(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">{isSystem ? 'New Password' : 'New 4-Digit PIN *'}</label>
            <input type="password" required={!isSystem} maxLength={isSystem ? 64 : 4} value={newSecret} onChange={(e) => setNewSecret(e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
          </div>
        </div>
        <button type="submit" disabled={!isOnline} className="px-5 py-2 rounded-lg bg-[#087443] text-white text-sm font-semibold disabled:opacity-50">
          Update Credentials
        </button>
      </form>

      {isSystem && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!fbConfig.apiKey.trim() || !fbConfig.authDomain.trim() || !fbConfig.projectId.trim()) {
              pushToast('error', 'apiKey, authDomain, and projectId are required.');
              return;
            }
            setFbBusy(true);
            try {
              if (session && isOnline) {
                await apiFetch('/api/system/firebase-config', { method: 'PUT', body: JSON.stringify({ firebaseConfig: fbConfig }) }, session.token);
              }
              await saveAndReinitFirebase(fbConfig);
              pushToast('success', 'Dynamic Firebase configuration saved & SDK re-initialized.');
              if (session && isOnline) await syncNow();
            } catch (err: any) {
              pushToast('error', err?.message || 'Failed to save Firebase config.');
            } finally {
              setFbBusy(false);
            }
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[#087443]" />
                <span>Admin Dynamic Firebase SDK Configuration</span>
              </h3>
              <p className="text-xs text-slate-500">
                Persists in secure localStorage &amp; server settings so the app dynamically initializes with your project on every boot (Spark Free Tier compatible).
              </p>
            </div>
            <button
              type="button"
              disabled={fbBusy}
              onClick={async () => {
                setFbBusy(true);
                try {
                  if (session && isOnline) {
                    await apiFetch('/api/system/firebase-config', { method: 'DELETE' }, session.token);
                  }
                  await resetFirebaseToDefault();
                  const def = getActiveFirebaseConfig();
                  setFbConfig({
                    apiKey: def?.apiKey || '',
                    authDomain: def?.authDomain || '',
                    databaseURL: def?.databaseURL || '',
                    projectId: def?.projectId || '',
                    storageBucket: def?.storageBucket || '',
                    messagingSenderId: def?.messagingSenderId || '',
                    appId: def?.appId || '',
                    measurementId: def?.measurementId || '',
                    firestoreDatabaseId: def?.firestoreDatabaseId || '',
                  });
                  pushToast('info', 'Reset Firebase configuration to default project.');
                } catch (err: any) {
                  pushToast('error', err?.message || 'Failed to reset Firebase config.');
                } finally {
                  setFbBusy(false);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold"
            >
              Reset to Default
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">apiKey <span className="text-red-600">*</span></label>
              <input type="text" required value={fbConfig.apiKey} onChange={(e) => setFbConfig({ ...fbConfig, apiKey: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">authDomain <span className="text-red-600">*</span></label>
              <input type="text" required value={fbConfig.authDomain} onChange={(e) => setFbConfig({ ...fbConfig, authDomain: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">projectId <span className="text-red-600">*</span></label>
              <input type="text" required value={fbConfig.projectId} onChange={(e) => setFbConfig({ ...fbConfig, projectId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">databaseURL</label>
              <input type="text" value={fbConfig.databaseURL || ''} onChange={(e) => setFbConfig({ ...fbConfig, databaseURL: e.target.value })} placeholder="https://project.firebaseio.com" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">storageBucket</label>
              <input type="text" value={fbConfig.storageBucket || ''} onChange={(e) => setFbConfig({ ...fbConfig, storageBucket: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">messagingSenderId</label>
              <input type="text" value={fbConfig.messagingSenderId || ''} onChange={(e) => setFbConfig({ ...fbConfig, messagingSenderId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">appId</label>
              <input type="text" value={fbConfig.appId || ''} onChange={(e) => setFbConfig({ ...fbConfig, appId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">measurementId</label>
              <input type="text" value={fbConfig.measurementId || ''} onChange={(e) => setFbConfig({ ...fbConfig, measurementId: e.target.value })} className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">firestoreDatabaseId</label>
              <input type="text" value={fbConfig.firestoreDatabaseId || ''} onChange={(e) => setFbConfig({ ...fbConfig, firestoreDatabaseId: e.target.value })} placeholder="(default)" className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular" />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={fbBusy} className="px-5 py-2 rounded-lg bg-[#087443] hover:bg-[#065c35] text-white text-xs sm:text-sm font-semibold disabled:opacity-50">
              {fbBusy ? 'Re-initializing...' : 'Save & Dynamically Initialize Firebase'}
            </button>
          </div>
        </form>
      )}

      {isSystem && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-red-600" /> Active & Recent Sessions</h3>
            <button onClick={handleLogoutAll} disabled={!isOnline} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold">
              Logout All Sessions
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b">
                  <th className="py-2.5 px-3">Session ID</th>
                  <th className="py-2.5 px-3">User (Role)</th>
                  <th className="py-2.5 px-3">Login Time</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sessionsList.map((s) => (
                  <tr key={s.sessionId}>
                    <td className="py-2.5 px-3 font-mono-tabular">{s.sessionId}</td>
                    <td className="py-2.5 px-3">{s.userName} ({s.userRole})</td>
                    <td className="py-2.5 px-3 font-mono-tabular">{new Date(s.loginTime).toLocaleString()}</td>
                    <td className="py-2.5 px-3"><StatusLabel status={s.isActive ? 'Active' : 'Inactive'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 4. GOOGLE DRIVE INTEGRATION IN ADMIN PANEL
// ==========================================
export const GoogleDriveIntegrationView: React.FC = () => {
  const { session, isOnline, pushToast, askConfirm } = useApp();
  const [status, setStatus] = useState<GoogleDriveConfigStatus | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folderName, setFolderName] = useState('GMCSL Backups');
  const [syncFrequency, setSyncFrequency] = useState<'Manual' | '15m' | 'Hourly' | 'Daily'>('Manual');
  const [autoBackup, setAutoBackup] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadDriveStatus = async () => {
    if (!session || !isOnline) return;
    const res = await apiFetch<GoogleDriveConfigStatus>('/api/drive/status', { method: 'GET' }, session.token);
    setStatus(res);
    setFolderId(res.folderId || '');
    setFolderName(res.folderName || 'GMCSL Backups');
    setSyncFrequency(res.syncFrequency || 'Manual');
    setAutoBackup(Boolean(res.autoBackup));
  };

  useEffect(() => {
    loadDriveStatus().catch(() => undefined);
  }, [session, isOnline]);

  useEffect(() => {
    if (!autoBackup || syncFrequency === 'Manual' || !session || !isOnline) return;
    const ms = syncFrequency === '15m' ? 15 * 60 * 1000 : syncFrequency === 'Hourly' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const id = window.setInterval(() => {
      apiFetch<{ status: GoogleDriveConfigStatus }>('/api/drive/sync-now', { method: 'POST' }, session.token)
        .then((r) => setStatus(r.status))
        .catch(() => undefined);
    }, ms);
    return () => window.clearInterval(id);
  }, [autoBackup, syncFrequency, session, isOnline]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !isOnline) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; status: GoogleDriveConfigStatus }>(
        '/api/drive/config',
        {
          method: 'POST',
          body: JSON.stringify({
            clientId: clientId.trim() || undefined,
            clientSecret: clientSecret.trim() || undefined,
            authToken: authToken.trim() || undefined,
            folderId: folderId.trim(),
            folderName: folderName.trim() || 'GMCSL Backups',
            syncFrequency,
            autoBackup,
          }),
        },
        session.token
      );
      setStatus(res.status);
      setClientSecret('');
      setAuthToken('');
      pushToast('success', 'Google Drive configuration saved.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to save Google Drive config.');
    } finally {
      setBusy(false);
    }
  };

  const handleAcquireOAuth = async () => {
    if (!session || !isOnline) return;
    setBusy(true);
    try {
      const oauth = await acquireGoogleDriveAccessToken();
      setAuthToken(oauth.accessToken);
      const res = await apiFetch<{ ok: boolean; status: GoogleDriveConfigStatus }>(
        '/api/drive/config',
        {
          method: 'POST',
          body: JSON.stringify({
            authToken: oauth.accessToken,
            folderId: folderId.trim(),
            folderName: folderName.trim() || 'GMCSL Backups',
            syncFrequency,
            autoBackup,
          }),
        },
        session.token
      );
      setStatus(res.status);
      pushToast('success', 'Google Drive OAuth token authorized and stored.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Google Drive OAuth authorization failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSyncNow = async () => {
    if (!session || !isOnline) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; message: string; status: GoogleDriveConfigStatus }>(
        '/api/drive/sync-now',
        { method: 'POST' },
        session.token
      );
      setStatus(res.status);
      pushToast(res.ok ? 'success' : 'warning', res.message || 'Backup synced.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Drive backup sync failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshFiles = async () => {
    if (!session || !isOnline) return;
    setBusy(true);
    try {
      const res = await apiFetch<{ ok: boolean; message?: string; status: GoogleDriveConfigStatus }>(
        '/api/drive/refresh-files',
        { method: 'POST' },
        session.token
      );
      setStatus(res.status);
      pushToast('info', res.message || 'Drive file list refreshed.');
    } catch (err: any) {
      pushToast('error', err?.message || 'Failed to refresh Drive files.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFile = async (driveFileId: string, fileName: string) => {
    if (!session || !isOnline) return;
    await askConfirm({
      title: 'Delete Google Drive File',
      message: `Explicitly delete backup "${fileName}" (${driveFileId})? Records are never deleted automatically.`,
      confirmLabel: 'Delete File',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await apiFetch<{ ok: boolean; status: GoogleDriveConfigStatus }>(
            `/api/drive/files/${encodeURIComponent(driveFileId)}`,
            { method: 'DELETE' },
            session.token
          );
          setStatus(res.status);
          pushToast('info', `Deleted ${fileName}.`);
        } catch (err: any) {
          pushToast('error', err?.message || 'Failed to delete file.');
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#142D4E] dark:text-white flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-[#087443]" />
            <span>Google Drive Integration &amp; Cloud Backups</span>
          </h2>
          <p className="text-xs text-[#667085] dark:text-slate-400">
            Configure Google Drive OAuth credentials, target backup folder, sync cadence, and manage stored backup files.
          </p>
        </div>
        {status && <StatusLabel status={status.connected ? 'Active' : status.configured ? 'Ready' : 'Pending'} />}
      </div>

      {/* Live Status KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Drive Status</p>
          <p className="text-sm font-bold mt-1">{status?.connected ? 'Connected (OAuth Active)' : status?.configured ? 'Credentials Saved' : 'Not Connected'}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Target Folder</p>
          <p className="text-sm font-bold mt-1 truncate">{status?.folderName || folderName}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Sync Frequency</p>
          <p className="text-sm font-bold mt-1">{status?.syncFrequency || syncFrequency} {status?.autoBackup ? '(Auto)' : ''}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs text-slate-500">Stored Files / Last Sync</p>
          <p className="text-xs font-mono-tabular font-semibold mt-1">
            {status?.files.length || 0} file(s) · {status?.lastSyncedAt ? new Date(status.lastSyncedAt).toLocaleString() : 'Never'}
          </p>
        </div>
      </div>

      {status?.lastError && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          Note: {status.lastError}
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSaveConfig} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">
              Google OAuth Client ID {status?.hasClientId ? `(${status.clientIdMasked})` : ''}
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Leave blank to keep saved Client ID"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Client Secret {status?.hasClientSecret ? '(Saved)' : ''}
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Leave blank to keep saved Secret"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">
              Auth / Access Token {status?.hasAuthToken ? '(Active)' : ''}
            </label>
            <input
              type="password"
              value={authToken}
              onChange={(e) => setAuthToken(e.target.value)}
              placeholder="Paste token or click Connect OAuth"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Drive Folder ID (Optional)</label>
            <input
              type="text"
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              placeholder="e.g. 1AbC...xyz"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono-tabular"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Folder Name</label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Sync Frequency</label>
            <select
              value={syncFrequency}
              onChange={(e) => setSyncFrequency(e.target.value as any)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            >
              <option value="Manual">Manual</option>
              <option value="15m">Every 15 Minutes</option>
              <option value="Hourly">Hourly</option>
              <option value="Daily">Daily</option>
            </select>
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={autoBackup}
            onChange={(e) => setAutoBackup(e.target.checked)}
            className="w-4 h-4 accent-[#087443]"
          />
          <span>Enable Automatic Scheduled Drive Backups</span>
        </label>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" disabled={busy || !isOnline} className="px-4 py-2 rounded-lg bg-[#142D4E] text-white text-xs sm:text-sm font-semibold disabled:opacity-50">
            Save Drive Config
          </button>
          <button type="button" disabled={busy || !isOnline} onClick={handleAcquireOAuth} className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold">
            Connect Google Drive OAuth
          </button>
          <button type="button" disabled={busy || !isOnline} onClick={handleSyncNow} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#087443] text-white text-xs sm:text-sm font-semibold disabled:opacity-50">
            <Upload className="w-4 h-4" />
            <span>Backup / Sync Now</span>
          </button>
          <button type="button" disabled={busy || !isOnline} onClick={handleRefreshFiles} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs sm:text-sm font-semibold">
            <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
            <span>Refresh Files</span>
          </button>
        </div>
      </form>

      {/* Drive Files Table */}
      {!status || status.files.length === 0 ? (
        <EmptyState title="No Drive Backup Files Yet" subtitle="Click Backup / Sync Now to upload a full JSON snapshot to Google Drive or local archive." />
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold">
                <th className="py-3 px-4">File Name</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Created</th>
                <th className="py-3 px-4 text-right">Size</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {status.files.map((f) => (
                <tr key={f.driveFileId}>
                  <td className="py-3 px-4 font-mono-tabular text-xs font-semibold">{f.fileName}</td>
                  <td className="py-3 px-4 text-xs">{f.source}</td>
                  <td className="py-3 px-4 text-xs font-mono-tabular">{new Date(f.createdAt).toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-xs font-mono-tabular">
                    {f.sizeBytes ? `${(f.sizeBytes / 1024).toFixed(1)} KB` : '—'}
                  </td>
                  <td className="py-3 px-4"><StatusLabel status={f.status} /></td>
                  <td className="py-3 px-4 text-right space-x-3 whitespace-nowrap">
                    {f.webViewLink && (
                      <a
                        href={f.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteFile(f.driveFileId, f.fileName)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
