import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
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
    if (!supabase) {
      // Supabase not configured — fall back to 'student' (safe default)
      return 'student';
    }
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return 'student';
    return (data.role as string) === 'admin' ? 'admin' : 'student';
  } catch {
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

  let identity: { id: string; email: string } | null = null;

  // ── Path 1: verify with Railway JWT_SECRET (custom-issued tokens) ──────────
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    identity = extractTokenIdentity(decoded);
  } catch {
    // ── Path 2: Supabase JWT — decode without verification ─────────────────
    try {
      const decoded: any = jwt.decode(token);
      if (decoded && (decoded.sub || decoded.id || decoded.email)) {
        identity = extractTokenIdentity(decoded);
      }
    } catch {
      // ignore
    }
  }

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
    let identity: { id: string; email: string } | null = null;

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      identity = extractTokenIdentity(decoded);
    } catch {
      try {
        const decoded: any = jwt.decode(token);
        if (decoded && (decoded.sub || decoded.id || decoded.email)) {
          identity = extractTokenIdentity(decoded);
        }
      } catch {
        // Ignore invalid token for optional auth
      }
    }

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
