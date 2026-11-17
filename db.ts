import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import bcrypt from 'bcryptjs';
import type { ModuleKey, RolePermission, SocietySettings, UserRole } from '../src/types.ts';

function resolveWritableDataDir(): string {
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    const tmpDir = path.join(os.tmpdir(), 'gmcsl-data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
  const localDir = path.resolve(process.cwd(), 'data');
  try {
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.accessSync(localDir, fs.constants.W_OK);
    return localDir;
  } catch {
    const tmpDir = path.join(os.tmpdir(), 'gmcsl-data');
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }
    return tmpDir;
  }
}

export const DATA_DIR = resolveWritableDataDir();
const DB_PATH = path.join(DATA_DIR, 'gmcsl.sqlite');
export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Pre-computed bcrypt hash (cost 12) used only if INITIAL_SYSTEM_PASSWORD is not set in env
const DEFAULT_SYSTEM_PASSWORD_HASH = '$2b$12$eRNx.xYHeBSiwvayOTQtuOkUkwWD.wHg2vuJOwgc1K18Oax.MvMyi';
let dbInitialized = false;

export const PRIMARY_SHEET_NAMES = [
  'Member_Register_Sheet',
  'Saving_register_Sheet',
  'Share_Register_Sheet',
  'Loan_Register_Sheet',
  'Cash_book_Sheet',
  'Attendance_Register_Sheet',
  'Loan_apply_Sheet',
  'Online_Payments_Sheet',
] as const;

export const SUPPORTING_SHEET_NAMES = [
  'System_Users_Sheet',
  'Role_Permissions_Sheet',
  'Society_Settings_Sheet',
  'Notice_Board_Sheet',
  'Notification_Sheet',
  'Media_Manager_Sheet',
  'Audit_Log_Sheet',
  'Payment_Verification_Sheet',
  'Meeting_Register_Sheet',
  'Receipt_Register_Sheet',
  'Certificate_Register_Sheet',
  'Backup_Log_Sheet',
  'Session_Log_Sheet',
  'Financial_Ledger_Sheet',
  'Sync_Metadata_Sheet',
] as const;

export const ALL_MODULES: ModuleKey[] = [
  'member_register',
  'saving_register',
  'loan_register',
  'loan_repayment',
  'cash_book',
  'share_register',
  'attendance',
  'loan_application',
  'online_payment',
  'reports',
  'notices',
  'meetings',
  'id_certificates',
  'media_manager',
];

export function initDatabase() {
  if (dbInitialized) return;
  db.exec(`
    -- 1. Member_Register_Sheet
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_id TEXT UNIQUE NOT NULL,
      member_name TEXT NOT NULL,
      father_name TEXT DEFAULT '',
      join_date TEXT NOT NULL,
      date_of_birth TEXT DEFAULT '',
      aadhaar_number TEXT DEFAULT '',
      pan_number TEXT DEFAULT '',
      voter_id TEXT DEFAULT '',
      bank_account_number TEXT DEFAULT '',
      ifsc_code TEXT DEFAULT '',
      branch_name TEXT DEFAULT '',
      mobile_number TEXT UNIQUE NOT NULL,
      gmail_id TEXT DEFAULT '',
      state TEXT DEFAULT 'Assam',
      district TEXT DEFAULT '',
      development_block TEXT DEFAULT '',
      village TEXT DEFAULT '',
      post_office TEXT DEFAULT '',
      pin_code TEXT DEFAULT '',
      panchayat TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      signature_url TEXT DEFAULT '',
      member_pin_hash TEXT DEFAULT '',
      account_status TEXT DEFAULT 'Active',
      is_locked INTEGER DEFAULT 0,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- 2. Saving_register_Sheet
    CREATE TABLE IF NOT EXISTS savings (
      id TEXT PRIMARY KEY,
      saving_id TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      monthly_saving_amount REAL NOT NULL DEFAULT 0,
      previous_saving_amount REAL NOT NULL DEFAULT 0,
      interest REAL NOT NULL DEFAULT 0,
      fine REAL NOT NULL DEFAULT 0,
      total_saving REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      meeting_status TEXT NOT NULL,
      receipt_number TEXT DEFAULT '',
      is_reversal INTEGER DEFAULT 0,
      reversed_record_id TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- 3. Share_Register_Sheet
    CREATE TABLE IF NOT EXISTS shares (
      id TEXT PRIMARY KEY,
      share_id TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      number_of_shares INTEGER NOT NULL DEFAULT 0,
      face_value_per_share REAL NOT NULL DEFAULT 0,
      total_share_value REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- 4. Loan_Register_Sheet
    CREATE TABLE IF NOT EXISTS loans (
      id TEXT PRIMARY KEY,
      loan_id TEXT UNIQUE NOT NULL,
      loan_number TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      loan_date TEXT NOT NULL,
      loan_amount REAL NOT NULL DEFAULT 0,
      previous_loan_amount REAL NOT NULL DEFAULT 0,
      total_loan_amount REAL NOT NULL DEFAULT 0,
      loan_repayment REAL NOT NULL DEFAULT 0,
      interest REAL NOT NULL DEFAULT 0,
      fine REAL NOT NULL DEFAULT 0,
      current_loan_balance REAL NOT NULL DEFAULT 0,
      next_due_date TEXT DEFAULT '',
      payment_status TEXT NOT NULL,
      loan_status TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      member_signature_url TEXT DEFAULT '',
      secretary_signature_url TEXT DEFAULT '',
      president_signature_url TEXT DEFAULT '',
      application_id TEXT DEFAULT '',
      is_disbursement INTEGER DEFAULT 1,
      is_reversal INTEGER DEFAULT 0,
      reversed_record_id TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- 5. Cash_book_Sheet
    CREATE TABLE IF NOT EXISTS cash_book (
      id TEXT PRIMARY KEY,
      transaction_id TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      payment_mode TEXT NOT NULL,
      description TEXT NOT NULL,
      bank_amount REAL NOT NULL DEFAULT 0,
      cash_amount REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      deposit_amount REAL NOT NULL DEFAULT 0,
      payment_amount REAL NOT NULL DEFAULT 0,
      balance REAL NOT NULL DEFAULT 0,
      bank_balance_after REAL NOT NULL DEFAULT 0,
      cash_balance_after REAL NOT NULL DEFAULT 0,
      reference_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      allow_adjustment INTEGER DEFAULT 0,
      is_reversal INTEGER DEFAULT 0,
      reversed_record_id TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- 6. Attendance_Register_Sheet
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      attendance_id TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      meeting_location TEXT DEFAULT '',
      meeting_number TEXT NOT NULL,
      meeting_method TEXT NOT NULL,
      attendance_status TEXT NOT NULL,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT '',
      UNIQUE(member_id, meeting_number)
    );

    -- 7. Loan_apply_Sheet
    CREATE TABLE IF NOT EXISTS loan_applications (
      id TEXT PRIMARY KEY,
      application_id TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      mobile_number TEXT NOT NULL,
      application_date TEXT NOT NULL,
      loan_amount_required REAL NOT NULL DEFAULT 0,
      purpose_of_loan TEXT NOT NULL,
      additional_note TEXT DEFAULT '',
      supporting_document_url TEXT DEFAULT '',
      application_status TEXT DEFAULT 'Pending',
      approval_note TEXT DEFAULT '',
      approved_amount REAL DEFAULT 0,
      approved_by TEXT DEFAULT '',
      approval_date TEXT DEFAULT '',
      president_signature TEXT DEFAULT '',
      secretary_signature TEXT DEFAULT '',
      disbursed INTEGER DEFAULT 0,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- 8. Online_Payments_Sheet
    CREATE TABLE IF NOT EXISTS online_payments (
      id TEXT PRIMARY KEY,
      payment_id TEXT UNIQUE NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL,
      upi_transaction_id TEXT UNIQUE NOT NULL,
      payment_screenshot_url TEXT DEFAULT '',
      verification_status TEXT DEFAULT 'Pending',
      verified_by TEXT DEFAULT '',
      verification_date TEXT DEFAULT '',
      receipt_number TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- Supporting Sheets
    CREATE TABLE IF NOT EXISTS system_users (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      member_id TEXT DEFAULT '',
      full_name TEXT NOT NULL,
      email TEXT DEFAULT '',
      mobile_number TEXT DEFAULT '',
      password_hash TEXT DEFAULT '',
      pin_hash TEXT DEFAULT '',
      account_status TEXT DEFAULT 'Active',
      is_locked INTEGER DEFAULT 0,
      failed_attempts INTEGER DEFAULT 0,
      locked_until TEXT DEFAULT '',
      must_change_password INTEGER DEFAULT 0,
      last_login_at TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      module_key TEXT NOT NULL,
      can_view INTEGER DEFAULT 1,
      can_add INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      can_delete INTEGER DEFAULT 0,
      is_hidden INTEGER DEFAULT 0,
      updated_by TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(role, module_key)
    );

    CREATE TABLE IF NOT EXISTS society_settings (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notices (
      id TEXT PRIMARY KEY,
      notice_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      title_as TEXT DEFAULT '',
      content TEXT NOT NULL,
      content_as TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      target_role TEXT DEFAULT 'Everyone',
      attachment_url TEXT DEFAULT '',
      attachment_type TEXT DEFAULT 'Text',
      publish_date TEXT NOT NULL,
      expiry_date TEXT DEFAULT '',
      is_published INTEGER DEFAULT 1,
      is_banner INTEGER DEFAULT 0,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      notification_id TEXT UNIQUE NOT NULL,
      target_role TEXT NOT NULL,
      target_member_id TEXT DEFAULT '',
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      related_id TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS media_items (
      id TEXT PRIMARY KEY,
      media_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      title_as TEXT DEFAULT '',
      description TEXT DEFAULT '',
      media_type TEXT NOT NULL,
      data_url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      visibility TEXT DEFAULT 'Everyone',
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      audit_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT NOT NULL,
      previous_value TEXT DEFAULT '',
      updated_value TEXT DEFAULT '',
      timestamp TEXT NOT NULL,
      session_info TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS payment_verifications (
      id TEXT PRIMARY KEY,
      verification_id TEXT UNIQUE NOT NULL,
      payment_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      upi_transaction_id TEXT NOT NULL,
      amount REAL NOT NULL,
      decision TEXT NOT NULL,
      verified_by TEXT NOT NULL,
      notes TEXT DEFAULT '',
      verified_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      meeting_id TEXT UNIQUE NOT NULL,
      meeting_number TEXT UNIQUE NOT NULL,
      meeting_date TEXT NOT NULL,
      meeting_type TEXT NOT NULL,
      meeting_location TEXT NOT NULL,
      meeting_agenda TEXT DEFAULT '',
      meeting_notes TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS receipts (
      id TEXT PRIMARY KEY,
      receipt_number TEXT UNIQUE NOT NULL,
      receipt_type TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      details TEXT DEFAULT '',
      verification_status TEXT NOT NULL,
      authorized_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS certificates (
      id TEXT PRIMARY KEY,
      certificate_number TEXT UNIQUE NOT NULL,
      certificate_type TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      issued_by TEXT NOT NULL,
      verification_code TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_logs (
      id TEXT PRIMARY KEY,
      backup_id TEXT UNIQUE NOT NULL,
      backup_type TEXT NOT NULL,
      created_by TEXT NOT NULL,
      status TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS session_logs (
      id TEXT PRIMARY KEY,
      session_id TEXT UNIQUE NOT NULL,
      user_id TEXT NOT NULL,
      user_role TEXT NOT NULL,
      user_name TEXT NOT NULL,
      login_time TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      device_info TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS financial_ledger (
      id TEXT PRIMARY KEY,
      ledger_id TEXT UNIQUE NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT NOT NULL,
      member_id TEXT DEFAULT '',
      entry_type TEXT NOT NULL,
      amount REAL NOT NULL,
      direction TEXT NOT NULL,
      description TEXT DEFAULT '',
      idempotency_key TEXT UNIQUE NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_metadata (
      operation_id TEXT PRIMARY KEY,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      record_id TEXT NOT NULL,
      processed_by TEXT NOT NULL,
      processed_at TEXT NOT NULL,
      result TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sheets_config (
      id TEXT PRIMARY KEY,
      mode TEXT DEFAULT 'not_configured',
      spreadsheet_id TEXT DEFAULT '',
      apps_script_url TEXT DEFAULT '',
      apps_script_secret TEXT DEFAULT '',
      service_account_email TEXT DEFAULT '',
      service_account_key TEXT DEFAULT '',
      last_checked_at TEXT DEFAULT '',
      last_synced_at TEXT DEFAULT '',
      last_error TEXT DEFAULT '',
      connected INTEGER DEFAULT 0,
      error_logs TEXT DEFAULT '[]'
    );

    -- Dedicated Loan Repayment Register
    CREATE TABLE IF NOT EXISTS loan_repayments (
      id TEXT PRIMARY KEY,
      repayment_id TEXT UNIQUE NOT NULL,
      loan_id TEXT NOT NULL,
      loan_number TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_name TEXT NOT NULL,
      date TEXT NOT NULL,
      loan_balance_before REAL NOT NULL DEFAULT 0,
      principal_paid REAL NOT NULL DEFAULT 0,
      interest_paid REAL NOT NULL DEFAULT 0,
      fine_paid REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL DEFAULT 0,
      loan_balance_after REAL NOT NULL DEFAULT 0,
      payment_mode TEXT NOT NULL DEFAULT 'Cash',
      member_signature_url TEXT DEFAULT '',
      secretary_signature_url TEXT DEFAULT '',
      president_signature_url TEXT DEFAULT '',
      photo_url TEXT DEFAULT '',
      receipt_number TEXT DEFAULT '',
      saving_id TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL,
      created_by TEXT NOT NULL,
      updated_by TEXT NOT NULL,
      sync_status TEXT DEFAULT 'Synced',
      last_synced_time TEXT DEFAULT '',
      record_version INTEGER DEFAULT 1,
      offline_operation_id TEXT DEFAULT ''
    );

    -- Google Drive Backup & Sync Configuration
    CREATE TABLE IF NOT EXISTS drive_config (
      id TEXT PRIMARY KEY,
      client_id TEXT DEFAULT '',
      client_secret TEXT DEFAULT '',
      auth_token TEXT DEFAULT '',
      folder_id TEXT DEFAULT '',
      folder_name TEXT DEFAULT 'GMCSL_Society_Backups',
      sync_frequency TEXT DEFAULT 'Manual',
      auto_backup INTEGER DEFAULT 0,
      connected INTEGER DEFAULT 0,
      last_synced_at TEXT DEFAULT '',
      last_error TEXT DEFAULT '',
      updated_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS drive_files (
      id TEXT PRIMARY KEY,
      drive_file_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT DEFAULT 'application/json',
      size_bytes INTEGER DEFAULT 0,
      web_view_link TEXT DEFAULT '',
      created_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      source TEXT DEFAULT 'Google Drive',
      status TEXT DEFAULT 'Synced'
    );
  `);

  seedDefaults();
}

function seedDefaults() {
  const now = new Date().toISOString();

  // Seed default society settings without inventing legal registration numbers or fake addresses
  const existingSettings = db.prepare('SELECT id FROM society_settings WHERE id = ?').get('default');
  if (!existingSettings) {
    const defaultSettings: SocietySettings = {
      societyName: 'Garakhia Dhap Multipurpose Co-operative Society Ltd.',
      societyNameAs: 'গৰখীয়া ঢাপ বহুমুখী সমবায় সমিতি লিমিটেড',
      shortName: 'GMCSL',
      registrationDetails: '',
      address: 'Garakhia Dhap, Assam',
      addressAs: 'গৰখীয়া ঢাপ, অসম',
      contactPhone: '',
      officialEmail: '',
      upiId: '',
      upiQrImageUrl: '',
      showUpiQr: true,
      onlinePaymentEnabled: true,
      paymentInstructions: 'Scan the official Society UPI QR or pay via UPI app, then enter the exact 12-digit UTR / Transaction ID and upload your payment screenshot for verification.',
      paymentInstructionsAs: 'অফিচিয়েল সমিতিৰ UPI QR স্কেন কৰি বা UPI এপৰ জৰিয়তে পৰিশোধ কৰক, তাৰ পিছত সঠিক লেনদেন আইডি (Transaction ID) দিয়ক আৰু পৰীক্ষণৰ বাবে স্ক্ৰীণশ্বট আপলোড কৰক।',
      bankDetails: '',
      financialYear: '2026-2027',
      currencySymbol: '₹',
      dateFormat: 'YYYY-MM-DD',
      defaultLanguage: 'en',
      logoUrl: '/icon.svg',
      dashboardBannerUrl: '',
      officialSignatureUrl: '',
      presidentSignatureUrl: '',
      secretarySignatureUrl: '',
      receiptPrefix: 'GMCSL-REC',
      memberIdPrefix: 'GMCSL-M',
      loanNumberPrefix: 'GMCSL-LN',
      homepageHeroTitle: 'Garakhia Dhap Multipurpose Co-operative Society Ltd.',
      homepageHeroTitleAs: 'গৰখীয়া ঢাপ বহুমুখী সমবায় সমিতি লিমিটেড',
      homepageHeroSubtitle: 'Transparent Cooperative Savings, Member Credit, and Community Prosperity — Accessible Online and Offline.',
      homepageHeroSubtitleAs: 'স্বচ্ছ সমবায় সঞ্চয়, সদস্য ঋণ আৰু সামূহিক সমৃদ্ধি — অনলাইন আৰু অফলাইন দুয়োটা মাধ্যমতে উপলব্ধ।',
      homepageIntro: 'GMCSL serves members with disciplined monthly savings, community share capital, fair agricultural and enterprise credit, and transparent financial record-keeping.',
      homepageIntroAs: 'GMCSL-এ নিয়মীয়া মাহিলী সঞ্চয়, অংশ মূলধন, কৃষি আৰু ব্যৱসায়িক ঋণ তথা স্বচ্ছ হিচাপ-নিকাচৰ জৰিয়তে সদস্যসকলক সেৱা আগবঢ়ায়।',
      announcementTicker: 'Welcome to GMCSL Society Management System. Members can check savings, loans, and submit payments online or queue offline.',
      announcementTickerAs: 'GMCSL সমিতি ব্যৱস্থাপনা প্ৰণালীলৈ স্বাগতম। সদস্যসকলে অনলাইন বা অফলাইনত সঞ্চয়, ঋণ আৰু পৰিশোধৰ তথ্য চাব পাৰিব।',
      showPhotoGallery: true,
      showVideoGallery: true,
      showDocumentsSection: true,
      themePrimary: '#087443',
      themeSecondary: '#142D4E',
      themeAccent: '#D5A642',
      themeSidebar: '#142D4E',
      themeHeader: '#FFFFFF',
      themeMode: 'light',
      buttonStyle: 'rounded',
      cardStyle: 'bordered',
      allowOfflineSystemSettings: false,
      autoIdEditableRoles: { President: false, Secretary: false, Member: false },
      dashboardDrilldownRoles: { President: true, Secretary: true, Member: true },
      firebaseConfig: null,
      updatedAt: now,
    };

    db.prepare('INSERT INTO society_settings (id, data, updated_at) VALUES (?, ?, ?)').run(
      'default',
      JSON.stringify(defaultSettings),
      now
    );
  }

  // Seed sheets config
  const existingSheetsCfg = db.prepare('SELECT id FROM sheets_config WHERE id = ?').get('default');
  if (!existingSheetsCfg) {
    const mode =
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY && process.env.GOOGLE_SPREADSHEET_ID
        ? 'service_account'
        : process.env.GOOGLE_APPS_SCRIPT_URL
          ? 'apps_script'
          : 'not_configured';
    db.prepare(
      `INSERT INTO sheets_config (id, mode, spreadsheet_id, apps_script_url, apps_script_secret, service_account_email, connected)
       VALUES (?, ?, ?, ?, ?, ?, 0)`
    ).run(
      'default',
      mode,
      process.env.GOOGLE_SPREADSHEET_ID || '',
      process.env.GOOGLE_APPS_SCRIPT_URL || '',
      process.env.GOOGLE_APPS_SCRIPT_SECRET || '',
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || ''
    );
  }

  // Seed default permissions if empty
  const permCount = db.prepare('SELECT COUNT(*) as c FROM role_permissions').get() as { c: number };
  if (permCount.c === 0) {
    const insertPerm = db.prepare(
      `INSERT INTO role_permissions (id, role, module_key, can_view, can_add, can_edit, can_delete, is_hidden, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const roles: Array<Exclude<UserRole, 'System'>> = ['President', 'Secretary', 'Member'];
    for (const role of roles) {
      for (const mod of ALL_MODULES) {
        let canView = 1;
        let canAdd = 0;
        let canEdit = 0;
        let canDelete = 0;
        let isHidden = 0;

        if (role === 'President') {
          canView = 1;
          canAdd = ['member_register', 'saving_register', 'loan_register', 'loan_repayment', 'cash_book', 'share_register', 'attendance', 'meetings', 'notices', 'id_certificates'].includes(mod) ? 1 : 0;
          canEdit = ['loan_application', 'loan_register', 'online_payment', 'notices', 'meetings'].includes(mod) ? 1 : 0;
          canDelete = 0;
        } else if (role === 'Secretary') {
          canView = 1;
          canAdd = ['member_register', 'saving_register', 'loan_register', 'loan_repayment', 'cash_book', 'share_register', 'attendance', 'meetings', 'notices', 'id_certificates'].includes(mod) ? 1 : 0;
          canEdit = ['member_register', 'saving_register', 'loan_application', 'attendance', 'meetings', 'online_payment', 'notices'].includes(mod) ? 1 : 0;
          canDelete = 0;
        } else if (role === 'Member') {
          if (mod === 'cash_book' || mod === 'media_manager') {
            canView = mod === 'media_manager' ? 1 : 0;
            isHidden = mod === 'cash_book' ? 1 : 0;
          } else if (mod === 'loan_application' || mod === 'online_payment') {
            canView = 1;
            canAdd = 1;
          } else {
            canView = 1;
          }
        }

        insertPerm.run(
          `${role}_${mod}`,
          role,
          mod,
          canView,
          canAdd,
          canEdit,
          canDelete,
          isHidden,
          'SYSTEM_INIT',
          now
        );
      }
    }
  } else {
    // Idempotently ensure new modules (like loan_repayment) exist on upgraded databases
    const insertIgnorePerm = db.prepare(
      `INSERT OR IGNORE INTO role_permissions (id, role, module_key, can_view, can_add, can_edit, can_delete, is_hidden, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const roles: Array<Exclude<UserRole, 'System'>> = ['President', 'Secretary', 'Member'];
    for (const role of roles) {
      const isOfficer = role === 'President' || role === 'Secretary';
      insertIgnorePerm.run(
        `${role}_loan_repayment`,
        role,
        'loan_repayment',
        1,
        isOfficer ? 1 : 0,
        0,
        0,
        0,
        'SYSTEM_UPGRADE',
        now
      );
    }
  }

  // Ensure default drive_config row exists
  const existingDriveCfg = db.prepare('SELECT id FROM drive_config WHERE id = ?').get('default');
  if (!existingDriveCfg) {
    db.prepare(
      `INSERT INTO drive_config (id, folder_name, sync_frequency, auto_backup, connected, updated_at)
       VALUES ('default', 'GMCSL_Society_Backups', 'Manual', 0, 0, ?)`
    ).run(now);
  }

  // Auto-provision System Administrator account on database initialization
  const targetEmail = (process.env.INITIAL_SYSTEM_EMAIL || 'kamalbiswas9391@gmail.com').trim().toLowerCase();
  const targetMobile = (process.env.INITIAL_SYSTEM_MOBILE || '9101766401').replace(/\s+/g, '').replace(/^\+91/, '');
  const passwordHash = process.env.INITIAL_SYSTEM_PASSWORD
    ? bcrypt.hashSync(process.env.INITIAL_SYSTEM_PASSWORD, 12)
    : DEFAULT_SYSTEM_PASSWORD_HASH;

  const sysUser = db.prepare("SELECT * FROM system_users WHERE role = 'System'").get() as any;
  if (!sysUser) {
    db.prepare(
      `INSERT INTO system_users (id, user_id, role, full_name, email, mobile_number, password_hash, account_status, must_change_password, created_at, updated_at)
       VALUES (?, ?, 'System', ?, ?, ?, ?, 'Active', 0, ?, ?)`
    ).run(
      'USR-SYS-001',
      'SYS-001',
      'System Administrator',
      targetEmail,
      targetMobile,
      passwordHash,
      now,
      now
    );
  } else if (sysUser.email === 'admin@gmcsl.local' || !sysUser.mobile_number) {
    db.prepare(
      `UPDATE system_users SET email = ?, mobile_number = ?, account_status = 'Active', is_locked = 0, updated_at = ? WHERE id = ?`
    ).run(targetEmail, targetMobile, now, sysUser.id);
  }

  dbInitialized = true;
}

export function getSocietySettings(): SocietySettings {
  const row = db.prepare('SELECT data FROM society_settings WHERE id = ?').get('default') as { data: string };
  const parsed = JSON.parse(row.data) as SocietySettings;
  return {
    ...parsed,
    autoIdEditableRoles: parsed.autoIdEditableRoles || { President: false, Secretary: false, Member: false },
    dashboardDrilldownRoles: parsed.dashboardDrilldownRoles || { President: true, Secretary: true, Member: true },
  };
}

export function getRolePermissions(role?: UserRole): RolePermission[] {
  const rows = role && role !== 'System'
    ? (db.prepare('SELECT * FROM role_permissions WHERE role = ?').all(role) as any[])
    : (db.prepare('SELECT * FROM role_permissions').all() as any[]);
  return rows.map((r) => ({
    id: r.id,
    role: r.role,
    moduleKey: r.module_key,
    canView: Boolean(r.can_view),
    canAdd: Boolean(r.can_add),
    canEdit: Boolean(r.can_edit),
    canDelete: Boolean(r.can_delete),
    isHidden: Boolean(r.is_hidden),
    updatedBy: r.updated_by,
    updatedAt: r.updated_at,
  }));
}

export function writeAuditLog(entry: {
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: string;
  recordId: string;
  previousValue?: unknown;
  updatedValue?: unknown;
  sessionInfo?: string;
}) {
  const id = `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO audit_logs (id, audit_id, user_id, user_name, user_role, action, module, record_id, previous_value, updated_value, timestamp, session_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    id,
    entry.userId,
    entry.userName,
    entry.userRole,
    entry.action,
    entry.module,
    entry.recordId,
    entry.previousValue ? JSON.stringify(entry.previousValue) : '',
    entry.updatedValue ? JSON.stringify(entry.updatedValue) : '',
    now,
    entry.sessionInfo || 'web-session'
  );
}

export function createNotification(entry: {
  targetRole: 'Everyone' | UserRole;
  targetMemberId?: string;
  type: string;
  title: string;
  message: string;
  relatedId?: string;
}) {
  const id = `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  db.prepare(
    `INSERT INTO notifications (id, notification_id, target_role, target_member_id, type, title, message, is_read, created_at, related_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
  ).run(
    id,
    id,
    entry.targetRole,
    entry.targetMemberId || '',
    entry.type,
    entry.title,
    entry.message,
    new Date().toISOString(),
    entry.relatedId || ''
  );
}
