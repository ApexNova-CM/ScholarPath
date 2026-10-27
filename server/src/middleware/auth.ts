import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { db } from '../db/store';
import { UserRole } from '../types';

export interface AuthPayload {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

// ─── Supabase service-role client (same pattern as payments.ts) ───────────────
// Used to look up public.users.role — the single authoritative source of
// application roles. Created lazily; returns null if env vars are absent.
function getSupabaseAdminClient() {
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) return null;
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Resolve application role from public.users ───────────────────────────────
// This is the ONLY authoritative source for Scholavon application roles.
// JWT metadata claims (app_metadata.role, user_metadata.role) are NOT trusted
// because they can contain stale or incorrectly provisioned values.
// Defaults to 'student' on any error or missing row — never grants admin by accident.
async function resolveRoleFromDatabase(userId: string): Promise<UserRole> {
  if (!userId) return 'student';
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data && data.role) {
        return (data.role as string) === 'admin' ? 'admin' : 'student';
      }
    }
    // Fallback to local store for development/testing when Supabase is unconfigured
    const localUser = db.findUserById(userId);
    if (localUser) {
      return localUser.role === 'admin' ? 'admin' : 'student';
    }
    return 'student';
  } catch {
    const localUser = db.findUserById(userId);
    if (localUser) {
      return localUser.role === 'admin' ? 'admin' : 'student';
    }
    return 'student';
  }
}

// ─── Extract base identity fields from a decoded JWT ─────────────────────────
// Role is intentionally NOT sourced from the JWT — it comes from the database.
function extractTokenIdentity(decoded: any): { id: string; email: string } {
  return {
    id: String(decoded?.sub || decoded?.id || ''),
    email: String(decoded?.email || ''),
  };
}

// ─── Authenticate and verify identity from token ────────────────────────────
// Dual-path verification:
// 1. Verify custom-issued token using config.jwtSecret with HS256 algorithm.
// 2. If not custom, verify Supabase access token via Supabase Auth API (getUser).
// Unverified token decoding (jwt.decode) is strictly prohibited.
async function verifyTokenIdentity(token: string): Promise<{ id: string; email: string } | null> {
  // ── Path 1: verify with Railway JWT_SECRET (custom-issued tokens) ──────────
  if (config.jwtSecret) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
      const identity = extractTokenIdentity(decoded);
      if (identity.id) {
        return identity;
      }
    } catch {
      // Not a valid custom JWT or signature mismatch/expired, proceed to Path 2
    }
  }

  // ── Path 2: Supabase JWT — verify with Supabase Auth API ──────────────────
  try {
    const supabase = getSupabaseAdminClient();
    if (supabase) {
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data && data.user && data.user.id) {
        return {
          id: data.user.id,
          email: data.user.email || '',
        };
      }
    }
  } catch {
    // Supabase validation failed or service unavailable
  }

  return null;
}

// ─── authenticateToken ────────────────────────────────────────────────────────
// Validates the bearer token, then resolves the application role from
// public.users. Any authenticated user without a DB row defaults to 'student'.
export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication token required.' },
    });
    return;
  }

  const identity = await verifyTokenIdentity(token);

  if (!identity || !identity.id) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Session has expired or token is invalid. Please log in again.',
      },
    });
    return;
  }

  // ── Resolve authoritative role from public.users ───────────────────────────
  const role = await resolveRoleFromDatabase(identity.id);
  req.user = { id: identity.id, email: identity.email, role };
  next();
}

// ─── optionalAuthenticateToken ────────────────────────────────────────────────
// Same token validation + DB role lookup, but does not reject unauthenticated
// requests. Sets req.user if a valid token is present; otherwise continues.
export async function optionalAuthenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    const identity = await verifyTokenIdentity(token);

    if (identity && identity.id) {
      const role = await resolveRoleFromDatabase(identity.id);
      req.user = { id: identity.id, email: identity.email, role };
    }
  }

  next();
}

// ─── requireRole ──────────────────────────────────────────────────────────────
export function requireRole(role: UserRole) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    if (req.user.role !== role) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: `Access denied. Requires '${role}' privilege.`,
        },
      });
      return;
    }

    next();
  };
}

// ─── requireOwnership ─────────────────────────────────────────────────────────
export function requireOwnership(paramKey = 'userId') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
      });
      return;
    }

    const targetUserId = req.params[paramKey] || req.body[paramKey];
    if (req.user.role !== 'admin' && req.user.id !== targetUserId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You do not have permission to access or modify this resource.',
        },
      });
      return;
    }

    next();
  };
}
