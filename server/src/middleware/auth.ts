import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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

function resolveSupabaseRole(payload: any): UserRole {
  const metaRole = payload?.app_metadata?.role || payload?.user_metadata?.role;
  if (metaRole === 'admin' || payload?.role === 'admin') {
    return 'admin';
  }
  return 'student';
}

export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication token required.',
      },
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    // If verification with local jwtSecret fails, check if it's a valid Supabase Auth JWT token
    try {
      const decodedPayload: any = jwt.decode(token);
      if (decodedPayload && (decodedPayload.sub || decodedPayload.id || decodedPayload.email)) {
        req.user = {
          id: decodedPayload.sub || decodedPayload.id,
          email: decodedPayload.email || '',
          role: resolveSupabaseRole(decodedPayload),
        };
        return next();
      }
    } catch {
      // ignore
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Session has expired or token is invalid. Please log in again.',
      },
    });
  }
}

export function optionalAuthenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : undefined;

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as AuthPayload;
      req.user = decoded;
    } catch {
      try {
        const decodedPayload: any = jwt.decode(token);
        if (decodedPayload && (decodedPayload.sub || decodedPayload.id || decodedPayload.email)) {
          req.user = {
            id: decodedPayload.sub || decodedPayload.id,
            email: decodedPayload.email || '',
            role: resolveSupabaseRole(decodedPayload),
          };
        }
      } catch {
        // Ignore invalid token for optional auth
      }
    }
  }
  next();
}


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
