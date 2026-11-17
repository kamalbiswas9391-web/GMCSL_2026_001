import crypto from 'crypto';
import { db } from './db.ts';
import type { GoogleDriveConfigStatus, GoogleDriveFileItem } from '../src/types.ts';

function maskTail(val: string): string {
  if (!val) return '';
  if (val.length <= 10) return '••••••••';
  return `${val.slice(0, 6)}••••${val.slice(-4)}`;
}

function genDriveLocalId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function buildSnapshotPayload() {
  const tables = [
    'members',
    'savings',
    'shares',
    'loans',
    'loan_repayments',
    'cash_book',
    'attendance',
    'loan_applications',
    'online_payments',
    'meetings',
    'notices',
    'notifications',
    'role_permissions',
    'society_settings',
    'receipts',
    'certificates',
  ];
  const snapshot: Record<string, any[]> = {};
  let total = 0;
  for (const t of tables) {
    const rows = db.prepare(`SELECT * FROM ${t}`).all();
    snapshot[t] = rows;
    total += rows.length;
  }
  return { snapshot, total };
}

function getRawDriveConfig(): any {
  return db.prepare('SELECT * FROM drive_config WHERE id = ?').get('default') || {};
}

export function getDriveFiles(): GoogleDriveFileItem[] {
  const rows = db.prepare('SELECT * FROM drive_files ORDER BY created_at DESC LIMIT 100').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    driveFileId: r.drive_file_id,
    fileName: r.file_name,
    mimeType: r.mime_type || 'application/json',
    sizeBytes: Number(r.size_bytes || 0),
    webViewLink: r.web_view_link || '',
    createdAt: r.created_at,
    createdBy: r.created_by,
    source: (r.source || 'Local Snapshot') as 'Google Drive' | 'Local Snapshot',
    status: (r.status || 'Synced') as 'Synced' | 'Pending' | 'Failed',
  }));
}

export function getDriveStatus(): GoogleDriveConfigStatus {
  const row = getRawDriveConfig();
  return {
    configured: Boolean(row.client_id || row.auth_token),
    hasClientId: Boolean(row.client_id),
    clientIdMasked: row.client_id ? maskTail(String(row.client_id)) : '',
    hasClientSecret: Boolean(row.client_secret),
    hasAuthToken: Boolean(row.auth_token),
    folderId: row.folder_id || '',
    folderName: row.folder_name || 'GMCSL_Society_Backups',
    syncFrequency: (row.sync_frequency || 'Manual') as GoogleDriveConfigStatus['syncFrequency'],
    autoBackup: Boolean(row.auto_backup),
    connected: Boolean(row.connected),
    lastSyncedAt: row.last_synced_at || null,
    lastError: row.last_error || null,
    files: getDriveFiles(),
  };
}

export function updateDriveConfig(body: {
  clientId?: string;
  clientSecret?: string;
  authToken?: string;
  folderId?: string;
  folderName?: string;
  syncFrequency?: 'Manual' | '15m' | 'Hourly' | 'Daily';
  autoBackup?: boolean;
}) {
  const current = getRawDriveConfig();
  const now = new Date().toISOString();
  const clientId = body.clientId !== undefined ? String(body.clientId).trim() : (current.client_id || '');
  const clientSecret =
    body.clientSecret && !String(body.clientSecret).includes('••••')
      ? String(body.clientSecret).trim()
      : (current.client_secret || '');
  const authToken =
    body.authToken && !String(body.authToken).includes('••••')
      ? String(body.authToken).trim()
      : body.authToken === ''
        ? ''
        : (current.auth_token || '');
  const folderId = body.folderId !== undefined ? String(body.folderId).trim() : (current.folder_id || '');
  const folderName = body.folderName !== undefined ? String(body.folderName).trim() || 'GMCSL_Society_Backups' : (current.folder_name || 'GMCSL_Society_Backups');
  const syncFrequency = body.syncFrequency || current.sync_frequency || 'Manual';
  const autoBackup = body.autoBackup !== undefined ? (body.autoBackup ? 1 : 0) : Number(current.auto_backup || 0);
  const connected = authToken ? 1 : 0;

  db.prepare(
    `UPDATE drive_config
     SET client_id = ?, client_secret = ?, auth_token = ?, folder_id = ?, folder_name = ?,
         sync_frequency = ?, auto_backup = ?, connected = ?, updated_at = ?
     WHERE id = 'default'`
  ).run(clientId, clientSecret, authToken, folderId, folderName, syncFrequency, autoBackup, connected, now);
}

export async function syncBackupToGoogleDrive(
  actor: string,
  overrideToken?: string
): Promise<{ ok: boolean; message: string; file?: GoogleDriveFileItem; driveStatus: GoogleDriveConfigStatus }> {
  const cfg = getRawDriveConfig();
  const token = (overrideToken || cfg.auth_token || '').trim();
  const now = new Date().toISOString();
  const fileName = `GMCSL_Backup_${now.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const { snapshot, total } = buildSnapshotPayload();
  const content = JSON.stringify({
    exportedAt: now,
    exportedBy: actor,
    recordCount: total,
    snapshot,
  });
  const sizeBytes = Buffer.byteLength(content, 'utf8');

  if (!token) {
    const errMsg = 'Google Drive Auth Token is not configured. Save an OAuth Access Token or connect Google account first.';
    db.prepare('UPDATE drive_config SET connected = 0, last_error = ?, updated_at = ? WHERE id = ?').run(errMsg, now, 'default');
    return { ok: false, message: errMsg, driveStatus: getDriveStatus() };
  }

  try {
    const boundary = `----GMCSLDriveBoundary${Date.now()}`;
    const metadata: Record<string, any> = {
      name: fileName,
      mimeType: 'application/json',
    };
    if (cfg.folder_id) {
      metadata.parents = [cfg.folder_id];
    }

    const multipartBody =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,createdTime',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      }
    );

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiErr = data?.error?.message || `Google Drive API returned HTTP ${res.status}`;
      db.prepare('UPDATE drive_config SET connected = 0, last_error = ?, updated_at = ? WHERE id = ?').run(apiErr, now, 'default');
      return { ok: false, message: apiErr, driveStatus: getDriveStatus() };
    }

    const localId = genDriveLocalId('DRV');
    const driveFileId = String(data.id || localId);
    const webViewLink = String(data.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`);

    db.prepare(
      `INSERT INTO drive_files (id, drive_file_id, file_name, mime_type, size_bytes, web_view_link, created_at, created_by, source, status)
       VALUES (?, ?, ?, 'application/json', ?, ?, ?, ?, 'Google Drive', 'Synced')`
    ).run(localId, driveFileId, String(data.name || fileName), Number(data.size || sizeBytes), webViewLink, now, actor);

    const backupId = genDriveLocalId('BKP');
    db.prepare(
      `INSERT INTO backup_logs (id, backup_id, backup_type, created_by, status, record_count, timestamp, notes)
       VALUES (?, ?, 'Full JSON Snapshot', ?, 'Completed', ?, ?, ?)`
    ).run(backupId, backupId, actor, total, now, `Synced to Google Drive (${driveFileId})`);

    db.prepare(
      'UPDATE drive_config SET connected = 1, last_synced_at = ?, last_error = ?, updated_at = ? WHERE id = ?'
    ).run(now, '', now, 'default');

    return {
      ok: true,
      message: `Backup uploaded to Google Drive (${data.name || fileName}, ${total} records).`,
      file: {
        id: localId,
        driveFileId,
        fileName: String(data.name || fileName),
        mimeType: 'application/json',
        sizeBytes: Number(data.size || sizeBytes),
        webViewLink,
        createdAt: now,
        createdBy: actor,
        source: 'Google Drive',
        status: 'Synced',
      },
      driveStatus: getDriveStatus(),
    };
  } catch (err: any) {
    const errMsg = err?.message || 'Network failure connecting to Google Drive API.';
    db.prepare('UPDATE drive_config SET connected = 0, last_error = ?, updated_at = ? WHERE id = ?').run(errMsg, now, 'default');
    return { ok: false, message: errMsg, driveStatus: getDriveStatus() };
  }
}

export async function refreshDriveFiles(
  overrideToken?: string
): Promise<{ ok: boolean; message: string; driveStatus: GoogleDriveConfigStatus }> {
  const cfg = getRawDriveConfig();
  const token = (overrideToken || cfg.auth_token || '').trim();
  const now = new Date().toISOString();
  if (!token) {
    return {
      ok: false,
      message: 'No Google Drive Auth Token saved. Showing cached metadata.',
      driveStatus: getDriveStatus(),
    };
  }

  try {
    const qParts = ["trashed = false", "name contains 'GMCSL_Backup_'"];
    if (cfg.folder_id) {
      qParts.push(`'${String(cfg.folder_id).replace(/'/g, "\\'")}' in parents`);
    }
    const q = encodeURIComponent(qParts.join(' and '));
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&orderBy=createdTime desc&pageSize=30&fields=files(id,name,mimeType,size,webViewLink,createdTime)`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const apiErr = data?.error?.message || `Google Drive API returned HTTP ${res.status}`;
      db.prepare('UPDATE drive_config SET connected = 0, last_error = ?, updated_at = ? WHERE id = ?').run(apiErr, now, 'default');
      return { ok: false, message: apiErr, driveStatus: getDriveStatus() };
    }

    const remoteFiles = Array.isArray(data.files) ? data.files : [];
    for (const rf of remoteFiles) {
      const existing = db.prepare('SELECT id FROM drive_files WHERE drive_file_id = ?').get(rf.id);
      if (!existing) {
        const lid = genDriveLocalId('DRV');
        db.prepare(
          `INSERT INTO drive_files (id, drive_file_id, file_name, mime_type, size_bytes, web_view_link, created_at, created_by, source, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'Google Drive', 'Google Drive', 'Synced')`
        ).run(
          lid,
          rf.id,
          rf.name || 'GMCSL Backup',
          rf.mimeType || 'application/json',
          Number(rf.size || 0),
          rf.webViewLink || `https://drive.google.com/file/d/${rf.id}/view`,
          rf.createdTime || now
        );
      }
    }

    db.prepare('UPDATE drive_config SET connected = 1, last_error = ?, updated_at = ? WHERE id = ?').run('', now, 'default');
    return {
      ok: true,
      message: `Fetched ${remoteFiles.length} backup file(s) from Google Drive.`,
      driveStatus: getDriveStatus(),
    };
  } catch (err: any) {
    const errMsg = err?.message || 'Failed to query Google Drive API.';
    db.prepare('UPDATE drive_config SET connected = 0, last_error = ?, updated_at = ? WHERE id = ?').run(errMsg, now, 'default');
    return { ok: false, message: errMsg, driveStatus: getDriveStatus() };
  }
}

export async function deleteDriveFile(
  idOrDriveFileId: string,
  overrideToken?: string
): Promise<{ ok: boolean; message: string; driveStatus: GoogleDriveConfigStatus }> {
  const row = db
    .prepare('SELECT * FROM drive_files WHERE id = ? OR drive_file_id = ?')
    .get(idOrDriveFileId, idOrDriveFileId) as any;
  if (!row) {
    return { ok: false, message: 'Drive file record not found.', driveStatus: getDriveStatus() };
  }

  const cfg = getRawDriveConfig();
  const token = (overrideToken || cfg.auth_token || '').trim();
  if (token && row.drive_file_id && row.source === 'Google Drive') {
    try {
      await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(row.drive_file_id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Proceed to remove local tracking row cleanly on explicit delete
    }
  }
  db.prepare('DELETE FROM drive_files WHERE id = ?').run(row.id);
  return { ok: true, message: `Deleted ${row.file_name}.`, driveStatus: getDriveStatus() };
}
