import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { DATA_DIR, db, getRolePermissions, writeAuditLog } from './db.ts';
import type { ModuleKey, SystemUserRecord, UserRole } from '../src/types.ts';

const SECRET_FILE = path.join(DATA_DIR, '.jwt_secret');

function getJwtSecret(): string {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 16) {
    return process.env.JWT_SECRET;
  }
  if (fs.existsSync(SECRET_FILE)) {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim();
  }
  if (process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
    const seed = process.env.VERCEL_PROJECT_ID || process.env.GOOGLE_SPREADSHEET_ID || 'gmcsl-2026-vercel-jwt-key';
    return crypto.createHash('sha256').update(seed).digest('hex');
  }
  const generated = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, generated, { mode: 0o600 });
  return generated;
}

const JWT_SECRET = getJwtSecret();
const SESSION_DURATION_HOURS = 24;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    role: UserRole;
    memberId: string;
    fullName: string;
    sessionId: string;
  };
}

export function hashSecret(plain: string): string {
  return bcrypt.hashSync(plain, 12);
}

export function verifySecret(plain: string, hash: string): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

export function mapUserRow(row: any): SystemUserRecord {
  return {
    id: row.id,
    userId: row.user_id,
    role: row.role as UserRole,
    memberId: row.member_id || undefined,
    fullName: row.full_name,
    email: row.email || '',
    mobileNumber: row.mobile_number || '',
    accountStatus: row.account_status,
    isLocked: Boolean(row.is_locked),
    failedAttempts: Number(row.failed_attempts || 0),
    lockedUntil: row.locked_until || undefined,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function checkLockout(userRow: any): { locked: boolean; message?: string } {
  if (userRow.is_locked) {
    return { locked: true, message: 'Account is locked by System Administrator. Contact System Admin to unlock.' };
  }
  if (userRow.locked_until) {
    const until = new Date(userRow.locked_until).getTime();
    if (Date.now() < until) {
      const mins = Math.ceil((until - Date.now()) / 60000);
      return { locked: true, message: `Too many failed login attempts. Try again in ${mins} minute(s).` };
    }
    db.prepare('UPDATE system_users SET failed_attempts = 0, locked_until = ? WHERE id = ?').run('', userRow.id);
  }
  return { locked: false };
}

export function recordFailedAttempt(userRow: any, sessionInfo: string) {
  const attempts = Number(userRow.failed_attempts || 0) + 1;
  let lockedUntil = '';
  if (attempts >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000).toISOString();
  }
  db.prepare('UPDATE system_users SET failed_attempts = ?, locked_until = ?, updated_at = ? WHERE id = ?').run(
    attempts,
    lockedUntil,
    new Date().toISOString(),
    userRow.id
  );
  writeAuditLog({
    userId: userRow.user_id,
    userName: userRow.full_name,
    userRole: userRow.role,
    action: lockedUntil ? 'ACCOUNT_TEMP_LOCKOUT' : 'LOGIN_FAILED',
    module: 'Authentication',
    recordId: userRow.user_id,
    updatedValue: { attempts, lockedUntil },
    sessionInfo,
  });
}

export function issueSessionToken(userRow: any, deviceInfo: string) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const sessionId = `SES-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  db.prepare('UPDATE system_users SET failed_attempts = 0, locked_until = ?, last_login_at = ?, updated_at = ? WHERE id = ?').run(
    '',
    now.toISOString(),
    now.toISOString(),
    userRow.id
  );

  db.prepare(
    `INSERT INTO session_logs (id, session_id, user_id, user_role, user_name, login_time, expires_at, is_active, device_info)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    sessionId,
    sessionId,
    userRow.user_id,
    userRow.role,
    userRow.full_name,
    now.toISOString(),
    expiresAt.toISOString(),
    deviceInfo
  );

  const token = jwt.sign(
    {
      userId: userRow.user_id,
      role: userRow.role,
      memberId: userRow.member_id || '',
      fullName: userRow.full_name,
      sessionId,
    },
    JWT_SECRET,
    { expiresIn: `${SESSION_DURATION_HOURS}h` }
  );

  return {
    token,
    sessionId,
    issuedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    user: mapUserRow(userRow),
  };
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      role: UserRole;
      memberId: string;
      fullName: string;
      sessionId: string;
    };

    const session = db.prepare('SELECT is_active, expires_at FROM session_logs WHERE session_id = ?').get(decoded.sessionId) as
      | { is_active: number; expires_at: string }
      | undefined;

    if (!session || !session.is_active || new Date(session.expires_at).getTime() < Date.now()) {
      return res.status(401).json({ error: 'Session expired or revoked. Please log in again online.' });
    }

    const userRow = db.prepare('SELECT account_status, is_locked FROM system_users WHERE user_id = ?').get(decoded.userId) as
      | { account_status: string; is_locked: number }
      | undefined;
    if (!userRow || userRow.account_status !== 'Active' || userRow.is_locked) {
      return res.status(403).json({ error: 'Account is inactive or locked.' });
    }

    req.auth = decoded;
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role authorization.' });
    }
    return next();
  };
}

export function hasModulePermission(role: UserRole, moduleKey: ModuleKey, action: 'view' | 'add' | 'edit' | 'delete'): boolean {
  if (role === 'System') return true;
  const perms = getRolePermissions(role);
  const mod = perms.find((p) => p.moduleKey === moduleKey);
  if (!mod || mod.isHidden) return false;
  if (action === 'view') return mod.canView;
  if (action === 'add') return mod.canAdd;
  if (action === 'edit') return mod.canEdit;
  if (action === 'delete') return mod.canDelete;
  return false;
}

export function requirePermission(moduleKey: ModuleKey, action: 'view' | 'add' | 'edit' | 'delete') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!hasModulePermission(req.auth.role, moduleKey, action)) {
      return res.status(403).json({
        error: `Permission denied: ${req.auth.role} is not authorized to ${action} in ${moduleKey}.`,
      });
    }
    return next();
  };
}
