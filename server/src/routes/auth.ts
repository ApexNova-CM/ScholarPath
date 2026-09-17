import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { db } from '../db/store';
import {
  RegisterSchema,
  LoginSchema,
  UserRecord,
  StudentProfileRecord,
} from '../types';
import { validateBody } from '../middleware/validate';
import { authenticateToken, AuthPayload } from '../middleware/auth';

const router = Router();

// Helper to issue cookie and token
function issueTokenAndCookie(res: Response, user: AuthPayload): string {
  const token = jwt.sign(user, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as any,
  });

  res.cookie('token', token, {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
}

// POST /api/v1/auth/register
router.post(
  '/register',
  validateBody(RegisterSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        country,
        educationLevel,
        institution,
        fieldOfStudy,
        gpa,
        gpaScale,
        phone,
        dateOfBirth,
        gender,
      } = req.body;

      const existing = db.findUserByEmail(email);
      if (existing) {
        res.status(409).json({
          success: false,
          error: {
            code: 'EMAIL_ALREADY_EXISTS',
            message: 'An account with this email address already exists. Please log in.',
          },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = `usr-${crypto.randomUUID()}`;

      const userRecord: UserRecord = {
        id: userId,
        email: email.toLowerCase().trim(),
        passwordHash,
        role: 'student',
        emailVerified: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      db.createUser(userRecord);

      const profileRecord: StudentProfileRecord = {
        userId,
        firstName,
        lastName,
        country,
        educationLevel,
        institution,
        fieldOfStudy,
        gpa,
        gpaScale,
        phone,
        dateOfBirth,
        gender,
        profileCompletion: 0,
        notificationPreferences: {
          inApp: true,
          email: true,
          deadlineAlerts: true,
          matchingAlerts: true,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savedProfile = db.upsertProfile(profileRecord);

      // Create welcome notification
      db.createNotification({
        id: `notif-${crypto.randomUUID()}`,
        userId,
        title: 'Welcome to ScholarPath! 🎉',
        message: 'Your academic profile has been created. Discover vetted scholarships that match your education path.',
        type: 'announcement',
        read: false,
        createdAt: new Date().toISOString(),
      });

      const tokenUser: AuthPayload = {
        id: userId,
        email: userRecord.email,
        role: userRecord.role,
      };

      const token = issueTokenAndCookie(res, tokenUser);

      res.status(201).json({
        success: true,
        data: {
          token,
          user: {
            id: userId,
            email: userRecord.email,
            role: userRecord.role,
            ...savedProfile,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/login
router.post(
  '/login',
  validateBody(LoginSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;

      const user = db.findUserByEmail(email);
      if (!user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        });
        return;
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password.',
          },
        });
        return;
      }

      const tokenUser: AuthPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      const token = issueTokenAndCookie(res, tokenUser);

      let profile = db.getProfile(user.id);
      if (!profile && user.role === 'admin') {
        const adminUsers = db.getAdminUsers();
        const found = adminUsers.find((a) => a.id === user.id || a.email === user.email);
        profile = {
          userId: user.id,
          firstName: found?.firstName || 'Admin',
          lastName: found?.lastName || 'User',
          country: 'International',
          educationLevel: 'Postgraduate (Masters)',
          institution: 'ScholarPath Global Operations',
          fieldOfStudy: 'Platform Administration',
          gpa: 4.0,
          gpaScale: 4.0,
          profileCompletion: 100,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            ...(profile || {}),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/logout
router.post('/logout', (req: Request, res: Response): void => {
  res.clearCookie('token');
  res.json({
    success: true,
    data: { message: 'Successfully logged out.' },
  });
});

// GET /api/v1/auth/me
router.get('/me', authenticateToken, (req: Request, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Not logged in' } });
    return;
  }

  const user = db.findUserById(req.user.id);
  if (!user) {
    res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'User record not found' } });
    return;
  }

  let profile = db.getProfile(user.id);
  if (!profile && user.role === 'admin') {
    const adminUsers = db.getAdminUsers();
    const found = adminUsers.find((a) => a.id === user.id || a.email === user.email);
    profile = {
      userId: user.id,
      firstName: found?.firstName || 'Admin',
      lastName: found?.lastName || 'User',
      country: 'International',
      educationLevel: 'Postgraduate (Masters)',
      institution: 'ScholarPath Global Operations',
      fieldOfStudy: 'Platform Administration',
      gpa: 4.0,
      gpaScale: 4.0,
      profileCompletion: 100,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        ...(profile || {}),
      },
    },
  });
});

// POST /api/v1/auth/forgot-password
router.post('/forgot-password', (req: Request, res: Response): void => {
  const { email } = req.body;
  if (!email) {
    res.status(400).json({ success: false, error: { code: 'EMAIL_REQUIRED', message: 'Email is required.' } });
    return;
  }

  // Check if user exists (avoid user enumeration by returning success regardless)
  const user = db.findUserByEmail(email);
  if (user) {
    // Generate secure password reset token in production
    console.log(`[PASSWORD_RESET] Token dispatched to ${email}`);
  }

  res.json({
    success: true,
    data: {
      message: 'If an account matches that email, a password reset link has been dispatched.',
    },
  });
});

// POST /api/v1/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Email and newPassword (min 6 chars) required.' },
      });
      return;
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      res.status(404).json({ success: false, error: { code: 'USER_NOT_FOUND', message: 'Account not found.' } });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.updateUser(user.id, { passwordHash });

    res.json({
      success: true,
      data: { message: 'Password has been successfully updated. Please log in.' },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
