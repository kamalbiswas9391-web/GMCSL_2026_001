import { google } from 'googleapis';
import { db, PRIMARY_SHEET_NAMES, SUPPORTING_SHEET_NAMES } from './db.ts';
import type { GoogleSheetsStatus } from '../src/types.ts';

export const ALL_SHEET_NAMES = [...PRIMARY_SHEET_NAMES, ...SUPPORTING_SHEET_NAMES];

export const SHEET_HEADERS: Record<string, string[]> = {
  Member_Register_Sheet: [
    'Member ID', 'Member Name', "Father's Name", 'Join Date', 'Date of Birth', 'Aadhaar Number',
    'PAN Number', 'Voter ID', 'Bank Account Number', 'IFSC Code', 'Branch Name', 'Mobile Number',
    'Gmail ID', 'State', 'District', 'Development Block', 'Village', 'Post Office', 'PIN Code',
    'Panchayat', 'Photo URL', 'Signature URL', 'Member PIN Hash', 'Account Status', 'Created Date', 'Updated Date',
  ],
  Saving_register_Sheet: [
    'Saving ID', 'Member ID', 'Member Name', 'Date', 'Monthly Saving Amount', 'Previous Saving Amount',
    'Interest', 'Fine', 'Total Saving', 'Payment Status', 'Payment Method', 'Meeting Status',
    'Receipt Number', 'Created By', 'Created Date',
  ],
  Share_Register_Sheet: [
    'Share ID', 'Member ID', 'Member Name', 'Number of Shares', 'Face Value per Share',
    'Total Share Value', 'Date', 'Note', 'Created By',
  ],
  Loan_Register_Sheet: [
    'Loan ID', 'Loan Number', 'Member ID', 'Member Name', 'Loan Date', 'Loan Amount',
    'Previous Loan Amount', 'Total Loan Amount', 'Loan Repayment', 'Interest', 'Fine',
    'Current Loan Balance', 'Next Due Date', 'Payment Status', 'Loan Status', 'Payment Method',
    'Member Signature URL', 'Secretary Signature URL', 'President Signature URL', 'Created By', 'Updated Date',
  ],
  Cash_book_Sheet: [
    'Transaction ID', 'Date', 'Payment Mode', 'Description', 'Bank Amount', 'Cash Amount',
    'Total Amount', 'Deposit Amount', 'Payment Amount', 'Balance', 'Reference Number', 'Created By',
  ],
  Attendance_Register_Sheet: [
    'Attendance ID', 'Member ID', 'Member Name', 'Date', 'Meeting Location', 'Meeting Number',
    'Meeting Method', 'Attendance Status', 'Created By',
  ],
  Loan_apply_Sheet: [
    'Application ID', 'Member ID', 'Member Name', 'Mobile Number', 'Application Date',
    'Loan Amount Required', 'Purpose of Loan', 'Additional Note', 'Application Status',
    'Approval Note', 'Approved Amount', 'Approved By', 'Approval Date', 'President Signature', 'Secretary Signature',
  ],
  Online_Payments_Sheet: [
    'Payment ID', 'Member ID', 'Member Name', 'Date', 'Amount', 'Payment Method',
    'UPI Transaction ID', 'Payment Screenshot URL', 'Verification Status', 'Verified By',
    'Verification Date', 'Receipt Number', 'Notes',
  ],
  System_Users_Sheet: ['User ID', 'Role', 'Member ID', 'Full Name', 'Email', 'Mobile Number', 'Account Status', 'Is Locked', 'Last Login At', 'Created At'],
  Role_Permissions_Sheet: ['ID', 'Role', 'Module Key', 'View', 'Add', 'Edit', 'Delete', 'Hide', 'Updated By', 'Updated At'],
  Society_Settings_Sheet: ['ID', 'Settings JSON', 'Updated At'],
  Notice_Board_Sheet: ['Notice ID', 'Title', 'Category', 'Target Role', 'Publish Date', 'Expiry Date', 'Published', 'Content'],
  Notification_Sheet: ['Notification ID', 'Target Role', 'Target Member ID', 'Type', 'Title', 'Message', 'Read', 'Created At'],
  Media_Manager_Sheet: ['Media ID', 'Title', 'Media Type', 'File Name', 'Visibility', 'Uploaded By', 'Created At'],
  Audit_Log_Sheet: ['Audit ID', 'User ID', 'User Role', 'Action', 'Module', 'Record ID', 'Previous Value', 'Updated Value', 'Timestamp', 'Session Info'],
  Payment_Verification_Sheet: ['Verification ID', 'Payment ID', 'Member ID', 'UPI Transaction ID', 'Amount', 'Decision', 'Verified By', 'Notes', 'Verified At'],
  Meeting_Register_Sheet: ['Meeting ID', 'Meeting Number', 'Meeting Date', 'Meeting Type', 'Meeting Location', 'Meeting Agenda', 'Meeting Notes', 'Created By'],
  Receipt_Register_Sheet: ['Receipt Number', 'Receipt Type', 'Member ID', 'Member Name', 'Date', 'Amount', 'Payment Method', 'Verification Status', 'Authorized By'],
  Certificate_Register_Sheet: ['Certificate Number', 'Certificate Type', 'Member ID', 'Member Name', 'Issue Date', 'Issued By', 'Verification Code'],
  Backup_Log_Sheet: ['Backup ID', 'Backup Type', 'Created By', 'Status', 'Record Count', 'Timestamp', 'Notes'],
  Session_Log_Sheet: ['Session ID', 'User ID', 'User Role', 'User Name', 'Login Time', 'Expires At', 'Active', 'Device Info'],
  Financial_Ledger_Sheet: ['Ledger ID', 'Module', 'Record ID', 'Member ID', 'Entry Type', 'Amount', 'Direction', 'Idempotency Key', 'Created By', 'Created At'],
  Sync_Metadata_Sheet: ['Operation ID', 'Module', 'Action', 'Record ID', 'Processed By', 'Processed At', 'Result'],
};

function getConfigRow() {
  return db.prepare('SELECT * FROM sheets_config WHERE id = ?').get('default') as any;
}

function appendErrorLog(message: string, sheet?: string) {
  const row = getConfigRow();
  let logs: Array<{ timestamp: string; message: string; sheet?: string }> = [];
  try {
    logs = JSON.parse(row?.error_logs || '[]');
  } catch {
    logs = [];
  }
  logs.unshift({ timestamp: new Date().toISOString(), message, sheet });
  logs = logs.slice(0, 30);
  db.prepare('UPDATE sheets_config SET last_error = ?, error_logs = ?, connected = 0 WHERE id = ?').run(
    message,
    JSON.stringify(logs),
    'default'
  );
}

export function getSheetsStatus(): GoogleSheetsStatus {
  const row = getConfigRow();
  const pendingMeta = db.prepare("SELECT COUNT(*) as c FROM sync_metadata WHERE result = 'PENDING_SHEET_PUSH'").get() as { c: number };
  let errorLogs = [];
  try {
    errorLogs = JSON.parse(row?.error_logs || '[]');
  } catch {
    errorLogs = [];
  }
  return {
    mode: (row?.mode || 'not_configured') as GoogleSheetsStatus['mode'],
    spreadsheetId: row?.spreadsheet_id || '',
    appsScriptUrl: row?.apps_script_url || '',
    connected: Boolean(row?.connected),
    lastCheckedAt: row?.last_checked_at || null,
    lastSyncedAt: row?.last_synced_at || null,
    lastError: row?.last_error || null,
    pendingCount: pendingMeta.c,
    mappedSheets: ALL_SHEET_NAMES,
    errorLogs,
  };
}

export function updateSheetsConfig(params: {
  mode: 'service_account' | 'apps_script' | 'not_configured';
  spreadsheetId?: string;
  appsScriptUrl?: string;
  appsScriptSecret?: string;
  serviceAccountEmail?: string;
  serviceAccountKey?: string;
}) {
  const existing = getConfigRow();
  const nextEmail = params.serviceAccountEmail ?? existing?.service_account_email ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? '';
  const nextKey = params.serviceAccountKey || existing?.service_account_key || process.env.GOOGLE_PRIVATE_KEY || '';
  const nextSpreadsheetId = params.spreadsheetId ?? existing?.spreadsheet_id ?? process.env.GOOGLE_SPREADSHEET_ID ?? '';
  const nextAppsScriptUrl = params.appsScriptUrl ?? existing?.apps_script_url ?? process.env.GOOGLE_APPS_SCRIPT_URL ?? '';
  const nextAppsScriptSecret = params.appsScriptSecret ?? existing?.apps_script_secret ?? process.env.GOOGLE_APPS_SCRIPT_SECRET ?? '';

  db.prepare(
    `UPDATE sheets_config SET mode = ?, spreadsheet_id = ?, apps_script_url = ?, apps_script_secret = ?, service_account_email = ?, service_account_key = ?, connected = 0, last_error = '' WHERE id = 'default'`
  ).run(params.mode, nextSpreadsheetId, nextAppsScriptUrl, nextAppsScriptSecret, nextEmail, nextKey);
}

function getServiceAccountClient() {
  const row = getConfigRow();
  const email = row?.service_account_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  const rawKey = row?.service_account_key || process.env.GOOGLE_PRIVATE_KEY || '';
  const spreadsheetId = row?.spreadsheet_id || process.env.GOOGLE_SPREADSHEET_ID || '';
  if (!email || !rawKey || !spreadsheetId) {
    throw new Error('Google Service Account Email, Private Key, and Spreadsheet ID are required.');
  }
  const formattedKey = rawKey.trim().replace(/^"+|"+$/g, '').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT({
    email,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { sheets: google.sheets({ version: 'v4', auth }), spreadsheetId };
}

export async function testGoogleSheetsConnection(): Promise<{ ok: boolean; message: string; title?: string; existingSheets?: string[] }> {
  const row = getConfigRow();
  const now = new Date().toISOString();
  try {
    if (row?.mode === 'service_account') {
      const { sheets, spreadsheetId } = getServiceAccountClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const title = meta.data.properties?.title || spreadsheetId;
      const existingSheets = (meta.data.sheets || []).map((s) => s.properties?.title || '').filter(Boolean);
      db.prepare('UPDATE sheets_config SET connected = 1, last_checked_at = ?, last_error = ? WHERE id = ?').run(now, '', 'default');
      return { ok: true, message: `Connected to Google Spreadsheet: ${title}`, title, existingSheets };
    }

    if (row?.mode === 'apps_script') {
      if (!row.apps_script_url) {
        throw new Error('Google Apps Script Web App URL is not configured.');
      }
      const res = await fetch(row.apps_script_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test', secret: row.apps_script_secret || '', spreadsheetId: row.spreadsheet_id || '' }),
      });
      if (!res.ok) {
        throw new Error(`Apps Script returned HTTP ${res.status}`);
      }
      const data = (await res.json()) as any;
      if (!data.ok) {
        throw new Error(data.error || 'Apps Script connection test failed.');
      }
      db.prepare('UPDATE sheets_config SET connected = 1, last_checked_at = ?, last_error = ? WHERE id = ?').run(now, '', 'default');
      return { ok: true, message: data.message || 'Connected via Google Apps Script.', title: data.title, existingSheets: data.sheets };
    }

    throw new Error('Google Sheets integration is not configured. Configure Service Account or Google Apps Script URL first.');
  } catch (err: any) {
    const msg = err?.message || 'Google Sheets connection failed.';
    db.prepare('UPDATE sheets_config SET last_checked_at = ? WHERE id = ?').run(now, 'default');
    appendErrorLog(msg);
    return { ok: false, message: msg };
  }
}

export async function ensureAllGoogleSheets(): Promise<{ ok: boolean; created: string[]; message: string }> {
  const row = getConfigRow();
  try {
    if (row?.mode === 'service_account') {
      const { sheets, spreadsheetId } = getServiceAccountClient();
      const meta = await sheets.spreadsheets.get({ spreadsheetId });
      const existing = new Set((meta.data.sheets || []).map((s) => s.properties?.title || ''));
      const missing = ALL_SHEET_NAMES.filter((name) => !existing.has(name));

      if (missing.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
          },
        });
        for (const sheetName of missing) {
          const headers = SHEET_HEADERS[sheetName] || ['ID', 'Data'];
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [headers] },
          });
        }
      }
      db.prepare('UPDATE sheets_config SET connected = 1, last_checked_at = ?, last_error = ? WHERE id = ?').run(
        new Date().toISOString(),
        '',
        'default'
      );
      return {
        ok: true,
        created: missing,
        message: missing.length > 0 ? `Created ${missing.length} sheets with headers.` : 'All 23 required sheets already exist.',
      };
    }

    if (row?.mode === 'apps_script' && row.apps_script_url) {
      const res = await fetch(row.apps_script_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ensureSheets',
          secret: row.apps_script_secret || '',
          spreadsheetId: row.spreadsheet_id || '',
          headersMap: SHEET_HEADERS,
        }),
      });
      const data = (await res.json()) as any;
      if (!data.ok) throw new Error(data.error || 'Failed to ensure sheets via Apps Script.');
      return { ok: true, created: data.created || [], message: data.message || 'Sheets verified via Apps Script.' };
    }

    throw new Error('Google Sheets credentials are not configured.');
  } catch (err: any) {
    const msg = err?.message || 'Failed to create Google Sheets tabs.';
    appendErrorLog(msg);
    return { ok: false, created: [], message: msg };
  }
}

function gatherAllSheetsRows(): Record<string, any[][]> {
  const members = db.prepare('SELECT * FROM members ORDER BY created_date ASC').all() as any[];
  const savings = db.prepare('SELECT * FROM savings ORDER BY date ASC').all() as any[];
  const shares = db.prepare('SELECT * FROM shares ORDER BY date ASC').all() as any[];
  const loans = db.prepare('SELECT * FROM loans ORDER BY loan_date ASC').all() as any[];
  const cashBook = db.prepare('SELECT * FROM cash_book ORDER BY date ASC').all() as any[];
  const attendance = db.prepare('SELECT * FROM attendance ORDER BY date ASC').all() as any[];
  const loanApps = db.prepare('SELECT * FROM loan_applications ORDER BY application_date ASC').all() as any[];
  const onlinePayments = db.prepare('SELECT * FROM online_payments ORDER BY date ASC').all() as any[];
  const systemUsers = db.prepare('SELECT * FROM system_users ORDER BY created_at ASC').all() as any[];
  const perms = db.prepare('SELECT * FROM role_permissions').all() as any[];
  const settings = db.prepare('SELECT * FROM society_settings').all() as any[];
  const notices = db.prepare('SELECT * FROM notices ORDER BY publish_date DESC').all() as any[];
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY created_at DESC').all() as any[];
  const media = db.prepare('SELECT * FROM media_items ORDER BY created_at DESC').all() as any[];
  const audits = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500').all() as any[];
  const verifications = db.prepare('SELECT * FROM payment_verifications ORDER BY verified_at DESC').all() as any[];
  const meetings = db.prepare('SELECT * FROM meetings ORDER BY meeting_date DESC').all() as any[];
  const receipts = db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all() as any[];
  const certs = db.prepare('SELECT * FROM certificates ORDER BY issue_date DESC').all() as any[];
  const backups = db.prepare('SELECT * FROM backup_logs ORDER BY timestamp DESC').all() as any[];
  const sessions = db.prepare('SELECT * FROM session_logs ORDER BY login_time DESC LIMIT 200').all() as any[];
  const ledger = db.prepare('SELECT * FROM financial_ledger ORDER BY created_at DESC LIMIT 1000').all() as any[];
  const syncMeta = db.prepare('SELECT * FROM sync_metadata ORDER BY processed_at DESC LIMIT 500').all() as any[];

  return {
    Member_Register_Sheet: [
      SHEET_HEADERS.Member_Register_Sheet,
      ...members.map((m) => [
        m.member_id, m.member_name, m.father_name, m.join_date, m.date_of_birth,
        m.aadhaar_number ? `XXXX-${m.aadhaar_number.slice(-4)}` : '',
        m.pan_number ? `XXXXX${m.pan_number.slice(-4)}` : '',
        m.voter_id, m.bank_account_number ? `XXXX${m.bank_account_number.slice(-4)}` : '',
        m.ifsc_code, m.branch_name, m.mobile_number, m.gmail_id, m.state, m.district,
        m.development_block, m.village, m.post_office, m.pin_code, m.panchayat,
        m.photo_url ? '[stored]' : '', m.signature_url ? '[stored]' : '',
        '[PROTECTED_HASH]', m.account_status, m.created_date, m.updated_date,
      ]),
    ],
    Saving_register_Sheet: [
      SHEET_HEADERS.Saving_register_Sheet,
      ...savings.map((s) => [
        s.saving_id, s.member_id, s.member_name, s.date, s.monthly_saving_amount,
        s.previous_saving_amount, s.interest, s.fine, s.total_saving, s.payment_status,
        s.payment_method, s.meeting_status, s.receipt_number, s.created_by, s.created_date,
      ]),
    ],
    Share_Register_Sheet: [
      SHEET_HEADERS.Share_Register_Sheet,
      ...shares.map((s) => [
        s.share_id, s.member_id, s.member_name, s.number_of_shares, s.face_value_per_share,
        s.total_share_value, s.date, s.note, s.created_by,
      ]),
    ],
    Loan_Register_Sheet: [
      SHEET_HEADERS.Loan_Register_Sheet,
      ...loans.map((l) => [
        l.loan_id, l.loan_number, l.member_id, l.member_name, l.loan_date, l.loan_amount,
        l.previous_loan_amount, l.total_loan_amount, l.loan_repayment, l.interest, l.fine,
        l.current_loan_balance, l.next_due_date, l.payment_status, l.loan_status, l.payment_method,
        l.member_signature_url ? '[signed]' : '', l.secretary_signature_url ? '[signed]' : '',
        l.president_signature_url ? '[signed]' : '', l.created_by, l.updated_date,
      ]),
    ],
    Cash_book_Sheet: [
      SHEET_HEADERS.Cash_book_Sheet,
      ...cashBook.map((c) => [
        c.transaction_id, c.date, c.payment_mode, c.description, c.bank_amount, c.cash_amount,
        c.total_amount, c.deposit_amount, c.payment_amount, c.balance, c.reference_number, c.created_by,
      ]),
    ],
    Attendance_Register_Sheet: [
      SHEET_HEADERS.Attendance_Register_Sheet,
      ...attendance.map((a) => [
        a.attendance_id, a.member_id, a.member_name, a.date, a.meeting_location,
        a.meeting_number, a.meeting_method, a.attendance_status, a.created_by,
      ]),
    ],
    Loan_apply_Sheet: [
      SHEET_HEADERS.Loan_apply_Sheet,
      ...loanApps.map((a) => [
        a.application_id, a.member_id, a.member_name, a.mobile_number, a.application_date,
        a.loan_amount_required, a.purpose_of_loan, a.additional_note, a.application_status,
        a.approval_note, a.approved_amount, a.approved_by, a.approval_date,
        a.president_signature ? '[signed]' : '', a.secretary_signature ? '[signed]' : '',
      ]),
    ],
    Online_Payments_Sheet: [
      SHEET_HEADERS.Online_Payments_Sheet,
      ...onlinePayments.map((p) => [
        p.payment_id, p.member_id, p.member_name, p.date, p.amount, p.payment_method,
        p.upi_transaction_id, p.payment_screenshot_url ? '[uploaded]' : '', p.verification_status,
        p.verified_by, p.verification_date, p.receipt_number, p.notes,
      ]),
    ],
    System_Users_Sheet: [
      SHEET_HEADERS.System_Users_Sheet,
      ...systemUsers.map((u) => [u.user_id, u.role, u.member_id, u.full_name, u.email, u.mobile_number, u.account_status, u.is_locked, u.last_login_at, u.created_at]),
    ],
    Role_Permissions_Sheet: [
      SHEET_HEADERS.Role_Permissions_Sheet,
      ...perms.map((p) => [p.id, p.role, p.module_key, p.can_view, p.can_add, p.can_edit, p.can_delete, p.is_hidden, p.updated_by, p.updated_at]),
    ],
    Society_Settings_Sheet: [
      SHEET_HEADERS.Society_Settings_Sheet,
      ...settings.map((s) => [s.id, s.data, s.updated_at]),
    ],
    Notice_Board_Sheet: [
      SHEET_HEADERS.Notice_Board_Sheet,
      ...notices.map((n) => [n.notice_id, n.title, n.category, n.target_role, n.publish_date, n.expiry_date, n.is_published, n.content]),
    ],
    Notification_Sheet: [
      SHEET_HEADERS.Notification_Sheet,
      ...notifications.map((n) => [n.notification_id, n.target_role, n.target_member_id, n.type, n.title, n.message, n.is_read, n.created_at]),
    ],
    Media_Manager_Sheet: [
      SHEET_HEADERS.Media_Manager_Sheet,
      ...media.map((m) => [m.media_id, m.title, m.media_type, m.file_name, m.visibility, m.uploaded_by, m.created_at]),
    ],
    Audit_Log_Sheet: [
      SHEET_HEADERS.Audit_Log_Sheet,
      ...audits.map((a) => [a.audit_id, a.user_id, a.user_role, a.action, a.module, a.record_id, a.previous_value, a.updated_value, a.timestamp, a.session_info]),
    ],
    Payment_Verification_Sheet: [
      SHEET_HEADERS.Payment_Verification_Sheet,
      ...verifications.map((v) => [v.verification_id, v.payment_id, v.member_id, v.upi_transaction_id, v.amount, v.decision, v.verified_by, v.notes, v.verified_at]),
    ],
    Meeting_Register_Sheet: [
      SHEET_HEADERS.Meeting_Register_Sheet,
      ...meetings.map((m) => [m.meeting_id, m.meeting_number, m.meeting_date, m.meeting_type, m.meeting_location, m.meeting_agenda, m.meeting_notes, m.created_by]),
    ],
    Receipt_Register_Sheet: [
      SHEET_HEADERS.Receipt_Register_Sheet,
      ...receipts.map((r) => [r.receipt_number, r.receipt_type, r.member_id, r.member_name, r.date, r.amount, r.payment_method, r.verification_status, r.authorized_by]),
    ],
    Certificate_Register_Sheet: [
      SHEET_HEADERS.Certificate_Register_Sheet,
      ...certs.map((c) => [c.certificate_number, c.certificate_type, c.member_id, c.member_name, c.issue_date, c.issued_by, c.verification_code]),
    ],
    Backup_Log_Sheet: [
      SHEET_HEADERS.Backup_Log_Sheet,
      ...backups.map((b) => [b.backup_id, b.backup_type, b.created_by, b.status, b.record_count, b.timestamp, b.notes]),
    ],
    Session_Log_Sheet: [
      SHEET_HEADERS.Session_Log_Sheet,
      ...sessions.map((s) => [s.session_id, s.user_id, s.user_role, s.user_name, s.login_time, s.expires_at, s.is_active, s.device_info]),
    ],
    Financial_Ledger_Sheet: [
      SHEET_HEADERS.Financial_Ledger_Sheet,
      ...ledger.map((l) => [l.ledger_id, l.module, l.record_id, l.member_id, l.entry_type, l.amount, l.direction, l.idempotency_key, l.created_by, l.created_at]),
    ],
    Sync_Metadata_Sheet: [
      SHEET_HEADERS.Sync_Metadata_Sheet,
      ...syncMeta.map((s) => [s.operation_id, s.module, s.action, s.record_id, s.processed_by, s.processed_at, s.result]),
    ],
  };
}

export async function syncAllToGoogleSheets(): Promise<{ ok: boolean; syncedSheets: number; message: string }> {
  const row = getConfigRow();
  const now = new Date().toISOString();
  const payload = gatherAllSheetsRows();

  try {
    if (row?.mode === 'service_account') {
      const { sheets, spreadsheetId } = getServiceAccountClient();
      await ensureAllGoogleSheets();
      const data = Object.entries(payload).map(([sheetName, values]) => ({
        range: `${sheetName}!A1`,
        values,
      }));
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data,
        },
      });
      db.prepare('UPDATE sheets_config SET connected = 1, last_synced_at = ?, last_error = ? WHERE id = ?').run(now, '', 'default');
      return { ok: true, syncedSheets: data.length, message: `Synchronized ${data.length} sheets to Google Sheets.` };
    }

    if (row?.mode === 'apps_script' && row.apps_script_url) {
      const res = await fetch(row.apps_script_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncPush',
          secret: row.apps_script_secret || '',
          spreadsheetId: row.spreadsheet_id || '',
          sheetsData: payload,
        }),
      });
      const data = (await res.json()) as any;
      if (!data.ok) throw new Error(data.error || 'Apps Script synchronization failed.');
      db.prepare('UPDATE sheets_config SET connected = 1, last_synced_at = ?, last_error = ? WHERE id = ?').run(now, '', 'default');
      return { ok: true, syncedSheets: Object.keys(payload).length, message: 'Synchronized all sheets via Google Apps Script.' };
    }

    throw new Error('Google Sheets integration is not configured.');
  } catch (err: any) {
    const msg = err?.message || 'Google Sheets sync failed.';
    appendErrorLog(msg);
    return { ok: false, syncedSheets: 0, message: msg };
  }
}

export const APPS_SCRIPT_TEMPLATE = `// GMCSL Society Management System — Google Apps Script Bridge (Code.gs)
// Deploy as Web App: Execute as "Me", Who has access: "Anyone" (secured by SHARED_SECRET)
const SHARED_SECRET = "REPLACE_WITH_YOUR_SECRET";

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (SHARED_SECRET && req.secret !== SHARED_SECRET) {
      return jsonOut({ ok: false, error: "Unauthorized secret" });
    }
    var ss = req.spreadsheetId ? SpreadsheetApp.openById(req.spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
    if (req.action === "test") {
      return jsonOut({
        ok: true,
        title: ss.getName(),
        sheets: ss.getSheets().map(function(s){ return s.getName(); }),
        message: "Connected to " + ss.getName()
      });
    }
    if (req.action === "ensureSheets") {
      var created = [];
      Object.keys(req.headersMap).forEach(function(name) {
        var sheet = ss.getSheetByName(name);
        if (!sheet) {
          sheet = ss.insertSheet(name);
          sheet.appendRow(req.headersMap[name]);
          created.push(name);
        }
      });
      return jsonOut({ ok: true, created: created, message: "Verified all GMCSL sheets." });
    }
    if (req.action === "syncPush") {
      Object.keys(req.sheetsData).forEach(function(name) {
        var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
        sheet.clearContents();
        var rows = req.sheetsData[name];
        if (rows && rows.length > 0) {
          sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
        }
      });
      return jsonOut({ ok: true, message: "Synchronized all sheets." });
    }
    return jsonOut({ ok: false, error: "Unknown action" });
  } catch (err) {
    return jsonOut({ ok: false, error: err.toString() });
  }
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}`;
