import crypto from 'crypto';
import express from 'express';
import {
  createNotification,
  db,
  getRolePermissions,
  getSocietySettings,
  initDatabase,
  writeAuditLog,
} from './db.ts';
import {
  type AuthenticatedRequest,
  checkLockout,
  hashSecret,
  hasModulePermission,
  issueSessionToken,
  mapUserRow,
  recordFailedAttempt,
  requireAuth,
  requirePermission,
  requireRole,
  verifySecret,
} from './auth.ts';
import {
  calculateLoanBalance,
  calculateSavingTotals,
  calculateShareTotal,
  getCurrentCashAndBankBalances,
  postFinancialLedger,
  roundMoney,
  validateCashBookEntry,
} from './finance.ts';
import {
  mapAttendance,
  mapAudit,
  mapBackup,
  mapCashBook,
  mapCertificate,
  mapLoan,
  mapLoanApplication,
  mapLoanRepayment,
  mapMedia,
  mapMeeting,
  mapMember,
  mapNotice,
  mapNotification,
  mapOnlinePayment,
  mapReceipt,
  mapSaving,
  mapSession,
  mapShare,
} from './mappers.ts';
import {
  APPS_SCRIPT_TEMPLATE,
  ensureAllGoogleSheets,
  getSheetsStatus,
  syncAllToGoogleSheets,
  testGoogleSheetsConnection,
  updateSheetsConfig,
} from './sheetsSync.ts';
import {
  deleteDriveFile,
  getDriveStatus,
  refreshDriveFiles,
  syncBackupToGoogleDrive,
  updateDriveConfig,
} from './driveSync.ts';
import type { DashboardStats, PendingSyncOperation, SocietySettings, UserRole } from '../src/types.ts';

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

function resolveEditableAutoId(
  providedId: unknown,
  fallbackId: string,
  auth: NonNullable<AuthenticatedRequest['auth']>,
  settings: SocietySettings
): string {
  const clean = typeof providedId === 'string' ? providedId.trim() : '';
  if (!clean) return fallbackId;
  const canEditIds =
    auth.role === 'System' ||
    Boolean(settings.autoIdEditableRoles?.[auth.role as 'President' | 'Secretary' | 'Member']);
  return canEditIds ? clean : fallbackId;
}

export function createApiRouter() {
  initDatabase();
  const router = express.Router();

  // Health check
  router.get('/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // Public Homepage Data (Zero private financial information!)
  router.get('/public/home', (_req, res) => {
    const settings = getSocietySettings();
    const notices = (db
      .prepare("SELECT * FROM notices WHERE is_published = 1 AND (target_role = 'Everyone' OR target_role = 'Member') ORDER BY publish_date DESC")
      .all() as any[]).map(mapNotice);
    const media = (db
      .prepare("SELECT * FROM media_items WHERE visibility = 'Everyone' ORDER BY created_at DESC")
      .all() as any[]).map(mapMedia);

    const sysCount = (db.prepare("SELECT COUNT(*) as c FROM system_users WHERE role = 'System'").get() as { c: number }).c;

    res.json({
      settings,
      notices,
      media,
      systemInitialized: sysCount > 0,
    });
  });

  // Check system setup status
  router.get('/auth/status', (_req, res) => {
    const sysCount = (db.prepare("SELECT COUNT(*) as c FROM system_users WHERE role = 'System'").get() as { c: number }).c;
    res.json({ systemInitialized: sysCount > 0 });
  });

  // First-Time System Administrator Provisioning (only works when 0 System users exist)
  router.post('/auth/setup-system', (req, res) => {
    const existing = db.prepare("SELECT id FROM system_users WHERE role = 'System'").get();
    if (existing) {
      return res.status(409).json({ error: 'System administrator is already provisioned. Use System Login.' });
    }
    const { fullName, email, mobileNumber, password } = req.body || {};
    if (!email && !mobileNumber) {
      return res.status(400).json({ error: 'System Email or Mobile Number is required.' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'System Password must be at least 6 characters.' });
    }
    const now = new Date().toISOString();
    const userId = 'SYS-001';
    const id = 'USR-SYS-001';
    db.prepare(
      `INSERT INTO system_users (id, user_id, role, full_name, email, mobile_number, password_hash, account_status, must_change_password, created_at, updated_at)
       VALUES (?, ?, 'System', ?, ?, ?, ?, 'Active', 0, ?, ?)`
    ).run(
      id,
      userId,
      String(fullName || 'System Administrator').trim(),
      String(email || '').trim().toLowerCase(),
      String(mobileNumber || '').trim(),
      hashSecret(String(password)),
      now,
      now
    );

    const userRow = db.prepare('SELECT * FROM system_users WHERE id = ?').get(id);
    const session = issueSessionToken(userRow, req.headers['user-agent'] || 'web');
    writeAuditLog({
      userId,
      userName: String(fullName || 'System Administrator'),
      userRole: 'System',
      action: 'SYSTEM_FIRST_TIME_PROVISION',
      module: 'Authentication',
      recordId: userId,
      sessionInfo: session.sessionId,
    });
    res.status(201).json({ ...session, memberProfile: null });
  });

  // Login endpoint for all 4 roles
  router.post('/auth/login', (req, res) => {
    const { role, identifier, secret } = req.body || {};
    const validRoles: UserRole[] = ['System', 'President', 'Secretary', 'Member'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid login role specified.' });
    }
    const cleanId = String(identifier || '').trim();
    const normalizedMobile = cleanId.replace(/\s+/g, '').replace(/^\+91/, '');
    const cleanSecret = String(secret || '');
    if (!cleanId || !cleanSecret) {
      return res.status(400).json({ error: 'Credentials are required.' });
    }

    let userRow: any;
    if (role === 'System') {
      userRow = db
        .prepare(
          "SELECT * FROM system_users WHERE role = 'System' AND (LOWER(email) = LOWER(?) OR mobile_number = ? OR mobile_number = ?)"
        )
        .get(cleanId, cleanId, normalizedMobile);
    } else {
      userRow = db
        .prepare('SELECT * FROM system_users WHERE role = ? AND (mobile_number = ? OR mobile_number = ?)')
        .get(role, cleanId, normalizedMobile);
    }

    if (!userRow) {
      return res.status(401).json({ error: `No ${role} account found for these credentials.` });
    }

    if (userRow.account_status !== 'Active') {
      return res.status(403).json({ error: 'This account is currently inactive.' });
    }

    const lockCheck = checkLockout(userRow);
    if (lockCheck.locked) {
      return res.status(423).json({ error: lockCheck.message });
    }

    const hashToCheck = role === 'System' ? userRow.password_hash : userRow.pin_hash;
    if (!verifySecret(cleanSecret, hashToCheck)) {
      recordFailedAttempt(userRow, req.headers['user-agent'] || 'web');
      return res.status(401).json({ error: role === 'System' ? 'Invalid System password.' : 'Invalid 4-digit PIN.' });
    }

    const session = issueSessionToken(userRow, req.headers['user-agent'] || 'web');
    let memberProfile = null;
    if (userRow.member_id) {
      const mRow = db.prepare('SELECT * FROM members WHERE member_id = ?').get(userRow.member_id);
      if (mRow) memberProfile = mapMember(mRow, role, userRow.member_id);
    }

    writeAuditLog({
      userId: userRow.user_id,
      userName: userRow.full_name,
      userRole: role,
      action: 'LOGIN_SUCCESS',
      module: 'Authentication',
      recordId: userRow.user_id,
      sessionInfo: session.sessionId,
    });

    res.json({ ...session, memberProfile });
  });

  router.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    db.prepare('UPDATE session_logs SET is_active = 0 WHERE session_id = ?').run(auth.sessionId);
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'LOGOUT',
      module: 'Authentication',
      recordId: auth.userId,
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true });
  });

  router.post('/auth/change-credentials', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { currentSecret, newSecret, newMobile, newEmail } = req.body || {};
    const userRow = db.prepare('SELECT * FROM system_users WHERE user_id = ?').get(auth.userId) as any;
    if (!userRow) return res.status(404).json({ error: 'User not found.' });

    const existingHash = auth.role === 'System' ? userRow.password_hash : userRow.pin_hash;
    if (!verifySecret(String(currentSecret || ''), existingHash)) {
      return res.status(401).json({ error: 'Current password/PIN is incorrect.' });
    }

    const now = new Date().toISOString();
    if (auth.role === 'System') {
      const nextHash = newSecret ? hashSecret(String(newSecret)) : userRow.password_hash;
      const nextMobile = newMobile !== undefined ? String(newMobile).trim() : userRow.mobile_number;
      const nextEmail = newEmail !== undefined ? String(newEmail).trim().toLowerCase() : userRow.email;
      db.prepare(
        'UPDATE system_users SET password_hash = ?, mobile_number = ?, email = ?, must_change_password = 0, updated_at = ? WHERE user_id = ?'
      ).run(nextHash, nextMobile, nextEmail, now, auth.userId);
    } else {
      if (!newSecret || !/^\d{4}$/.test(String(newSecret))) {
        return res.status(400).json({ error: 'New PIN must be exactly 4 digits.' });
      }
      const nextHash = hashSecret(String(newSecret));
      db.prepare('UPDATE system_users SET pin_hash = ?, updated_at = ? WHERE user_id = ?').run(nextHash, now, auth.userId);
      if (userRow.member_id) {
        db.prepare('UPDATE members SET member_pin_hash = ?, updated_date = ? WHERE member_id = ?').run(nextHash, now, userRow.member_id);
      }
    }

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'CREDENTIALS_CHANGED',
      module: 'Security',
      recordId: auth.userId,
      sessionInfo: auth.sessionId,
    });
    const updated = db.prepare('SELECT * FROM system_users WHERE user_id = ?').get(auth.userId);
    res.json({ ok: true, user: mapUserRow(updated) });
  });

  // Full Authorized Dataset Sync Pull (Bootstrap & Refresh for IndexedDB)
  router.get('/sync/pull', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const isMember = auth.role === 'Member';
    const mid = auth.memberId;

    const settings = getSocietySettings();
    const permissions = getRolePermissions();
    const canView = (mod: any) => hasModulePermission(auth.role, mod, 'view');

    const members = canView('member_register')
      ? (isMember
          ? (db.prepare('SELECT * FROM members WHERE member_id = ?').all(mid) as any[])
          : (db.prepare('SELECT * FROM members ORDER BY created_date DESC').all() as any[])
        ).map((r) => mapMember(r, auth.role, mid))
      : [];

    const savings = canView('saving_register')
      ? (isMember
          ? (db.prepare('SELECT * FROM savings WHERE member_id = ? ORDER BY date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM savings ORDER BY date DESC').all() as any[])
        ).map(mapSaving)
      : [];

    const shares = canView('share_register')
      ? (isMember
          ? (db.prepare('SELECT * FROM shares WHERE member_id = ? ORDER BY date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM shares ORDER BY date DESC').all() as any[])
        ).map(mapShare)
      : [];

    const loans = canView('loan_register')
      ? (isMember
          ? (db.prepare('SELECT * FROM loans WHERE member_id = ? ORDER BY loan_date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM loans ORDER BY loan_date DESC').all() as any[])
        ).map(mapLoan)
      : [];

    const loanRepayments = canView('loan_repayment')
      ? (isMember
          ? (db.prepare('SELECT * FROM loan_repayments WHERE member_id = ? ORDER BY date DESC, created_date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM loan_repayments ORDER BY date DESC, created_date DESC').all() as any[])
        ).map(mapLoanRepayment)
      : [];

    const cashBook = canView('cash_book') && !isMember
      ? (db.prepare('SELECT * FROM cash_book ORDER BY date DESC').all() as any[]).map(mapCashBook)
      : [];

    const attendance = canView('attendance')
      ? (isMember
          ? (db.prepare('SELECT * FROM attendance WHERE member_id = ? ORDER BY date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM attendance ORDER BY date DESC').all() as any[])
        ).map(mapAttendance)
      : [];

    const loanApplications = canView('loan_application')
      ? (isMember
          ? (db.prepare('SELECT * FROM loan_applications WHERE member_id = ? ORDER BY application_date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM loan_applications ORDER BY application_date DESC').all() as any[])
        ).map(mapLoanApplication)
      : [];

    const onlinePayments = canView('online_payment')
      ? (isMember
          ? (db.prepare('SELECT * FROM online_payments WHERE member_id = ? ORDER BY date DESC').all(mid) as any[])
          : (db.prepare('SELECT * FROM online_payments ORDER BY date DESC').all() as any[])
        ).map(mapOnlinePayment)
      : [];

    const meetings = canView('meetings')
      ? (db.prepare('SELECT * FROM meetings ORDER BY meeting_date DESC').all() as any[]).map(mapMeeting)
      : [];

    const notices = (db
      .prepare(
        auth.role === 'System'
          ? 'SELECT * FROM notices ORDER BY publish_date DESC'
          : "SELECT * FROM notices WHERE is_published = 1 AND (target_role = 'Everyone' OR target_role = ?) ORDER BY publish_date DESC"
      )
      .all(...(auth.role === 'System' ? [] : [auth.role])) as any[]).map(mapNotice);

    const notifications = (db
      .prepare(
        isMember
          ? "SELECT * FROM notifications WHERE (target_role = 'Everyone' OR (target_role = 'Member' AND (target_member_id = '' OR target_member_id = ?))) ORDER BY created_at DESC LIMIT 100"
          : auth.role === 'System'
            ? 'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 150'
            : "SELECT * FROM notifications WHERE (target_role = 'Everyone' OR target_role = ?) ORDER BY created_at DESC LIMIT 100"
      )
      .all(...(isMember ? [mid] : auth.role === 'System' ? [] : [auth.role])) as any[]).map(mapNotification);

    const receipts = (isMember
      ? (db.prepare('SELECT * FROM receipts WHERE member_id = ? ORDER BY created_at DESC').all(mid) as any[])
      : (db.prepare('SELECT * FROM receipts ORDER BY created_at DESC').all() as any[])
    ).map(mapReceipt);

    const certificates = (isMember
      ? (db.prepare('SELECT * FROM certificates WHERE member_id = ? ORDER BY issue_date DESC').all(mid) as any[])
      : (db.prepare('SELECT * FROM certificates ORDER BY issue_date DESC').all() as any[])
    ).map(mapCertificate);

    const media = (db
      .prepare(
        auth.role === 'System'
          ? 'SELECT * FROM media_items ORDER BY created_at DESC'
          : "SELECT * FROM media_items WHERE visibility = 'Everyone' OR visibility = ? ORDER BY created_at DESC"
      )
      .all(...(auth.role === 'System' ? [] : [auth.role])) as any[]).map(mapMedia);

    const systemUsers = auth.role === 'System'
      ? (db.prepare('SELECT * FROM system_users ORDER BY created_at DESC').all() as any[]).map(mapUserRow)
      : [];

    const stats = computeDashboardStats(isMember ? mid : undefined);

    res.json({
      syncedAt: new Date().toISOString(),
      settings,
      permissions,
      stats,
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
    });
  });

  // Dashboard Stats
  router.get('/dashboard/stats', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const stats = computeDashboardStats(auth.role === 'Member' ? auth.memberId : undefined);
    res.json(stats);
  });

  // System Users & Member PIN Management
  router.get('/users', requireAuth, requireRole(['System']), (_req, res) => {
    const rows = db.prepare('SELECT * FROM system_users ORDER BY created_at DESC').all() as any[];
    res.json(rows.map(mapUserRow));
  });

  router.post('/users/officer', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { role, fullName, mobileNumber, email, pin, accountStatus } = req.body || {};
    if (role !== 'President' && role !== 'Secretary') {
      return res.status(400).json({ error: 'Role must be President or Secretary.' });
    }
    if (!fullName || !mobileNumber || !/^\d{4}$/.test(String(pin || ''))) {
      return res.status(400).json({ error: 'Full Name, Mobile Number, and 4-digit PIN are required.' });
    }
    const existing = db.prepare('SELECT id FROM system_users WHERE role = ? AND mobile_number = ?').get(role, String(mobileNumber).trim());
    if (existing) {
      return res.status(409).json({ error: `A ${role} account with this mobile number already exists.` });
    }
    const now = new Date().toISOString();
    const userId = genId(role === 'President' ? 'PRES' : 'SEC');
    db.prepare(
      `INSERT INTO system_users (id, user_id, role, full_name, email, mobile_number, pin_hash, account_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      userId,
      role,
      String(fullName).trim(),
      String(email || '').trim().toLowerCase(),
      String(mobileNumber).trim(),
      hashSecret(String(pin)),
      accountStatus === 'Inactive' ? 'Inactive' : 'Active',
      now,
      now
    );
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'CREATE_OFFICER_ACCOUNT',
      module: 'SystemUsers',
      recordId: userId,
      updatedValue: { role, fullName, mobileNumber },
      sessionInfo: auth.sessionId,
    });
    res.status(201).json(mapUserRow(db.prepare('SELECT * FROM system_users WHERE id = ?').get(userId)));
  });

  router.post('/users/member-access', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { memberId, pin, action, mobileNumber } = req.body || {};
    const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId) as any;
    if (!member) return res.status(404).json({ error: 'Member not found.' });

    const now = new Date().toISOString();
    let userRow = db.prepare("SELECT * FROM system_users WHERE member_id = ? AND role = 'Member'").get(memberId) as any;

    if (mobileNumber) {
      db.prepare('UPDATE members SET mobile_number = ?, updated_date = ?, updated_by = ? WHERE member_id = ?').run(
        String(mobileNumber).trim(),
        now,
        auth.fullName,
        memberId
      );
    }

    const activeMobile = String(mobileNumber || member.mobile_number).trim();

    if (action === 'set_pin' || !userRow) {
      if (!/^\d{4}$/.test(String(pin || ''))) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
      }
      const pinHash = hashSecret(String(pin));
      db.prepare('UPDATE members SET member_pin_hash = ?, updated_date = ?, updated_by = ? WHERE member_id = ?').run(
        pinHash,
        now,
        auth.fullName,
        memberId
      );
      if (!userRow) {
        const uid = genId('USR-M');
        db.prepare(
          `INSERT INTO system_users (id, user_id, role, member_id, full_name, email, mobile_number, pin_hash, account_status, created_at, updated_at)
           VALUES (?, ?, 'Member', ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(uid, uid, memberId, member.member_name, member.gmail_id || '', activeMobile, pinHash, member.account_status, now, now);
      } else {
        db.prepare('UPDATE system_users SET pin_hash = ?, mobile_number = ?, updated_at = ? WHERE id = ?').run(
          pinHash,
          activeMobile,
          now,
          userRow.id
        );
      }
    } else if (action === 'activate') {
      db.prepare("UPDATE members SET account_status = 'Active', is_locked = 0, updated_date = ? WHERE member_id = ?").run(now, memberId);
      db.prepare("UPDATE system_users SET account_status = 'Active', is_locked = 0, failed_attempts = 0, locked_until = '', updated_at = ? WHERE id = ?").run(now, userRow.id);
    } else if (action === 'deactivate') {
      db.prepare("UPDATE members SET account_status = 'Inactive', updated_date = ? WHERE member_id = ?").run(now, memberId);
      db.prepare("UPDATE system_users SET account_status = 'Inactive', updated_at = ? WHERE id = ?").run(now, userRow.id);
    } else if (action === 'lock') {
      db.prepare('UPDATE members SET is_locked = 1, updated_date = ? WHERE member_id = ?').run(now, memberId);
      db.prepare('UPDATE system_users SET is_locked = 1, updated_at = ? WHERE id = ?').run(now, userRow.id);
      db.prepare('UPDATE session_logs SET is_active = 0 WHERE user_id = ?').run(userRow.user_id);
    } else if (action === 'unlock') {
      db.prepare('UPDATE members SET is_locked = 0, updated_date = ? WHERE member_id = ?').run(now, memberId);
      db.prepare("UPDATE system_users SET is_locked = 0, failed_attempts = 0, locked_until = '', updated_at = ? WHERE id = ?").run(now, userRow.id);
    }

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: `MEMBER_ACCESS_${String(action || 'UPDATE').toUpperCase()}`,
      module: 'MemberAccess',
      recordId: memberId,
      sessionInfo: auth.sessionId,
    });

    const updatedUser = db.prepare("SELECT * FROM system_users WHERE member_id = ? AND role = 'Member'").get(memberId);
    res.json({ ok: true, user: updatedUser ? mapUserRow(updatedUser) : null });
  });

  // Toggle status / lock / reset PIN for any system user (President/Secretary/Member)
  router.post('/users/:userId/action', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { userId } = req.params;
    const { action, pin } = req.body || {};
    const target = db.prepare('SELECT * FROM system_users WHERE user_id = ?').get(userId) as any;
    if (!target) return res.status(404).json({ error: 'User not found.' });
    const now = new Date().toISOString();

    if (action === 'activate') {
      db.prepare("UPDATE system_users SET account_status = 'Active', is_locked = 0, updated_at = ? WHERE user_id = ?").run(now, userId);
    } else if (action === 'deactivate') {
      db.prepare("UPDATE system_users SET account_status = 'Inactive', updated_at = ? WHERE user_id = ?").run(now, userId);
    } else if (action === 'lock') {
      db.prepare('UPDATE system_users SET is_locked = 1, updated_at = ? WHERE user_id = ?').run(now, userId);
      db.prepare('UPDATE session_logs SET is_active = 0 WHERE user_id = ?').run(userId);
    } else if (action === 'unlock') {
      db.prepare("UPDATE system_users SET is_locked = 0, failed_attempts = 0, locked_until = '', updated_at = ? WHERE user_id = ?").run(now, userId);
    } else if (action === 'reset_pin') {
      if (!/^\d{4}$/.test(String(pin || ''))) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits.' });
      }
      const hash = hashSecret(String(pin));
      db.prepare('UPDATE system_users SET pin_hash = ?, updated_at = ? WHERE user_id = ?').run(hash, now, userId);
      if (target.member_id) {
        db.prepare('UPDATE members SET member_pin_hash = ?, updated_date = ? WHERE member_id = ?').run(hash, now, target.member_id);
      }
    }

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: `USER_${String(action).toUpperCase()}`,
      module: 'SystemUsers',
      recordId: userId,
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true, user: mapUserRow(db.prepare('SELECT * FROM system_users WHERE user_id = ?').get(userId)) });
  });

  // Role Permissions Switchboard
  router.get('/permissions', requireAuth, (_req, res) => {
    res.json(getRolePermissions());
  });

  router.put('/permissions', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const updates = req.body?.permissions;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: 'permissions array is required.' });
    }
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `UPDATE role_permissions SET can_view = ?, can_add = ?, can_edit = ?, can_delete = ?, is_hidden = ?, updated_by = ?, updated_at = ? WHERE role = ? AND module_key = ?`
    );
    const tx = db.transaction((items: any[]) => {
      for (const item of items) {
        if (!['President', 'Secretary', 'Member'].includes(item.role)) continue;
        stmt.run(
          item.canView ? 1 : 0,
          item.canAdd ? 1 : 0,
          item.canEdit ? 1 : 0,
          item.canDelete ? 1 : 0,
          item.isHidden ? 1 : 0,
          auth.fullName,
          now,
          item.role,
          item.moduleKey
        );
      }
    });
    tx(updates);
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'PERMISSIONS_UPDATED',
      module: 'RolePermissions',
      recordId: 'GLOBAL',
      updatedValue: updates,
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true, permissions: getRolePermissions() });
  });

  // Society Settings & Branding & QR Manager
  router.get('/settings', requireAuth, (_req, res) => {
    res.json(getSocietySettings());
  });

  router.put('/settings', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const current = getSocietySettings();
    const next: SocietySettings = {
      ...current,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };
    db.prepare('UPDATE society_settings SET data = ?, updated_at = ? WHERE id = ?').run(
      JSON.stringify(next),
      next.updatedAt,
      'default'
    );
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'UPDATE_SOCIETY_SETTINGS',
      module: 'SocietySettings',
      recordId: 'default',
      sessionInfo: auth.sessionId,
    });
    res.json(next);
  });

  // Member Register CRUD
  router.get('/members', requireAuth, requirePermission('member_register', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM members WHERE member_id = ?').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM members ORDER BY created_date DESC').all() as any[]);
    res.json(rows.map((r) => mapMember(r, auth.role, auth.memberId)));
  });

  router.post('/members', requireAuth, requirePermission('member_register', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const created = insertMemberRecord(req.body, auth);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/members/:memberId', requireAuth, requirePermission('member_register', 'edit'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { memberId } = req.params;
    if (auth.role === 'Member' && auth.memberId !== memberId) {
      return res.status(403).json({ error: 'Members can only edit their own profile.' });
    }
    const existing = db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId) as any;
    if (!existing) return res.status(404).json({ error: 'Member not found.' });

    const now = new Date().toISOString();
    const b = req.body || {};
    db.prepare(
      `UPDATE members SET
        member_name = ?, father_name = ?, join_date = ?, date_of_birth = ?, aadhaar_number = ?,
        pan_number = ?, voter_id = ?, bank_account_number = ?, ifsc_code = ?, branch_name = ?,
        mobile_number = ?, gmail_id = ?, state = ?, district = ?, development_block = ?,
        village = ?, post_office = ?, pin_code = ?, panchayat = ?, photo_url = ?, signature_url = ?,
        account_status = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1
       WHERE member_id = ?`
    ).run(
      b.memberName ?? existing.member_name,
      b.fatherName ?? existing.father_name,
      b.joinDate ?? existing.join_date,
      b.dateOfBirth ?? existing.date_of_birth,
      b.aadhaarNumber ?? existing.aadhaar_number,
      b.panNumber ?? existing.pan_number,
      b.voterId ?? existing.voter_id,
      b.bankAccountNumber ?? existing.bank_account_number,
      b.ifscCode ?? existing.ifsc_code,
      b.branchName ?? existing.branch_name,
      b.mobileNumber ?? existing.mobile_number,
      b.gmailId ?? existing.gmail_id,
      b.state ?? existing.state,
      b.district ?? existing.district,
      b.developmentBlock ?? existing.development_block,
      b.village ?? existing.village,
      b.postOffice ?? existing.post_office,
      b.pinCode ?? existing.pin_code,
      b.panchayat ?? existing.panchayat,
      b.photoUrl ?? existing.photo_url,
      b.signatureUrl ?? existing.signature_url,
      auth.role === 'Member' ? existing.account_status : (b.accountStatus ?? existing.account_status),
      now,
      auth.fullName,
      memberId
    );

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'UPDATE_MEMBER',
      module: 'MemberRegister',
      recordId: memberId,
      sessionInfo: auth.sessionId,
    });
    const updated = db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId);
    res.json(mapMember(updated, auth.role, auth.memberId));
  });

  router.delete('/members/:memberId', requireAuth, requirePermission('member_register', 'delete'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { memberId } = req.params;
    db.prepare("UPDATE members SET account_status = 'Inactive', updated_date = ?, updated_by = ? WHERE member_id = ?").run(
      new Date().toISOString(),
      auth.fullName,
      memberId
    );
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'DEACTIVATE_MEMBER',
      module: 'MemberRegister',
      recordId: memberId,
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true });
  });

  // Saving Register CRUD + Financial Integrity
  router.get('/savings', requireAuth, requirePermission('saving_register', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM savings WHERE member_id = ? ORDER BY date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM savings ORDER BY date DESC').all() as any[]);
    res.json(rows.map(mapSaving));
  });

  router.post('/savings', requireAuth, requirePermission('saving_register', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const record = insertSavingRecord(req.body, auth);
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Share Register
  router.get('/shares', requireAuth, requirePermission('share_register', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM shares WHERE member_id = ? ORDER BY date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM shares ORDER BY date DESC').all() as any[]);
    res.json(rows.map(mapShare));
  });

  router.post('/shares', requireAuth, requirePermission('share_register', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const record = insertShareRecord(req.body, auth);
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Loan Register (Disbursements & Repayments)
  router.get('/loans', requireAuth, requirePermission('loan_register', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM loans WHERE member_id = ? ORDER BY loan_date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM loans ORDER BY loan_date DESC').all() as any[]);
    res.json(rows.map(mapLoan));
  });

  router.post('/loans', requireAuth, requirePermission('loan_register', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const record = insertLoanRecord(req.body, auth);
      res.status(201).json(record);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/loans/:loanId/repay', requireAuth, requirePermission('loan_register', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { loanId } = req.params;
    try {
      const existing = db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(loanId) as any;
      if (!existing) return res.status(404).json({ error: 'Loan record not found.' });

      const principalPaid = roundMoney(Number(req.body.repaymentAmount || 0));
      const interestPaid = roundMoney(Number(req.body.interest || 0));
      const finePaid = roundMoney(Number(req.body.fine || 0));
      if (principalPaid < 0 || interestPaid < 0 || finePaid < 0 || principalPaid + interestPaid + finePaid <= 0) {
        return res.status(400).json({ error: 'Enter a valid positive repayment, interest, or fine amount.' });
      }
      if (principalPaid > Number(existing.current_loan_balance)) {
        return res.status(400).json({ error: 'Principal repayment exceeds current loan balance.' });
      }

      const nextRepayment = roundMoney(Number(existing.loan_repayment || 0) + principalPaid);
      const nextInterest = roundMoney(Number(existing.interest || 0) + interestPaid);
      const nextFine = roundMoney(Number(existing.fine || 0) + finePaid);
      const nextBalance = roundMoney(Number(existing.current_loan_balance) - principalPaid);
      const nextStatus = nextBalance === 0 ? 'Close' : (req.body.loanStatus || existing.loan_status);
      const now = new Date().toISOString();

      db.prepare(
        `UPDATE loans SET loan_repayment = ?, interest = ?, fine = ?, current_loan_balance = ?, next_due_date = ?, payment_status = ?, loan_status = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1 WHERE loan_id = ?`
      ).run(
        nextRepayment,
        nextInterest,
        nextFine,
        nextBalance,
        req.body.nextDueDate || existing.next_due_date,
        req.body.paymentStatus || 'Cash',
        nextStatus,
        now,
        auth.fullName,
        loanId
      );

      const settings = getSocietySettings();
      const receiptNo = `${settings.receiptPrefix}-${Date.now().toString().slice(-6)}`;
      const totalCollected = roundMoney(principalPaid + interestPaid + finePaid);
      db.prepare(
        `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
         VALUES (?, ?, 'Loan Repayment', ?, ?, ?, ?, ?, ?, 'Verified', ?, ?)`
      ).run(
        receiptNo,
        receiptNo,
        existing.member_id,
        existing.member_name,
        req.body.date || now.slice(0, 10),
        totalCollected,
        req.body.paymentMethod || 'Cash',
        `Loan ${existing.loan_number}: Principal ₹${principalPaid}, Interest ₹${interestPaid}, Fine ₹${finePaid}. Remaining Balance ₹${nextBalance}`,
        auth.fullName,
        now
      );

      postFinancialLedger({
        module: 'loan_repayment',
        recordId: `${loanId}-${Date.now()}`,
        memberId: existing.member_id,
        entryType: 'LOAN_REPAYMENT',
        amount: totalCollected,
        direction: 'CREDIT',
        description: `Repayment for ${existing.loan_number}`,
        idempotencyKey: req.body.operationId || `REPAY-${loanId}-${Date.now()}`,
        createdBy: auth.fullName,
      });

      createNotification({
        targetRole: 'Member',
        targetMemberId: existing.member_id,
        type: 'Loan Repayment',
        title: 'Loan Repayment Recorded',
        message: `Repayment of ₹${totalCollected} recorded for ${existing.loan_number}. Remaining balance: ₹${nextBalance}.`,
        relatedId: loanId,
      });

      writeAuditLog({
        userId: auth.userId,
        userName: auth.fullName,
        userRole: auth.role,
        action: 'LOAN_REPAYMENT',
        module: 'LoanRegister',
        recordId: loanId,
        previousValue: { balance: existing.current_loan_balance },
        updatedValue: { principalPaid, interestPaid, finePaid, nextBalance },
        sessionInfo: auth.sessionId,
      });

      res.json({
        loan: mapLoan(db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(loanId)),
        receiptNumber: receiptNo,
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Dedicated Active-Loan Repayment Module
  router.get('/loan-repayments', requireAuth, requirePermission('loan_repayment', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM loan_repayments WHERE member_id = ? ORDER BY date DESC, created_date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM loan_repayments ORDER BY date DESC, created_date DESC').all() as any[]);
    res.json(rows.map(mapLoanRepayment));
  });

  router.post('/loan-repayments', requireAuth, requirePermission('loan_repayment', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const result = insertLoanRepaymentRecord(req.body, auth);
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/loan-repayments/:repaymentId', requireAuth, requirePermission('loan_repayment', 'edit'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const result = updateLoanRepaymentRecord(req.params.repaymentId, req.body, auth);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.delete('/loan-repayments/:repaymentId', requireAuth, requirePermission('loan_repayment', 'delete'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const result = deleteLoanRepaymentRecord(req.params.repaymentId, auth);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Cash Book Register
  router.get('/cashbook', requireAuth, requirePermission('cash_book', 'view'), (req: AuthenticatedRequest, res) => {
    if (req.auth!.role === 'Member') {
      return res.status(403).json({ error: 'Cash Book is restricted from Member accounts.' });
    }
    const rows = db.prepare('SELECT * FROM cash_book ORDER BY date DESC, created_date DESC').all() as any[];
    res.json({
      entries: rows.map(mapCashBook),
      balances: getCurrentCashAndBankBalances(),
    });
  });

  router.post('/cashbook', requireAuth, requirePermission('cash_book', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const entry = insertCashBookRecord(req.body, auth);
      res.status(201).json({ entry, balances: getCurrentCashAndBankBalances() });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Reversal / Correction entry (never silently delete financial records!)
  router.post('/ledger/reverse', requireAuth, requireRole(['System', 'President', 'Secretary']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { module, recordId, reason } = req.body || {};
    if (!module || !recordId || !reason) {
      return res.status(400).json({ error: 'module, recordId, and reason are required for reversal entries.' });
    }
    const now = new Date().toISOString();
    try {
      if (module === 'saving_register') {
        const orig = db.prepare('SELECT * FROM savings WHERE saving_id = ?').get(recordId) as any;
        if (!orig) return res.status(404).json({ error: 'Saving record not found.' });
        const revId = genId('SAV-REV');
        db.prepare(
          `INSERT INTO savings (id, saving_id, member_id, member_name, date, monthly_saving_amount, previous_saving_amount, interest, fine, total_saving, payment_status, payment_method, meeting_status, receipt_number, is_reversal, reversed_record_id, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Cash', 'Other', ?, ?, 1, ?, ?, ?, ?, ?, 'Synced', ?, 1)`
        ).run(
          revId, revId, orig.member_id, orig.member_name, now.slice(0, 10),
          -orig.monthly_saving_amount, 0, -orig.interest, -orig.fine, -orig.total_saving,
          orig.meeting_status, `REV-${orig.receipt_number}`, recordId, now, now, auth.fullName, auth.fullName, now
        );
        postFinancialLedger({
          module: 'saving_reversal',
          recordId: revId,
          memberId: orig.member_id,
          entryType: 'REVERSAL',
          amount: -orig.total_saving,
          direction: 'DEBIT',
          description: `Reversal of ${recordId}: ${reason}`,
          idempotencyKey: `REV-${recordId}`,
          createdBy: auth.fullName,
        });
      } else if (module === 'cash_book') {
        const orig = db.prepare('SELECT * FROM cash_book WHERE transaction_id = ?').get(recordId) as any;
        if (!orig) return res.status(404).json({ error: 'Cash Book record not found.' });
        const revMode = orig.payment_mode === 'Deposit' ? 'Payment' : 'Deposit';
        const revId = genId('CB-REV');
        const calc = validateCashBookEntry({
          paymentMode: revMode,
          bankAmount: orig.bank_amount,
          cashAmount: orig.cash_amount,
          allowAdjustment: true,
        });
        db.prepare(
          `INSERT INTO cash_book (id, transaction_id, date, payment_mode, description, bank_amount, cash_amount, total_amount, deposit_amount, payment_amount, balance, bank_balance_after, cash_balance_after, reference_number, notes, allow_adjustment, is_reversal, reversed_record_id, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, 'Synced', ?, 1)`
        ).run(
          revId, revId, now.slice(0, 10), revMode, `REVERSAL of ${recordId}: ${reason}`,
          orig.bank_amount, orig.cash_amount, calc.totalAmount, calc.depositAmount, calc.paymentAmount,
          calc.balanceAfter, calc.bankBalanceAfter, calc.cashBalanceAfter, orig.reference_number,
          reason, recordId, now, now, auth.fullName, auth.fullName, now
        );
      } else {
        return res.status(400).json({ error: 'Unsupported module for reversal.' });
      }
      writeAuditLog({
        userId: auth.userId,
        userName: auth.fullName,
        userRole: auth.role,
        action: 'FINANCIAL_REVERSAL',
        module,
        recordId,
        updatedValue: { reason },
        sessionInfo: auth.sessionId,
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Meetings & Attendance
  router.get('/meetings', requireAuth, requirePermission('meetings', 'view'), (_req, res) => {
    const rows = db.prepare('SELECT * FROM meetings ORDER BY meeting_date DESC').all() as any[];
    res.json(rows.map(mapMeeting));
  });

  router.post('/meetings', requireAuth, requirePermission('meetings', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const m = insertMeetingRecord(req.body, auth);
      res.status(201).json(m);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/attendance', requireAuth, requirePermission('attendance', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM attendance WHERE member_id = ? ORDER BY date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM attendance ORDER BY date DESC').all() as any[]);
    res.json(rows.map(mapAttendance));
  });

  router.post('/attendance', requireAuth, requirePermission('attendance', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const records = Array.isArray(req.body.records) ? req.body.records : [req.body];
      const inserted = insertAttendanceBulk(records, auth);
      res.status(201).json(inserted);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  // Loan Applications + Approval Workflow (Approval does NOT auto-disburse!)
  router.get('/loan-applications', requireAuth, requirePermission('loan_application', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM loan_applications WHERE member_id = ? ORDER BY application_date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM loan_applications ORDER BY application_date DESC').all() as any[]);
    res.json(rows.map(mapLoanApplication));
  });

  router.post('/loan-applications', requireAuth, requirePermission('loan_application', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const created = insertLoanApplicationRecord(req.body, auth);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.put('/loan-applications/:applicationId/review', requireAuth, requirePermission('loan_application', 'edit'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    if (auth.role === 'Member') {
      return res.status(403).json({ error: 'Members cannot review or approve loan applications.' });
    }
    const { applicationId } = req.params;
    const existing = db.prepare('SELECT * FROM loan_applications WHERE application_id = ?').get(applicationId) as any;
    if (!existing) return res.status(404).json({ error: 'Loan application not found.' });

    const { applicationStatus, approvalNote, approvedAmount, presidentSignature, secretarySignature } = req.body || {};
    if (applicationStatus === 'Approved' && auth.role === 'Secretary') {
      // Secretary can recommend/forward; President or System performs final approval unless explicitly configured
      if (!hasModulePermission('Secretary', 'loan_application', 'edit')) {
        return res.status(403).json({ error: 'Not authorized to approve.' });
      }
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE loan_applications SET
        application_status = ?, approval_note = ?, approved_amount = ?, approved_by = ?, approval_date = ?,
        president_signature = ?, secretary_signature = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1
       WHERE application_id = ?`
    ).run(
      applicationStatus || existing.application_status,
      approvalNote ?? existing.approval_note,
      roundMoney(Number(approvedAmount ?? existing.approved_amount)),
      ['Approved', 'Rejected'].includes(applicationStatus) ? auth.fullName : existing.approved_by,
      ['Approved', 'Rejected'].includes(applicationStatus) ? now.slice(0, 10) : existing.approval_date,
      presidentSignature ?? existing.president_signature,
      secretarySignature ?? existing.secretary_signature,
      now,
      auth.fullName,
      applicationId
    );

    if (applicationStatus === 'Approved' || applicationStatus === 'Rejected') {
      createNotification({
        targetRole: 'Member',
        targetMemberId: existing.member_id,
        type: applicationStatus === 'Approved' ? 'Loan Approved' : 'Loan Rejected',
        title: `Loan Application ${applicationStatus}`,
        message: `Application ${applicationId} has been ${applicationStatus.toLowerCase()}. ${approvalNote || ''}`,
        relatedId: applicationId,
      });
    }

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: `LOAN_APP_${String(applicationStatus || 'UPDATE').toUpperCase()}`,
      module: 'LoanApplication',
      recordId: applicationId,
      previousValue: { status: existing.application_status },
      updatedValue: { applicationStatus, approvedAmount, approvalNote },
      sessionInfo: auth.sessionId,
    });

    res.json(mapLoanApplication(db.prepare('SELECT * FROM loan_applications WHERE application_id = ?').get(applicationId)));
  });

  // Online Payments & Verification
  router.get('/online-payments', requireAuth, requirePermission('online_payment', 'view'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'Member'
      ? (db.prepare('SELECT * FROM online_payments WHERE member_id = ? ORDER BY date DESC').all(auth.memberId) as any[])
      : (db.prepare('SELECT * FROM online_payments ORDER BY date DESC').all() as any[]);
    res.json(rows.map(mapOnlinePayment));
  });

  router.post('/online-payments', requireAuth, requirePermission('online_payment', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    try {
      const created = insertOnlinePaymentRecord(req.body, auth);
      res.status(201).json(created);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/online-payments/:paymentId/verify', requireAuth, requirePermission('online_payment', 'edit'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    if (auth.role === 'Member') {
      return res.status(403).json({ error: 'Members cannot verify online payments.' });
    }
    const { paymentId } = req.params;
    const { decision, notes } = req.body || {};
    if (decision !== 'Verified' && decision !== 'Rejected') {
      return res.status(400).json({ error: 'Decision must be Verified or Rejected.' });
    }
    const existing = db.prepare('SELECT * FROM online_payments WHERE payment_id = ?').get(paymentId) as any;
    if (!existing) return res.status(404).json({ error: 'Payment not found.' });
    if (existing.verification_status === 'Verified') {
      return res.status(409).json({ error: 'This payment has already been verified (duplicate posting prevented).' });
    }

    const now = new Date().toISOString();
    const settings = getSocietySettings();
    const receiptNo = decision === 'Verified' ? `${settings.receiptPrefix}-PAY-${Date.now().toString().slice(-6)}` : '';

    db.prepare(
      `UPDATE online_payments SET verification_status = ?, verified_by = ?, verification_date = ?, receipt_number = ?, notes = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1 WHERE payment_id = ?`
    ).run(decision, auth.fullName, now.slice(0, 10), receiptNo, notes ?? existing.notes, now, auth.fullName, paymentId);

    const verId = genId('VER');
    db.prepare(
      `INSERT INTO payment_verifications (id, verification_id, payment_id, member_id, upi_transaction_id, amount, decision, verified_by, notes, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(verId, verId, paymentId, existing.member_id, existing.upi_transaction_id, existing.amount, decision, auth.fullName, notes || '', now);

    if (decision === 'Verified') {
      db.prepare(
        `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
         VALUES (?, ?, 'Online Payment', ?, ?, ?, ?, ?, ?, 'Verified', ?, ?)`
      ).run(
        receiptNo, receiptNo, existing.member_id, existing.member_name, existing.date, existing.amount,
        existing.payment_method, `UPI Txn: ${existing.upi_transaction_id}`, auth.fullName, now
      );

      postFinancialLedger({
        module: 'online_payment',
        recordId: paymentId,
        memberId: existing.member_id,
        entryType: existing.payment_method,
        amount: existing.amount,
        direction: 'CREDIT',
        description: `Verified Online Payment ${existing.upi_transaction_id}`,
        idempotencyKey: `PAY-VER-${paymentId}`,
        createdBy: auth.fullName,
      });
    }

    createNotification({
      targetRole: 'Member',
      targetMemberId: existing.member_id,
      type: decision === 'Verified' ? 'Payment Verified' : 'Payment Rejected',
      title: `Payment ${decision}`,
      message: `Your online payment (${paymentId}, ₹${existing.amount}) was ${decision.toLowerCase()}. ${notes || ''}`,
      relatedId: paymentId,
    });

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: `ONLINE_PAYMENT_${decision.toUpperCase()}`,
      module: 'OnlinePayments',
      recordId: paymentId,
      updatedValue: { decision, receiptNo, notes },
      sessionInfo: auth.sessionId,
    });

    res.json(mapOnlinePayment(db.prepare('SELECT * FROM online_payments WHERE payment_id = ?').get(paymentId)));
  });

  // Notices & Notifications & Media
  router.get('/notices', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'System'
      ? (db.prepare('SELECT * FROM notices ORDER BY publish_date DESC').all() as any[])
      : (db.prepare("SELECT * FROM notices WHERE is_published = 1 AND (target_role = 'Everyone' OR target_role = ?) ORDER BY publish_date DESC").all(auth.role) as any[]);
    res.json(rows.map(mapNotice));
  });

  router.post('/notices', requireAuth, requirePermission('notices', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const b = req.body || {};
    if (!b.title || !b.content) return res.status(400).json({ error: 'Notice title and content are required.' });
    const now = new Date().toISOString();
    const id = genId('NTC');
    db.prepare(
      `INSERT INTO notices (id, notice_id, title, title_as, content, content_as, category, target_role, attachment_url, attachment_type, publish_date, expiry_date, is_published, is_banner, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1)`
    ).run(
      id, id, b.title, b.titleAs || '', b.content, b.contentAs || '', b.category || 'General',
      b.targetRole || 'Everyone', b.attachmentUrl || '', b.attachmentType || 'Text',
      b.publishDate || now.slice(0, 10), b.expiryDate || '', b.isPublished !== false ? 1 : 0, b.isBanner ? 1 : 0,
      now, now, auth.fullName, auth.fullName, now
    );
    createNotification({
      targetRole: b.targetRole || 'Everyone',
      type: 'New Notice',
      title: `New Notice: ${b.title}`,
      message: b.content.slice(0, 140),
      relatedId: id,
    });
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'CREATE_NOTICE',
      module: 'Notices',
      recordId: id,
      sessionInfo: auth.sessionId,
    });
    res.status(201).json(mapNotice(db.prepare('SELECT * FROM notices WHERE id = ?').get(id)));
  });

  router.delete('/notices/:noticeId', requireAuth, requirePermission('notices', 'delete'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    db.prepare('DELETE FROM notices WHERE notice_id = ?').run(req.params.noticeId);
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'DELETE_NOTICE',
      module: 'Notices',
      recordId: req.params.noticeId,
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true });
  });

  router.post('/notifications/:id/read', requireAuth, (req, res) => {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE notification_id = ? OR id = ?').run(req.params.id, req.params.id);
    res.json({ ok: true });
  });

  router.post('/notifications/mark-all-read', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    if (auth.role === 'Member') {
      db.prepare("UPDATE notifications SET is_read = 1 WHERE target_role = 'Everyone' OR (target_role = 'Member' AND (target_member_id = '' OR target_member_id = ?))").run(auth.memberId);
    } else {
      db.prepare('UPDATE notifications SET is_read = 1 WHERE target_role = ? OR target_role = ?').run('Everyone', auth.role);
    }
    res.json({ ok: true });
  });

  // Media Manager
  router.get('/media', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const rows = auth.role === 'System'
      ? (db.prepare('SELECT * FROM media_items ORDER BY created_at DESC').all() as any[])
      : (db.prepare("SELECT * FROM media_items WHERE visibility = 'Everyone' OR visibility = ? ORDER BY created_at DESC").all(auth.role) as any[]);
    res.json(rows.map(mapMedia));
  });

  router.post('/media', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const b = req.body || {};
    if (!b.title || !b.dataUrl) return res.status(400).json({ error: 'Title and media file are required.' });
    const id = genId('MED');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO media_items (id, media_id, title, title_as, description, media_type, data_url, file_name, visibility, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, id, b.title, b.titleAs || '', b.description || '', b.mediaType || 'Image', b.dataUrl, b.fileName || 'upload', b.visibility || 'Everyone', auth.fullName, now);
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'UPLOAD_MEDIA',
      module: 'MediaManager',
      recordId: id,
      sessionInfo: auth.sessionId,
    });
    res.status(201).json(mapMedia(db.prepare('SELECT * FROM media_items WHERE id = ?').get(id)));
  });

  router.delete('/media/:mediaId', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    db.prepare('DELETE FROM media_items WHERE media_id = ?').run(req.params.mediaId);
    res.json({ ok: true });
  });

  // Receipts & Certificates register log
  router.post('/certificates', requireAuth, requirePermission('id_certificates', 'add'), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const b = req.body || {};
    const certNo = b.certificateNumber || genId(b.certificateType === 'ID Card' ? 'IDC' : 'CERT');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT OR REPLACE INTO certificates (id, certificate_number, certificate_type, member_id, member_name, issue_date, issued_by, verification_code)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      certNo,
      certNo,
      b.certificateType || 'Membership Certificate',
      b.memberId,
      b.memberName,
      now.slice(0, 10),
      auth.fullName,
      b.verificationCode || `GMCSL-VERIFY:${b.memberId}:${certNo}`
    );
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'ISSUE_CERTIFICATE_OR_ID',
      module: 'Certificates',
      recordId: certNo,
      sessionInfo: auth.sessionId,
    });
    res.status(201).json(mapCertificate(db.prepare('SELECT * FROM certificates WHERE id = ?').get(certNo)));
  });

  // Offline Synchronization Push Endpoint (Bidirectional Sync + Idempotency + Conflict Detection!)
  router.post('/sync/push', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const operations = (req.body?.operations || []) as PendingSyncOperation[];
    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: 'operations array is required.' });
    }

    const results: Array<{
      operationId: string;
      status: 'Synced' | 'Conflict' | 'Failed';
      message: string;
      conflictData?: any;
      serverRecord?: any;
    }> = [];

    for (const op of operations) {
      try {
        // Idempotency check
        const already = db.prepare('SELECT * FROM sync_metadata WHERE operation_id = ?').get(op.operationId) as any;
        if (already) {
          results.push({ operationId: op.operationId, status: 'Synced', message: 'Already synchronized (idempotent).' });
          continue;
        }

        const modKey = mapSyncModuleToPermissionKey(op.module);
        const permAction = op.action === 'create' ? 'add' : op.action === 'update' ? 'edit' : 'delete';
        if (modKey && !hasModulePermission(auth.role, modKey, permAction)) {
          results.push({
            operationId: op.operationId,
            status: 'Failed',
            message: `Permission denied: ${auth.role} cannot ${permAction} in ${op.module}.`,
          });
          continue;
        }

        if (op.action === 'create') {
          let created: any;
          if (op.module === 'savings') created = insertSavingRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'shares') created = insertShareRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'loans') created = insertLoanRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'loan_repayments') created = insertLoanRepaymentRecord({ ...op.payload, operationId: op.operationId }, auth).repayment;
          else if (op.module === 'cash_book') created = insertCashBookRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'members') created = insertMemberRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'meetings') created = insertMeetingRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'attendance') created = insertAttendanceBulk([{ ...op.payload, operationId: op.operationId }], auth);
          else if (op.module === 'loan_applications') created = insertLoanApplicationRecord({ ...op.payload, operationId: op.operationId }, auth);
          else if (op.module === 'online_payments') created = insertOnlinePaymentRecord({ ...op.payload, operationId: op.operationId }, auth);
          else throw new Error(`Unsupported sync module: ${op.module}`);

          db.prepare(
            `INSERT INTO sync_metadata (operation_id, module, action, record_id, processed_by, processed_at, result)
             VALUES (?, ?, ?, ?, ?, ?, 'SYNCED')`
          ).run(op.operationId, op.module, op.action, op.recordId, auth.fullName, new Date().toISOString());

          results.push({ operationId: op.operationId, status: 'Synced', message: 'Synchronized successfully.', serverRecord: created });
        } else if (op.action === 'update') {
          const conflict = checkAndApplySyncUpdate(op, auth);
          if (conflict) {
            results.push({
              operationId: op.operationId,
              status: 'Conflict',
              message: 'Server record was modified after offline edit.',
              conflictData: conflict,
            });
          } else {
            db.prepare(
              `INSERT INTO sync_metadata (operation_id, module, action, record_id, processed_by, processed_at, result)
               VALUES (?, ?, ?, ?, ?, ?, 'SYNCED')`
            ).run(op.operationId, op.module, op.action, op.recordId, auth.fullName, new Date().toISOString());
            results.push({ operationId: op.operationId, status: 'Synced', message: 'Updated successfully.' });
          }
        }
      } catch (err: any) {
        results.push({
          operationId: op.operationId,
          status: 'Failed',
          message: err?.message || 'Synchronization validation failed.',
        });
      }
    }

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'OFFLINE_SYNC_PUSH',
      module: 'Synchronization',
      recordId: `BATCH-${operations.length}`,
      updatedValue: results.map((r) => ({ id: r.operationId, status: r.status })),
      sessionInfo: auth.sessionId,
    });

    res.json({ results, syncedAt: new Date().toISOString() });
  });

  // Conflict Resolution Endpoint
  router.post('/sync/resolve-conflict', requireAuth, (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const { operationId, resolution, module, recordId, mergedFields } = req.body || {};
    if (!operationId || !resolution) {
      return res.status(400).json({ error: 'operationId and resolution are required.' });
    }
    const now = new Date().toISOString();
    if (resolution === 'keep_server') {
      db.prepare(
        `INSERT OR REPLACE INTO sync_metadata (operation_id, module, action, record_id, processed_by, processed_at, result)
         VALUES (?, ?, 'conflict_resolved', ?, ?, ?, 'KEPT_SERVER')`
      ).run(operationId, module || '', recordId || '', auth.fullName, now);
    } else if (resolution === 'merge_non_financial' && module === 'members' && mergedFields) {
      db.prepare(
        `UPDATE members SET village = COALESCE(?, village), post_office = COALESCE(?, post_office), gmail_id = COALESCE(?, gmail_id), updated_date = ?, updated_by = ?, record_version = record_version + 1 WHERE member_id = ?`
      ).run(mergedFields.village, mergedFields.postOffice, mergedFields.gmailId, now, auth.fullName, recordId);
      db.prepare(
        `INSERT OR REPLACE INTO sync_metadata (operation_id, module, action, record_id, processed_by, processed_at, result)
         VALUES (?, ?, 'conflict_resolved', ?, ?, ?, 'MERGED_NON_FINANCIAL')`
      ).run(operationId, module, recordId, auth.fullName, now);
    } else if (resolution === 'submit_correction') {
      createNotification({
        targetRole: 'System',
        type: 'Sync Alert',
        title: `Correction Request for ${recordId}`,
        message: `${auth.fullName} submitted a conflict correction request for ${module} (${recordId}).`,
        relatedId: recordId,
      });
      db.prepare(
        `INSERT OR REPLACE INTO sync_metadata (operation_id, module, action, record_id, processed_by, processed_at, result)
         VALUES (?, ?, 'conflict_resolved', ?, ?, ?, 'CORRECTION_REQUESTED')`
      ).run(operationId, module || '', recordId || '', auth.fullName, now);
    }

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'CONFLICT_RESOLUTION',
      module: module || 'Synchronization',
      recordId: recordId || operationId,
      updatedValue: { resolution, mergedFields },
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true });
  });

  // Google Sheets Integration Management
  router.get('/sheets/status', requireAuth, requireRole(['System']), (_req, res) => {
    res.json({
      status: getSheetsStatus(),
      appsScriptTemplate: APPS_SCRIPT_TEMPLATE,
    });
  });

  router.post('/sheets/config', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    updateSheetsConfig(req.body || {});
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'UPDATE_SHEETS_CONFIG',
      module: 'GoogleSheets',
      recordId: 'default',
      sessionInfo: auth.sessionId,
    });
    res.json({ status: getSheetsStatus() });
  });

  router.post('/sheets/test', requireAuth, requireRole(['System']), async (_req, res) => {
    const result = await testGoogleSheetsConnection();
    res.json({ ...result, status: getSheetsStatus() });
  });

  router.post('/sheets/ensure-sheets', requireAuth, requireRole(['System']), async (_req, res) => {
    const result = await ensureAllGoogleSheets();
    res.json({ ...result, status: getSheetsStatus() });
  });

  router.post('/sheets/sync-now', requireAuth, requireRole(['System']), async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const result = await syncAllToGoogleSheets();
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: result.ok ? 'GOOGLE_SHEETS_SYNC_OK' : 'GOOGLE_SHEETS_SYNC_FAILED',
      module: 'GoogleSheets',
      recordId: 'ALL_SHEETS',
      updatedValue: result,
      sessionInfo: auth.sessionId,
    });
    res.json({ ...result, status: getSheetsStatus() });
  });

  // Admin-Only Dynamic Firebase Configuration Management
  router.get('/system/firebase-config', requireAuth, requireRole(['System']), (_req, res) => {
    const settings = getSocietySettings();
    res.json({ firebaseConfig: settings.firebaseConfig || null });
  });

  router.put('/system/firebase-config', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const cfg = req.body?.firebaseConfig;
    if (!cfg || !cfg.apiKey || !cfg.authDomain || !cfg.projectId) {
      return res.status(400).json({ error: 'apiKey, authDomain, and projectId are required.' });
    }
    const current = getSocietySettings();
    const now = new Date().toISOString();
    const cleanConfig = {
      apiKey: String(cfg.apiKey).trim(),
      authDomain: String(cfg.authDomain).trim(),
      databaseURL: String(cfg.databaseURL || '').trim(),
      projectId: String(cfg.projectId).trim(),
      storageBucket: String(cfg.storageBucket || '').trim(),
      messagingSenderId: String(cfg.messagingSenderId || '').trim(),
      appId: String(cfg.appId || '').trim(),
      measurementId: String(cfg.measurementId || '').trim(),
      firestoreDatabaseId: String(cfg.firestoreDatabaseId || '').trim(),
    };
    const next: SocietySettings = {
      ...current,
      firebaseConfig: cleanConfig,
      updatedAt: now,
    };
    db.prepare('UPDATE society_settings SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), now, 'default');
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'UPDATE_FIREBASE_CONFIG',
      module: 'SystemFirebase',
      recordId: cleanConfig.projectId,
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true, firebaseConfig: cleanConfig });
  });

  router.delete('/system/firebase-config', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const current = getSocietySettings();
    const now = new Date().toISOString();
    const next: SocietySettings = { ...current, firebaseConfig: null, updatedAt: now };
    db.prepare('UPDATE society_settings SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(next), now, 'default');
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'RESET_FIREBASE_CONFIG',
      module: 'SystemFirebase',
      recordId: 'default',
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true });
  });

  // Google Drive Integration & Backup Sync
  router.get('/drive/status', requireAuth, requireRole(['System']), (_req, res) => {
    res.json(getDriveStatus());
  });

  router.post('/drive/config', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    updateDriveConfig(req.body || {});
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'UPDATE_DRIVE_CONFIG',
      module: 'GoogleDrive',
      recordId: 'default',
      sessionInfo: auth.sessionId,
    });
    res.json(getDriveStatus());
  });

  router.post('/drive/sync-now', requireAuth, requireRole(['System']), async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const overrideToken = typeof req.body?.overrideToken === 'string' ? req.body.overrideToken : undefined;
    const result = await syncBackupToGoogleDrive(auth.fullName, overrideToken);
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: result.ok ? 'GOOGLE_DRIVE_BACKUP_OK' : 'GOOGLE_DRIVE_BACKUP_FAILED',
      module: 'GoogleDrive',
      recordId: result.file?.driveFileId || 'BACKUP',
      updatedValue: { ok: result.ok, message: result.message },
      sessionInfo: auth.sessionId,
    });
    res.json(result);
  });

  router.post('/drive/refresh-files', requireAuth, requireRole(['System']), async (req: AuthenticatedRequest, res) => {
    const overrideToken = typeof req.body?.overrideToken === 'string' ? req.body.overrideToken : undefined;
    const result = await refreshDriveFiles(overrideToken);
    res.json(result);
  });

  router.delete('/drive/files/:fileId', requireAuth, requireRole(['System']), async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const overrideToken = typeof req.body?.overrideToken === 'string' ? req.body.overrideToken : undefined;
    const result = await deleteDriveFile(req.params.fileId, overrideToken);
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'GOOGLE_DRIVE_FILE_DELETED',
      module: 'GoogleDrive',
      recordId: req.params.fileId,
      sessionInfo: auth.sessionId,
    });
    res.json(result);
  });

  // Audit Logs & Security Sessions
  router.get('/audit-logs', requireAuth, requireRole(['System']), (_req, res) => {
    const rows = db.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 500').all() as any[];
    res.json(rows.map(mapAudit));
  });

  router.get('/security/sessions', requireAuth, requireRole(['System']), (_req, res) => {
    const rows = db.prepare('SELECT * FROM session_logs ORDER BY login_time DESC LIMIT 100').all() as any[];
    res.json(rows.map(mapSession));
  });

  router.post('/security/logout-all', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const keepCurrent = Boolean(req.body?.keepCurrent);
    if (keepCurrent) {
      db.prepare('UPDATE session_logs SET is_active = 0 WHERE session_id != ?').run(auth.sessionId);
    } else {
      db.prepare('UPDATE session_logs SET is_active = 0').run();
    }
    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'LOGOUT_ALL_SESSIONS',
      module: 'Security',
      recordId: 'ALL_SESSIONS',
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true });
  });

  // Backup & Restore
  router.get('/backups', requireAuth, requireRole(['System']), (_req, res) => {
    const rows = db.prepare('SELECT * FROM backup_logs ORDER BY timestamp DESC LIMIT 50').all() as any[];
    res.json(rows.map(mapBackup));
  });

  router.post('/backups/create', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const tables = [
      'members', 'savings', 'shares', 'loans', 'loan_repayments', 'cash_book', 'attendance',
      'loan_applications', 'online_payments', 'meetings', 'notices',
      'notifications', 'role_permissions', 'society_settings', 'receipts', 'certificates',
    ];
    const snapshot: Record<string, any[]> = {};
    let total = 0;
    for (const t of tables) {
      const rows = db.prepare(`SELECT * FROM ${t}`).all();
      snapshot[t] = rows;
      total += rows.length;
    }
    const backupId = genId('BKP');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO backup_logs (id, backup_id, backup_type, created_by, status, record_count, timestamp, notes)
       VALUES (?, ?, 'Full JSON Snapshot', ?, 'Completed', ?, ?, ?)`
    ).run(backupId, backupId, auth.fullName, total, now, req.body?.notes || 'Full database backup');

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'CREATE_BACKUP',
      module: 'Backup',
      recordId: backupId,
      updatedValue: { recordCount: total },
      sessionInfo: auth.sessionId,
    });

    res.json({
      backupId,
      timestamp: now,
      recordCount: total,
      snapshot,
    });
  });

  router.post('/backups/restore', requireAuth, requireRole(['System']), (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const snapshot = req.body?.snapshot;
    if (!snapshot || typeof snapshot !== 'object') {
      return res.status(400).json({ error: 'Valid backup snapshot JSON is required.' });
    }
    const backupId = genId('RST');
    const now = new Date().toISOString();
    let count = 0;
    const allowedTables = ['notices', 'meetings', 'role_permissions'];
    const tx = db.transaction(() => {
      // Safely restore non-destructive or full tables with explicit column insertion
      for (const table of Object.keys(snapshot)) {
        if (!Array.isArray(snapshot[table])) continue;
        if (table === 'society_settings' && snapshot[table][0]?.data) {
          db.prepare('UPDATE society_settings SET data = ?, updated_at = ? WHERE id = ?').run(
            snapshot[table][0].data,
            now,
            'default'
          );
          count += 1;
        } else if (allowedTables.includes(table)) {
          for (const row of snapshot[table]) {
            const cols = Object.keys(row);
            if (cols.length === 0) continue;
            const placeholders = cols.map(() => '?').join(',');
            db.prepare(`INSERT OR REPLACE INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`).run(
              ...cols.map((c) => row[c])
            );
            count += 1;
          }
        }
      }
    });
    tx();
    db.prepare(
      `INSERT INTO backup_logs (id, backup_id, backup_type, created_by, status, record_count, timestamp, notes)
       VALUES (?, ?, 'Full JSON Snapshot', ?, 'Restored', ?, ?, ?)`
    ).run(backupId, backupId, auth.fullName, count, now, 'Restored snapshot from System console');

    writeAuditLog({
      userId: auth.userId,
      userName: auth.fullName,
      userRole: auth.role,
      action: 'RESTORE_BACKUP',
      module: 'Backup',
      recordId: backupId,
      updatedValue: { restoredCount: count },
      sessionInfo: auth.sessionId,
    });
    res.json({ ok: true, restoredCount: count });
  });

  return router;
}

// Helper Functions for Transactional Integrity
function insertMemberRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  if (!body.memberName || !body.mobileNumber) {
    throw new Error('Member Name and Mobile Number are required.');
  }
  const mobile = String(body.mobileNumber).trim();
  if (!/^\d{10}$/.test(mobile)) {
    throw new Error('Mobile Number must be 10 digits.');
  }
  const dupMobile = db.prepare('SELECT id FROM members WHERE mobile_number = ?').get(mobile);
  if (dupMobile) throw new Error('A member with this Mobile Number already exists.');

  const settings = getSocietySettings();
  const count = (db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number }).c + 1;
  const fallbackMemberId = `${settings.memberIdPrefix}${String(count).padStart(4, '0')}`;
  const memberId = resolveEditableAutoId(body.memberId, fallbackMemberId, auth, settings);
  const dupId = db.prepare('SELECT id FROM members WHERE member_id = ?').get(memberId);
  if (dupId) throw new Error(`Member ID ${memberId} already exists.`);

  const now = new Date().toISOString();
  const pinHash = body.pin && /^\d{4}$/.test(String(body.pin)) ? hashSecret(String(body.pin)) : '';

  db.prepare(
    `INSERT INTO members (
      id, member_id, member_name, father_name, join_date, date_of_birth, aadhaar_number, pan_number, voter_id,
      bank_account_number, ifsc_code, branch_name, mobile_number, gmail_id, state, district, development_block,
      village, post_office, pin_code, panchayat, photo_url, signature_url, member_pin_hash, account_status,
      created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    memberId, memberId, String(body.memberName).trim(), body.fatherName || '',
    body.joinDate || now.slice(0, 10), body.dateOfBirth || '', body.aadhaarNumber || '', body.panNumber || '', body.voterId || '',
    body.bankAccountNumber || '', body.ifscCode || '', body.branchName || '', mobile, body.gmailId || '',
    body.state || 'Assam', body.district || '', body.developmentBlock || '', body.village || '',
    body.postOffice || '', body.pinCode || '', body.panchayat || '', body.photoUrl || '', body.signatureUrl || '',
    pinHash, body.accountStatus === 'Inactive' ? 'Inactive' : 'Active',
    now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  if (pinHash) {
    const uid = genId('USR-M');
    db.prepare(
      `INSERT INTO system_users (id, user_id, role, member_id, full_name, email, mobile_number, pin_hash, account_status, created_at, updated_at)
       VALUES (?, ?, 'Member', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid, uid, memberId, String(body.memberName).trim(), body.gmailId || '', mobile, pinHash, body.accountStatus === 'Inactive' ? 'Inactive' : 'Active', now, now);
  }

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'CREATE_MEMBER',
    module: 'MemberRegister',
    recordId: memberId,
    updatedValue: { memberName: body.memberName, mobile },
    sessionInfo: auth.sessionId,
  });

  return mapMember(db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId), auth.role, auth.memberId);
}

function insertSavingRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(body.memberId) as any;
  if (!member) throw new Error('Valid Member ID is required.');

  const prevLedgerRow = db.prepare('SELECT COALESCE(SUM(total_saving), 0) as total FROM savings WHERE member_id = ?').get(member.member_id) as { total: number };
  const providedPrev =
    body.previousSavingAmount !== undefined && body.previousSavingAmount !== '' && Number.isFinite(Number(body.previousSavingAmount))
      ? Number(body.previousSavingAmount)
      : roundMoney(prevLedgerRow.total);

  const calc = calculateSavingTotals({
    monthlySavingAmount: Number(body.monthlySavingAmount || 0),
    previousSavingAmount: providedPrev,
    interest: Number(body.interest || 0),
    fine: Number(body.fine || 0),
  });

  const now = new Date().toISOString();
  const settings = getSocietySettings();
  const savingId = resolveEditableAutoId(body.savingId, genId('SAV'), auth, settings);
  const dupSav = db.prepare('SELECT id FROM savings WHERE saving_id = ?').get(savingId);
  if (dupSav) throw new Error(`Saving ID ${savingId} already exists.`);
  const receiptNumber = body.receiptNumber || `${settings.receiptPrefix}-SAV-${Date.now().toString().slice(-6)}`;

  db.prepare(
    `INSERT INTO savings (
      id, saving_id, member_id, member_name, date, monthly_saving_amount, previous_saving_amount,
      interest, fine, total_saving, payment_status, payment_method, meeting_status, receipt_number,
      created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    savingId, savingId, member.member_id, member.member_name, body.date || now.slice(0, 10),
    calc.monthly, calc.previous, calc.interest, calc.fine, calc.totalSaving,
    body.paymentStatus || 'Cash', body.paymentMethod || 'Saving', body.meetingStatus || 'Present',
    receiptNumber, now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  db.prepare(
    `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
     VALUES (?, ?, 'Saving', ?, ?, ?, ?, ?, ?, 'Verified', ?, ?)`
  ).run(
    receiptNumber, receiptNumber, member.member_id, member.member_name, body.date || now.slice(0, 10),
    calc.totalSaving, body.paymentStatus || 'Cash',
    `Monthly: ₹${calc.monthly}, Previous: ₹${calc.previous}, Interest: ₹${calc.interest}, Fine: ₹${calc.fine}`,
    auth.fullName, now
  );

  postFinancialLedger({
    module: 'saving_register',
    recordId: savingId,
    memberId: member.member_id,
    entryType: 'SAVING_DEPOSIT',
    amount: calc.totalSaving,
    direction: 'CREDIT',
    description: `Saving entry ${savingId}`,
    idempotencyKey: body.operationId || `SAV-${savingId}`,
    createdBy: auth.fullName,
  });

  createNotification({
    targetRole: 'Member',
    targetMemberId: member.member_id,
    type: 'Saving Entry',
    title: 'Saving Deposit Recorded',
    message: `₹${calc.totalSaving} saving transaction recorded (${receiptNumber}).`,
    relatedId: savingId,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'CREATE_SAVING',
    module: 'SavingRegister',
    recordId: savingId,
    updatedValue: calc,
    sessionInfo: auth.sessionId,
  });

  return mapSaving(db.prepare('SELECT * FROM savings WHERE saving_id = ?').get(savingId));
}

function insertShareRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(body.memberId) as any;
  if (!member) throw new Error('Valid Member ID is required.');
  const calc = calculateShareTotal(body.numberOfShares, body.faceValuePerShare);
  const now = new Date().toISOString();
  const settings = getSocietySettings();
  const shareId = resolveEditableAutoId(body.shareId, genId('SHR'), auth, settings);
  const dupShr = db.prepare('SELECT id FROM shares WHERE share_id = ?').get(shareId);
  if (dupShr) throw new Error(`Share ID ${shareId} already exists.`);
  const receiptNumber = `${settings.receiptPrefix}-SHR-${Date.now().toString().slice(-6)}`;

  db.prepare(
    `INSERT INTO shares (
      id, share_id, member_id, member_name, number_of_shares, face_value_per_share, total_share_value,
      date, note, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    shareId, shareId, member.member_id, member.member_name, calc.numberOfShares, calc.faceValuePerShare,
    calc.totalShareValue, body.date || now.slice(0, 10), body.note || '',
    now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  db.prepare(
    `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
     VALUES (?, ?, 'Share Purchase', ?, ?, ?, ?, 'Cash', ?, 'Verified', ?, ?)`
  ).run(
    receiptNumber, receiptNumber, member.member_id, member.member_name, body.date || now.slice(0, 10),
    calc.totalShareValue, `${calc.numberOfShares} Shares @ ₹${calc.faceValuePerShare}`, auth.fullName, now
  );

  postFinancialLedger({
    module: 'share_register',
    recordId: shareId,
    memberId: member.member_id,
    entryType: 'SHARE_PURCHASE',
    amount: calc.totalShareValue,
    direction: 'CREDIT',
    description: `${calc.numberOfShares} shares issued`,
    idempotencyKey: body.operationId || `SHR-${shareId}`,
    createdBy: auth.fullName,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'CREATE_SHARE',
    module: 'ShareRegister',
    recordId: shareId,
    updatedValue: calc,
    sessionInfo: auth.sessionId,
  });

  return mapShare(db.prepare('SELECT * FROM shares WHERE share_id = ?').get(shareId));
}

function insertLoanRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(body.memberId) as any;
  if (!member) throw new Error('Valid Member ID is required.');

  const calc = calculateLoanBalance({
    loanAmount: Number(body.loanAmount || 0),
    loanRepayment: Number(body.loanRepayment || 0),
    interest: Number(body.interest || 0),
    fine: Number(body.fine || 0),
  });

  const prevRow = db.prepare("SELECT COALESCE(SUM(current_loan_balance), 0) as bal FROM loans WHERE member_id = ? AND loan_status IN ('Active', 'Running')").get(member.member_id) as { bal: number };
  const settings = getSocietySettings();
  const count = (db.prepare('SELECT COUNT(*) as c FROM loans').get() as { c: number }).c + 1;
  const loanId = resolveEditableAutoId(body.loanId, genId('LN'), auth, settings);
  const fallbackLoanNumber = `${settings.loanNumberPrefix}${String(count).padStart(4, '0')}`;
  const loanNumber = resolveEditableAutoId(body.loanNumber, fallbackLoanNumber, auth, settings);
  const dupLoan = db.prepare('SELECT id FROM loans WHERE loan_id = ?').get(loanId);
  if (dupLoan) throw new Error(`Loan ID ${loanId} already exists.`);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO loans (
      id, loan_id, loan_number, member_id, member_name, loan_date, loan_amount, previous_loan_amount,
      total_loan_amount, loan_repayment, interest, fine, current_loan_balance, next_due_date,
      payment_status, loan_status, payment_method, member_signature_url, secretary_signature_url,
      president_signature_url, application_id, is_disbursement, created_date, updated_date,
      created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    loanId, loanId, loanNumber, member.member_id, member.member_name, body.loanDate || now.slice(0, 10),
    calc.loanAmount, roundMoney(prevRow.bal), calc.totalLoanAmount, calc.loanRepayment,
    calc.interest, calc.fine, calc.currentLoanBalance, body.nextDueDate || '',
    body.paymentStatus || 'Cash', calc.currentLoanBalance === 0 ? 'Close' : (body.loanStatus || 'Active'),
    body.paymentMethod || 'Loan', body.memberSignatureUrl || '', body.secretarySignatureUrl || '',
    body.presidentSignatureUrl || '', body.applicationId || '', now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  if (body.applicationId) {
    db.prepare('UPDATE loan_applications SET disbursed = 1, updated_date = ? WHERE application_id = ?').run(now, body.applicationId);
  }

  const receiptNo = `${settings.receiptPrefix}-LN-${Date.now().toString().slice(-6)}`;
  db.prepare(
    `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
     VALUES (?, ?, 'Loan Disbursement', ?, ?, ?, ?, ?, ?, 'Verified', ?, ?)`
  ).run(
    receiptNo, receiptNo, member.member_id, member.member_name, body.loanDate || now.slice(0, 10),
    calc.loanAmount, body.paymentStatus || 'Cash', `Loan ${loanNumber} Disbursed`, auth.fullName, now
  );

  postFinancialLedger({
    module: 'loan_register',
    recordId: loanId,
    memberId: member.member_id,
    entryType: 'LOAN_DISBURSEMENT',
    amount: calc.loanAmount,
    direction: 'DEBIT',
    description: `Loan ${loanNumber} disbursed`,
    idempotencyKey: body.operationId || `LN-${loanId}`,
    createdBy: auth.fullName,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'DISBURSE_LOAN',
    module: 'LoanRegister',
    recordId: loanId,
    updatedValue: { loanNumber, ...calc },
    sessionInfo: auth.sessionId,
  });

  return mapLoan(db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(loanId));
}

function insertCashBookRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const mode = body.paymentMode === 'Payment' ? 'Payment' : 'Deposit';
  if (!body.description) throw new Error('Description is required.');
  const calc = validateCashBookEntry({
    paymentMode: mode,
    bankAmount: Number(body.bankAmount || 0),
    cashAmount: Number(body.cashAmount || 0),
    allowAdjustment: Boolean(body.allowAdjustment),
  });
  const now = new Date().toISOString();
  const settings = getSocietySettings();
  const txId = resolveEditableAutoId(body.transactionId, genId('CB'), auth, settings);
  const dupCb = db.prepare('SELECT id FROM cash_book WHERE transaction_id = ?').get(txId);
  if (dupCb) throw new Error(`Transaction ID ${txId} already exists.`);

  db.prepare(
    `INSERT INTO cash_book (
      id, transaction_id, date, payment_mode, description, bank_amount, cash_amount, total_amount,
      deposit_amount, payment_amount, balance, bank_balance_after, cash_balance_after, reference_number,
      notes, allow_adjustment, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    txId, txId, body.date || now.slice(0, 10), mode, String(body.description).trim(),
    calc.bankAmount, calc.cashAmount, calc.totalAmount, calc.depositAmount, calc.paymentAmount,
    calc.balanceAfter, calc.bankBalanceAfter, calc.cashBalanceAfter, body.referenceNumber || '',
    body.notes || '', body.allowAdjustment ? 1 : 0, now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  const voucherNo = `${settings.receiptPrefix}-CB-${Date.now().toString().slice(-6)}`;
  db.prepare(
    `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
     VALUES (?, ?, 'Cash Book Voucher', 'SOCIETY', 'GMCSL Cash Book', ?, ?, ?, ?, 'Verified', ?, ?)`
  ).run(
    voucherNo, voucherNo, body.date || now.slice(0, 10), calc.totalAmount, mode,
    `${body.description} (Bank: ₹${calc.bankAmount}, Cash: ₹${calc.cashAmount})`, auth.fullName, now
  );

  postFinancialLedger({
    module: 'cash_book',
    recordId: txId,
    entryType: mode === 'Deposit' ? 'CASHBOOK_DEPOSIT' : 'CASHBOOK_PAYMENT',
    amount: calc.totalAmount,
    direction: mode === 'Deposit' ? 'CREDIT' : 'DEBIT',
    description: body.description,
    idempotencyKey: body.operationId || `CB-${txId}`,
    createdBy: auth.fullName,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: `CASHBOOK_${mode.toUpperCase()}`,
    module: 'CashBook',
    recordId: txId,
    updatedValue: calc,
    sessionInfo: auth.sessionId,
  });

  return mapCashBook(db.prepare('SELECT * FROM cash_book WHERE transaction_id = ?').get(txId));
}

function insertMeetingRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  if (!body.meetingNumber || !body.meetingDate || !body.meetingLocation) {
    throw new Error('Meeting Number, Date, and Location are required.');
  }
  const dup = db.prepare('SELECT id FROM meetings WHERE meeting_number = ?').get(String(body.meetingNumber).trim());
  if (dup) throw new Error(`Meeting Number ${body.meetingNumber} already exists.`);
  const now = new Date().toISOString();
  const settings = getSocietySettings();
  const id = resolveEditableAutoId(body.meetingId, genId('MTG'), auth, settings);
  db.prepare(
    `INSERT INTO meetings (id, meeting_id, meeting_number, meeting_date, meeting_type, meeting_location, meeting_agenda, meeting_notes, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    id, id, String(body.meetingNumber).trim(), body.meetingDate, body.meetingType || 'General Meeting',
    body.meetingLocation, body.meetingAgenda || '', body.meetingNotes || '',
    now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );
  createNotification({
    targetRole: 'Everyone',
    type: 'Upcoming Meeting',
    title: `Meeting ${body.meetingNumber} Scheduled`,
    message: `${body.meetingType || 'General Meeting'} on ${body.meetingDate} at ${body.meetingLocation}.`,
    relatedId: id,
  });
  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'CREATE_MEETING',
    module: 'Meetings',
    recordId: id,
    sessionInfo: auth.sessionId,
  });
  return mapMeeting(db.prepare('SELECT * FROM meetings WHERE meeting_id = ?').get(id));
}

function insertAttendanceBulk(records: any[], auth: NonNullable<AuthenticatedRequest['auth']>) {
  const now = new Date().toISOString();
  const created: any[] = [];
  const tx = db.transaction((items: any[]) => {
    for (const item of items) {
      const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(item.memberId) as any;
      if (!member) throw new Error(`Member ${item.memberId} not found.`);
      if (!item.meetingNumber) throw new Error('Meeting Number is required.');
      const dup = db.prepare('SELECT id FROM attendance WHERE member_id = ? AND meeting_number = ?').get(member.member_id, item.meetingNumber);
      if (dup) throw new Error(`Duplicate attendance prevented for ${member.member_id} in Meeting ${item.meetingNumber}.`);
      const id = item.attendanceId || genId('ATT');
      db.prepare(
        `INSERT INTO attendance (id, attendance_id, member_id, member_name, date, meeting_location, meeting_number, meeting_method, attendance_status, created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
      ).run(
        id, id, member.member_id, member.member_name, item.date || now.slice(0, 10),
        item.meetingLocation || '', item.meetingNumber, item.meetingMethod || 'General Meeting',
        item.attendanceStatus === 'Absent' ? 'Absent' : 'Present', now, now, auth.fullName, auth.fullName, now, item.operationId || ''
      );
      created.push(mapAttendance(db.prepare('SELECT * FROM attendance WHERE attendance_id = ?').get(id)));
    }
  });
  tx(records);
  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'RECORD_ATTENDANCE',
    module: 'Attendance',
    recordId: records[0]?.meetingNumber || 'BULK',
    updatedValue: { count: created.length },
    sessionInfo: auth.sessionId,
  });
  return created;
}

function insertLoanApplicationRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const targetMemberId = auth.role === 'Member' ? auth.memberId : body.memberId;
  const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(targetMemberId) as any;
  if (!member) throw new Error('Valid Member account is required.');
  const amt = roundMoney(Number(body.loanAmountRequired || 0));
  if (amt <= 0) throw new Error('Loan Amount Required must be greater than zero.');

  const now = new Date().toISOString();
  const settings = getSocietySettings();
  const appId = resolveEditableAutoId(body.applicationId, genId('LAPP'), auth, settings);
  db.prepare(
    `INSERT INTO loan_applications (
      id, application_id, member_id, member_name, mobile_number, application_date, loan_amount_required,
      purpose_of_loan, additional_note, supporting_document_url, application_status,
      created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    appId, appId, member.member_id, member.member_name, member.mobile_number,
    body.applicationDate || now.slice(0, 10), amt, body.purposeOfLoan || 'Agriculture',
    body.additionalNote || '', body.supportingDocumentUrl || '',
    now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  createNotification({
    targetRole: 'President',
    type: 'New Loan Application',
    title: `New Loan Application (${appId})`,
    message: `${member.member_name} (${member.member_id}) applied for ₹${amt} (${body.purposeOfLoan || 'Agriculture'}).`,
    relatedId: appId,
  });
  createNotification({
    targetRole: 'Secretary',
    type: 'New Loan Application',
    title: `New Loan Application (${appId})`,
    message: `${member.member_name} (${member.member_id}) applied for ₹${amt}.`,
    relatedId: appId,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'SUBMIT_LOAN_APPLICATION',
    module: 'LoanApplication',
    recordId: appId,
    updatedValue: { memberId: member.member_id, amount: amt },
    sessionInfo: auth.sessionId,
  });

  return mapLoanApplication(db.prepare('SELECT * FROM loan_applications WHERE application_id = ?').get(appId));
}

function insertOnlinePaymentRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const targetMemberId = auth.role === 'Member' ? auth.memberId : body.memberId;
  const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(targetMemberId) as any;
  if (!member) throw new Error('Valid Member account is required.');

  const amt = roundMoney(Number(body.amount || 0));
  if (amt <= 0) throw new Error('Payment Amount must be greater than zero.');
  const upiTxnId = String(body.upiTransactionId || '').trim();
  if (!upiTxnId) throw new Error('UPI Transaction ID is required.');

  const dup = db.prepare('SELECT id FROM online_payments WHERE upi_transaction_id = ?').get(upiTxnId);
  if (dup) throw new Error('This UPI Transaction ID has already been submitted (duplicate prevented).');

  const now = new Date().toISOString();
  const settings = getSocietySettings();
  const payId = resolveEditableAutoId(body.paymentId, genId('PAY'), auth, settings);
  // Never automatically verify submitted payments! Always starts Pending.
  db.prepare(
    `INSERT INTO online_payments (
      id, payment_id, member_id, member_name, date, amount, payment_method, upi_transaction_id,
      payment_screenshot_url, verification_status, notes, created_date, updated_date, created_by,
      updated_by, sync_status, last_synced_time, record_version, offline_operation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
  ).run(
    payId, payId, member.member_id, member.member_name, body.date || now.slice(0, 10), amt,
    body.paymentMethod || 'Saving', upiTxnId, body.paymentScreenshotUrl || '', body.notes || '',
    now, now, auth.fullName, auth.fullName, now, body.operationId || ''
  );

  createNotification({
    targetRole: 'Secretary',
    type: 'Payment Submitted',
    title: `Payment Submitted (${payId})`,
    message: `${member.member_name} submitted ₹${amt} (UPI: ${upiTxnId}) awaiting verification.`,
    relatedId: payId,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'SUBMIT_ONLINE_PAYMENT',
    module: 'OnlinePayments',
    recordId: payId,
    updatedValue: { amount: amt, upiTxnId },
    sessionInfo: auth.sessionId,
  });

  return mapOnlinePayment(db.prepare('SELECT * FROM online_payments WHERE payment_id = ?').get(payId));
}

function insertLoanRepaymentRecord(body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const loan = db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(body.loanId) as any;
  if (!loan) throw new Error('Active loan record not found.');
  if (!['Active', 'Running'].includes(loan.loan_status) || Number(loan.current_loan_balance || 0) <= 0) {
    throw new Error('Repayments can only be recorded for active loans with a positive outstanding balance.');
  }

  const principalPaid = roundMoney(Number(body.principalPaid || 0));
  const interestPaid = roundMoney(Number(body.interestPaid || 0));
  const finePaid = roundMoney(Number(body.finePaid || 0));

  if (principalPaid < 0 || interestPaid < 0 || finePaid < 0) {
    throw new Error('Repayment amounts cannot be negative.');
  }
  if (principalPaid + interestPaid + finePaid <= 0) {
    throw new Error('Enter a positive Principal, Interest, or Fine amount.');
  }
  const balanceBefore = roundMoney(Number(loan.current_loan_balance || 0));
  if (principalPaid > balanceBefore) {
    throw new Error(`Principal Paid (₹${principalPaid}) cannot exceed Current Loan Balance (₹${balanceBefore}).`);
  }

  const settings = getSocietySettings();
  const now = new Date().toISOString();
  const txDate = body.date || now.slice(0, 10);
  const repaymentId = resolveEditableAutoId(body.repaymentId, genId('LREP'), auth, settings);
  const dup = db.prepare('SELECT id FROM loan_repayments WHERE repayment_id = ?').get(repaymentId);
  if (dup) throw new Error(`Repayment ID ${repaymentId} already exists.`);

  const balanceAfter = roundMoney(balanceBefore - principalPaid);
  const totalPaid = roundMoney(principalPaid + interestPaid + finePaid);
  const paymentMode = body.paymentMode || 'Cash';
  const receiptNo = `${settings.receiptPrefix}-REP-${Date.now().toString().slice(-6)}`;

  let linkedSavingId = '';

  const tx = db.transaction(() => {
    const nextLoanRepaid = roundMoney(Number(loan.loan_repayment || 0) + principalPaid);
    const nextLoanInterest = roundMoney(Number(loan.interest || 0) + interestPaid);
    const nextLoanFine = roundMoney(Number(loan.fine || 0) + finePaid);
    const nextLoanStatus = balanceAfter === 0 ? 'Close' : loan.loan_status;

    db.prepare(
      `UPDATE loans SET loan_repayment = ?, interest = ?, fine = ?, current_loan_balance = ?, loan_status = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1 WHERE loan_id = ?`
    ).run(nextLoanRepaid, nextLoanInterest, nextLoanFine, balanceAfter, nextLoanStatus, now, auth.fullName, loan.loan_id);

    // Route Interest & Fine automatically to member's Savings Ledger without altering principal balance
    const interestPlusFine = roundMoney(interestPaid + finePaid);
    if (interestPlusFine > 0) {
      linkedSavingId = genId('SAV-INT');
      const savReceiptNo = `${receiptNo}-SAV`;
      const mappedPaymentStatus = paymentMode === 'Online' || paymentMode === 'UPI' || paymentMode === 'Bank' ? 'Online' : 'Cash';
      db.prepare(
        `INSERT INTO savings (
          id, saving_id, member_id, member_name, date, monthly_saving_amount, previous_saving_amount,
          interest, fine, total_saving, payment_status, payment_method, meeting_status, receipt_number,
          created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version, offline_operation_id
        ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'Saving', 'Present', ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
      ).run(
        linkedSavingId,
        linkedSavingId,
        loan.member_id,
        loan.member_name,
        txDate,
        interestPaid,
        finePaid,
        interestPlusFine,
        mappedPaymentStatus,
        savReceiptNo,
        now,
        now,
        auth.fullName,
        auth.fullName,
        now,
        body.operationId || ''
      );

      postFinancialLedger({
        module: 'saving_register',
        recordId: linkedSavingId,
        memberId: loan.member_id,
        entryType: 'LOAN_INTEREST_FINE_TO_SAVINGS',
        amount: interestPlusFine,
        direction: 'CREDIT',
        description: `Loan ${loan.loan_number} Interest (₹${interestPaid}) + Fine (₹${finePaid}) deposited to Savings`,
        idempotencyKey: `SAV-LREP-${repaymentId}`,
        createdBy: auth.fullName,
      });
    }

    db.prepare(
      `INSERT INTO loan_repayments (
        id, repayment_id, loan_id, loan_number, member_id, member_name, date,
        loan_balance_before, principal_paid, interest_paid, fine_paid, total_paid, loan_balance_after,
        payment_mode, member_signature_url, secretary_signature_url, president_signature_url, photo_url,
        receipt_number, saving_id, notes, created_date, updated_date, created_by, updated_by,
        sync_status, last_synced_time, record_version, offline_operation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Synced', ?, 1, ?)`
    ).run(
      repaymentId, repaymentId, loan.loan_id, loan.loan_number, loan.member_id, loan.member_name, txDate,
      balanceBefore, principalPaid, interestPaid, finePaid, totalPaid, balanceAfter,
      paymentMode, body.memberSignatureUrl || '', body.secretarySignatureUrl || '', body.presidentSignatureUrl || '', body.photoUrl || '',
      receiptNo, linkedSavingId, body.notes || '', now, now, auth.fullName, auth.fullName, now, body.operationId || ''
    );

    db.prepare(
      `INSERT INTO receipts (id, receipt_number, receipt_type, member_id, member_name, date, amount, payment_method, details, verification_status, authorized_by, created_at)
       VALUES (?, ?, 'Loan Repayment', ?, ?, ?, ?, ?, ?, 'Verified', ?, ?)`
    ).run(
      receiptNo,
      receiptNo,
      loan.member_id,
      loan.member_name,
      txDate,
      totalPaid,
      paymentMode,
      `Loan ${loan.loan_number}: Principal ₹${principalPaid} (Bal ₹${balanceAfter}) | Interest ₹${interestPaid} + Fine ₹${finePaid} -> Savings`,
      auth.fullName,
      now
    );

    postFinancialLedger({
      module: 'loan_repayment',
      recordId: repaymentId,
      memberId: loan.member_id,
      entryType: 'LOAN_REPAYMENT',
      amount: totalPaid,
      direction: 'CREDIT',
      description: `Loan repayment ${repaymentId} for ${loan.loan_number}`,
      idempotencyKey: body.operationId || `LREP-${repaymentId}`,
      createdBy: auth.fullName,
    });
  });

  tx();

  createNotification({
    targetRole: 'Member',
    targetMemberId: loan.member_id,
    type: 'Loan Repayment',
    title: `Loan Repayment Recorded (${loan.loan_number})`,
    message: `Principal ₹${principalPaid} deducted (Remaining ₹${balanceAfter}). Interest/Fine ₹${roundMoney(interestPaid + finePaid)} credited to Savings.`,
    relatedId: repaymentId,
  });

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'CREATE_LOAN_REPAYMENT',
    module: 'LoanRepayment',
    recordId: repaymentId,
    updatedValue: { loanId: loan.loan_id, principalPaid, interestPaid, finePaid, balanceAfter, linkedSavingId },
    sessionInfo: auth.sessionId,
  });

  return {
    repayment: mapLoanRepayment(db.prepare('SELECT * FROM loan_repayments WHERE repayment_id = ?').get(repaymentId)),
    loan: mapLoan(db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(loan.loan_id)),
  };
}

function updateLoanRepaymentRecord(repaymentId: string, body: any, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const existing = db.prepare('SELECT * FROM loan_repayments WHERE repayment_id = ?').get(repaymentId) as any;
  if (!existing) throw new Error('Loan repayment record not found.');
  const loan = db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(existing.loan_id) as any;
  if (!loan) throw new Error('Parent loan record not found.');

  const newPrincipal = roundMoney(Number(body.principalPaid ?? existing.principal_paid));
  const newInterest = roundMoney(Number(body.interestPaid ?? existing.interest_paid));
  const newFine = roundMoney(Number(body.finePaid ?? existing.fine_paid));
  if (newPrincipal < 0 || newInterest < 0 || newFine < 0 || newPrincipal + newInterest + newFine <= 0) {
    throw new Error('Repayment amounts must be non-negative and total greater than zero.');
  }

  const principalDelta = roundMoney(newPrincipal - Number(existing.principal_paid));
  const interestDelta = roundMoney(newInterest - Number(existing.interest_paid));
  const fineDelta = roundMoney(newFine - Number(existing.fine_paid));
  const nextLoanBalance = roundMoney(Number(loan.current_loan_balance) - principalDelta);

  if (nextLoanBalance < 0) {
    throw new Error('Updated principal exceeds remaining loan balance.');
  }

  const now = new Date().toISOString();
  const totalPaid = roundMoney(newPrincipal + newInterest + newFine);
  const paymentMode = body.paymentMode || existing.payment_mode;
  const txDate = body.date || existing.date;
  let savingId = existing.saving_id || '';

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE loans SET
        loan_repayment = MAX(0, loan_repayment + ?),
        interest = MAX(0, interest + ?),
        fine = MAX(0, fine + ?),
        current_loan_balance = ?,
        loan_status = ?,
        updated_date = ?, updated_by = ?, record_version = record_version + 1
       WHERE loan_id = ?`
    ).run(
      principalDelta,
      interestDelta,
      fineDelta,
      nextLoanBalance,
      nextLoanBalance === 0 ? 'Close' : 'Active',
      now,
      auth.fullName,
      loan.loan_id
    );

    const newInterestPlusFine = roundMoney(newInterest + newFine);
    if (savingId) {
      if (newInterestPlusFine > 0) {
        db.prepare(
          `UPDATE savings SET date = ?, interest = ?, fine = ?, total_saving = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1 WHERE saving_id = ?`
        ).run(txDate, newInterest, newFine, newInterestPlusFine, now, auth.fullName, savingId);
      } else {
        db.prepare('DELETE FROM savings WHERE saving_id = ?').run(savingId);
        savingId = '';
      }
    } else if (newInterestPlusFine > 0) {
      savingId = genId('SAV-INT');
      const mappedPaymentStatus = paymentMode === 'Online' || paymentMode === 'UPI' || paymentMode === 'Bank' ? 'Online' : 'Cash';
      db.prepare(
        `INSERT INTO savings (
          id, saving_id, member_id, member_name, date, monthly_saving_amount, previous_saving_amount,
          interest, fine, total_saving, payment_status, payment_method, meeting_status, receipt_number,
          created_date, updated_date, created_by, updated_by, sync_status, last_synced_time, record_version
        ) VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, 'Saving', 'Present', ?, ?, ?, ?, ?, 'Synced', ?, 1)`
      ).run(
        savingId, savingId, loan.member_id, loan.member_name, txDate,
        newInterest, newFine, newInterestPlusFine, mappedPaymentStatus,
        `${existing.receipt_number}-SAV`, now, now, auth.fullName, auth.fullName, now
      );
    }

    db.prepare(
      `UPDATE loan_repayments SET
        date = ?, principal_paid = ?, interest_paid = ?, fine_paid = ?, total_paid = ?,
        loan_balance_after = ?, payment_mode = ?, member_signature_url = ?,
        secretary_signature_url = ?, president_signature_url = ?, photo_url = ?,
        saving_id = ?, notes = ?, updated_date = ?, updated_by = ?, record_version = record_version + 1
       WHERE repayment_id = ?`
    ).run(
      txDate,
      newPrincipal,
      newInterest,
      newFine,
      totalPaid,
      nextLoanBalance,
      paymentMode,
      body.memberSignatureUrl ?? existing.member_signature_url,
      body.secretarySignatureUrl ?? existing.secretary_signature_url,
      body.presidentSignatureUrl ?? existing.president_signature_url,
      body.photoUrl ?? existing.photo_url,
      savingId,
      body.notes ?? existing.notes,
      now,
      auth.fullName,
      repaymentId
    );
  });

  tx();

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'UPDATE_LOAN_REPAYMENT',
    module: 'LoanRepayment',
    recordId: repaymentId,
    previousValue: { principalPaid: existing.principal_paid, interestPaid: existing.interest_paid, finePaid: existing.fine_paid },
    updatedValue: { principalPaid: newPrincipal, interestPaid: newInterest, finePaid: newFine, nextLoanBalance },
    sessionInfo: auth.sessionId,
  });

  return {
    repayment: mapLoanRepayment(db.prepare('SELECT * FROM loan_repayments WHERE repayment_id = ?').get(repaymentId)),
    loan: mapLoan(db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(loan.loan_id)),
  };
}

function deleteLoanRepaymentRecord(repaymentId: string, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const existing = db.prepare('SELECT * FROM loan_repayments WHERE repayment_id = ?').get(repaymentId) as any;
  if (!existing) throw new Error('Loan repayment record not found.');
  const loan = db.prepare('SELECT * FROM loans WHERE loan_id = ?').get(existing.loan_id) as any;
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    if (loan) {
      const restoredBalance = roundMoney(Number(loan.current_loan_balance || 0) + Number(existing.principal_paid || 0));
      db.prepare(
        `UPDATE loans SET
          loan_repayment = MAX(0, loan_repayment - ?),
          interest = MAX(0, interest - ?),
          fine = MAX(0, fine - ?),
          current_loan_balance = ?,
          loan_status = ?,
          updated_date = ?, updated_by = ?, record_version = record_version + 1
         WHERE loan_id = ?`
      ).run(
        Number(existing.principal_paid || 0),
        Number(existing.interest_paid || 0),
        Number(existing.fine_paid || 0),
        restoredBalance,
        restoredBalance > 0 ? 'Active' : loan.loan_status,
        now,
        auth.fullName,
        loan.loan_id
      );
    }
    if (existing.saving_id) {
      db.prepare('DELETE FROM savings WHERE saving_id = ?').run(existing.saving_id);
    }
    db.prepare('DELETE FROM loan_repayments WHERE repayment_id = ?').run(repaymentId);
  });

  tx();

  writeAuditLog({
    userId: auth.userId,
    userName: auth.fullName,
    userRole: auth.role,
    action: 'DELETE_LOAN_REPAYMENT',
    module: 'LoanRepayment',
    recordId: repaymentId,
    previousValue: {
      loanId: existing.loan_id,
      principalPaid: existing.principal_paid,
      interestPaid: existing.interest_paid,
      finePaid: existing.fine_paid,
    },
    sessionInfo: auth.sessionId,
  });

  return { ok: true, repaymentId };
}

function mapSyncModuleToPermissionKey(module: string): any {
  const map: Record<string, string> = {
    members: 'member_register',
    savings: 'saving_register',
    loans: 'loan_register',
    loan_repayments: 'loan_repayment',
    cash_book: 'cash_book',
    shares: 'share_register',
    attendance: 'attendance',
    loan_applications: 'loan_application',
    online_payments: 'online_payment',
    meetings: 'meetings',
    notices: 'notices',
  };
  return map[module] || null;
}

function checkAndApplySyncUpdate(op: PendingSyncOperation, auth: NonNullable<AuthenticatedRequest['auth']>) {
  const now = new Date().toISOString();
  if (op.module === 'members') {
    const existing = db.prepare('SELECT * FROM members WHERE member_id = ?').get(op.recordId) as any;
    if (!existing) throw new Error('Member record not found on server.');
    if (Number(existing.record_version) > Number(op.baseVersion)) {
      return {
        serverVersion: Number(existing.record_version),
        serverRecord: mapMember(existing, auth.role, auth.memberId),
        localRecord: op.payload,
        modifiedBy: existing.updated_by,
        lastModifiedTime: existing.updated_date,
      };
    }
    const p = op.payload as any;
    db.prepare(
      `UPDATE members SET village = COALESCE(?, village), post_office = COALESCE(?, post_office), gmail_id = COALESCE(?, gmail_id), updated_date = ?, updated_by = ?, record_version = record_version + 1 WHERE member_id = ?`
    ).run(p.village, p.postOffice, p.gmailId, now, auth.fullName, op.recordId);
    return null;
  }
  if (op.module === 'savings') {
    const existing = db.prepare('SELECT * FROM savings WHERE saving_id = ?').get(op.recordId) as any;
    if (!existing) throw new Error('Saving record not found on server.');
    if (Number(existing.record_version) > Number(op.baseVersion)) {
      return {
        serverVersion: Number(existing.record_version),
        serverRecord: mapSaving(existing),
        localRecord: op.payload,
        modifiedBy: existing.updated_by,
        lastModifiedTime: existing.updated_date,
      };
    }
  }
  return null;
}

function computeDashboardStats(memberId?: string): DashboardStats {
  const now = new Date().toISOString();
  const currentMonth = now.slice(0, 7);

  if (memberId) {
    const savAll = db.prepare('SELECT COALESCE(SUM(total_saving), 0) as total, COALESCE(SUM(interest), 0) as interest, COALESCE(SUM(fine), 0) as fine FROM savings WHERE member_id = ?').get(memberId) as any;
    const savMonth = db.prepare('SELECT COALESCE(SUM(monthly_saving_amount), 0) as total FROM savings WHERE member_id = ? AND date LIKE ?').get(memberId, `${currentMonth}%`) as any;
    const shr = db.prepare('SELECT COALESCE(SUM(number_of_shares), 0) as qty, COALESCE(SUM(total_share_value), 0) as val FROM shares WHERE member_id = ?').get(memberId) as any;
    const lns = db.prepare('SELECT COALESCE(SUM(loan_amount), 0) as disbursed, COALESCE(SUM(current_loan_balance), 0) as bal, COALESCE(SUM(loan_repayment), 0) as repaid, COALESCE(SUM(interest), 0) as interest, COALESCE(SUM(fine), 0) as fine FROM loans WHERE member_id = ?').get(memberId) as any;
    const pendApp = db.prepare("SELECT COUNT(*) as c FROM loan_applications WHERE member_id = ? AND application_status IN ('Pending', 'Under Review', 'Recommended')").get(memberId) as { c: number };
    const pendPay = db.prepare("SELECT COUNT(*) as c FROM online_payments WHERE member_id = ? AND verification_status = 'Pending'").get(memberId) as { c: number };
    const totApp = (db.prepare('SELECT COUNT(*) as c FROM loan_applications WHERE member_id = ?').get(memberId) as { c: number }).c;
    const totPay = (db.prepare('SELECT COUNT(*) as c FROM online_payments WHERE member_id = ?').get(memberId) as { c: number }).c;
    const totRepay = (db.prepare('SELECT COUNT(*) as c FROM loan_repayments WHERE member_id = ?').get(memberId) as { c: number }).c;

    return {
      totalMembers: 1,
      activeMembers: 1,
      inactiveMembers: 0,
      totalMonthlySavings: roundMoney(savMonth.total),
      totalSavings: roundMoney(savAll.total),
      totalShares: Number(shr.qty || 0),
      totalShareValue: roundMoney(shr.val),
      totalLoanDisbursed: roundMoney(lns.disbursed),
      totalLoanBalance: roundMoney(lns.bal),
      totalLoanInterest: roundMoney(lns.interest),
      totalLoanFine: roundMoney(lns.fine),
      totalLoanRepaid: roundMoney(lns.repaid),
      activeLoans: 0,
      closedLoans: 0,
      inactiveLoans: 0,
      totalBankBalance: 0,
      totalCashBalance: 0,
      totalCashDepositCount: 0,
      totalCashDepositAmount: 0,
      totalCashPaymentCount: 0,
      totalCashPaymentAmount: 0,
      totalLoanApplications: totApp,
      totalOnlinePayments: totPay,
      totalLoanRepayments: totRepay,
      pendingLoanApplications: pendApp.c,
      pendingOnlinePayments: pendPay.c,
      totalMeetings: 0,
      isLive: true,
      lastSyncedAt: now,
    };
  }

  const memTot = (db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number }).c;
  const memAct = (db.prepare("SELECT COUNT(*) as c FROM members WHERE account_status = 'Active'").get() as { c: number }).c;
  const savAll = db.prepare('SELECT COALESCE(SUM(total_saving), 0) as total FROM savings').get() as { total: number };
  const savMonth = db.prepare('SELECT COALESCE(SUM(monthly_saving_amount), 0) as total FROM savings WHERE date LIKE ?').get(`${currentMonth}%`) as { total: number };
  const shr = db.prepare('SELECT COALESCE(SUM(number_of_shares), 0) as qty, COALESCE(SUM(total_share_value), 0) as val FROM shares').get() as any;
  const lns = db.prepare('SELECT COALESCE(SUM(loan_amount), 0) as disbursed, COALESCE(SUM(current_loan_balance), 0) as bal, COALESCE(SUM(loan_repayment), 0) as repaid, COALESCE(SUM(interest), 0) as interest, COALESCE(SUM(fine), 0) as fine FROM loans').get() as any;
  const lnAct = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE loan_status IN ('Active', 'Running')").get() as { c: number }).c;
  const lnCls = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE loan_status = 'Close'").get() as { c: number }).c;
  const lnIna = (db.prepare("SELECT COUNT(*) as c FROM loans WHERE loan_status = 'Inactive'").get() as { c: number }).c;
  const { bankBalance, cashBalance } = getCurrentCashAndBankBalances();
  const cbDeposits = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(total_amount), 0) as amt FROM cash_book WHERE payment_mode = 'Deposit'").get() as any;
  const cbPayments = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(total_amount), 0) as amt FROM cash_book WHERE payment_mode = 'Payment'").get() as any;
  const totApp = (db.prepare('SELECT COUNT(*) as c FROM loan_applications').get() as { c: number }).c;
  const totPay = (db.prepare('SELECT COUNT(*) as c FROM online_payments').get() as { c: number }).c;
  const totRepay = (db.prepare('SELECT COUNT(*) as c FROM loan_repayments').get() as { c: number }).c;
  const pendApp = (db.prepare("SELECT COUNT(*) as c FROM loan_applications WHERE application_status IN ('Pending', 'Under Review', 'Recommended')").get() as { c: number }).c;
  const pendPay = (db.prepare("SELECT COUNT(*) as c FROM online_payments WHERE verification_status = 'Pending'").get() as { c: number }).c;
  const mtgTot = (db.prepare('SELECT COUNT(*) as c FROM meetings').get() as { c: number }).c;

  return {
    totalMembers: memTot,
    activeMembers: memAct,
    inactiveMembers: memTot - memAct,
    totalMonthlySavings: roundMoney(savMonth.total),
    totalSavings: roundMoney(savAll.total),
    totalShares: Number(shr.qty || 0),
    totalShareValue: roundMoney(shr.val),
    totalLoanDisbursed: roundMoney(lns.disbursed),
    totalLoanBalance: roundMoney(lns.bal),
    totalLoanInterest: roundMoney(lns.interest),
    totalLoanFine: roundMoney(lns.fine),
    totalLoanRepaid: roundMoney(lns.repaid),
    activeLoans: lnAct,
    closedLoans: lnCls,
    inactiveLoans: lnIna,
    totalBankBalance: bankBalance,
    totalCashBalance: cashBalance,
    totalCashDepositCount: Number(cbDeposits.c || 0),
    totalCashDepositAmount: roundMoney(cbDeposits.amt || 0),
    totalCashPaymentCount: Number(cbPayments.c || 0),
    totalCashPaymentAmount: roundMoney(cbPayments.amt || 0),
    totalLoanApplications: totApp,
    totalOnlinePayments: totPay,
    totalLoanRepayments: totRepay,
    pendingLoanApplications: pendApp,
    pendingOnlinePayments: pendPay,
    totalMeetings: mtgTot,
    isLive: true,
    lastSyncedAt: now,
  };
}
