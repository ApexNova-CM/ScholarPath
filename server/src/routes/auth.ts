import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { db } from '../db/store';
import {
  RegisterSchema,
  LoginSchema,
  UserRecord,
  StudentProfileRecord,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  PasswordResetTokenRecord,
} from '../types';
import { validateBody } from '../middleware/validate';
import { authenticateToken, AuthPayload } from '../middleware/auth';
import { emailService } from '../services/emailService';

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
        applicantStage,
        secondarySchoolName,
        secondaryGraduationYear,
        targetMajor,
        tradeSpecialization,
        tradeCertifications,
        yearsOfExperience,
        targetIndustry,
        skills,
        portfolioUrl,
        linkedinUrl,
        githubUrl,
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
        country: country || 'International',
        applicantStage,
        secondarySchoolName,
        secondaryGraduationYear,
        targetMajor,
        tradeSpecialization,
        tradeCertifications: tradeCertifications || [],
        yearsOfExperience,
        targetIndustry,
        skills: skills || [],
        portfolioUrl,
        linkedinUrl,
        githubUrl,
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

      // Sync to Supabase users table if configured
      if (config.supabaseUrl && config.supabaseServiceRoleKey) {
        try {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          await supabase.from('users').upsert({
            id: userId,
            email: userRecord.email,
            role: 'student',
            first_name: firstName,
            last_name: lastName,
            country: country || 'International',
            applicant_stage: applicantStage || null,
            secondary_school_name: secondarySchoolName || null,
            secondary_graduation_year: secondaryGraduationYear || null,
            target_major: targetMajor || null,
            trade_specialization: tradeSpecialization || null,
            trade_certifications: tradeCertifications || [],
            years_of_experience: yearsOfExperience || 0,
            target_industry: targetIndustry || null,
            skills: skills || [],
            portfolio_url: portfolioUrl || null,
            linkedin_url: linkedinUrl || null,
            github_url: githubUrl || null,
            education_level: educationLevel || null,
            institution: institution || null,
            field_of_study: fieldOfStudy || null,
            gpa: gpa !== undefined ? gpa : null,
            gpa_scale: gpaScale !== undefined ? gpaScale : null,
            profile_completion: 0,
          }, { onConflict: 'id' });
        } catch (err) {
          console.warn('[auth] error syncing new user to Supabase:', err);
        }
      }

      // Create welcome notification
      db.createNotification({
        id: `notif-${crypto.randomUUID()}`,
        userId,
        title: 'Welcome to Scholavon! 🎉',
        message: 'Your academic profile has been created. Discover vetted scholarships that match your education path.',
        type: 'announcement',
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Send welcome email (non-critical — failure does not block registration)
      emailService.sendWelcome(userRecord.email, firstName, userId).catch(() => {
        // already logged inside sendWelcome
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
          institution: 'Scholavon Global Operations',
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
      institution: 'Scholavon Global Operations',
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

// DELETE /api/v1/auth/account
// Authenticated self-deletion. Identity comes exclusively from req.user (the
// verified token) — no userId is ever accepted from the request body.
router.delete(
  '/account',
  authenticateToken,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user || !req.user.id) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required to delete account.',
          },
        });
        return;
      }

      const userId = req.user.id;

      // 1. Supabase cleanup (if configured)
      if (config.supabaseUrl && config.supabaseServiceRoleKey) {
        try {
          const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          await supabase.from('users').delete().eq('id', userId);
          await supabase.auth.admin.deleteUser(userId);
        } catch (supabaseErr) {
          console.warn('[auth] Supabase account deletion note:', supabaseErr);
        }
      }

      // 2. Delete all flat-file data owned by this user (if present)
      db.deleteUserAccount(userId);

      // 3. Clear session cookie
      res.clearCookie('token');

      res.json({
        success: true,
        data: {
          message: 'Account deleted successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/forgot-password
router.post(
  '/forgot-password',
  validateBody(ForgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body as { email: string };
      const normalizedEmail = email.trim().toLowerCase();

      // Always return 200 to prevent user enumeration
      const successResponse = () =>
        res.json({
          success: true,
          data: {
            message:
              'If an account with that email exists, a password-reset link has been sent. Please check your inbox (and spam folder).',
          },
        });

      const user = db.findUserByEmail(normalizedEmail);
      if (!user) {
        successResponse();
        return;
      }

      // Retrieve first name from profile for the email greeting
      const profile = db.getProfile(user.id);
      const firstName = profile?.firstName || 'there';

      // Generate a cryptographically secure random token (32 bytes = 64 hex chars)
      const rawToken = crypto.randomBytes(32).toString('hex');

      // Store only the SHA-256 hash — the raw token travels by email only
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

      const ONE_HOUR_MS = 60 * 60 * 1000;
      const tokenRecord: PasswordResetTokenRecord = {
        tokenHash,
        userId: user.id,
        email: normalizedEmail,
        expiresAt: new Date(Date.now() + ONE_HOUR_MS).toISOString(),
        createdAt: new Date().toISOString(),
      };

      db.storePasswordResetToken(tokenRecord);

      const resetUrl = `${config.appUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(normalizedEmail)}`;

      const result = await emailService.sendPasswordReset(normalizedEmail, firstName, resetUrl, tokenHash);

      if (!result.accepted) {
        // Log provider failure server-side (without exposing sensitive tokens or credentials)
        // while still returning 200 to client to avoid leaking account existence.
        console.error(
          `[auth] Password reset email not accepted for ${normalizedEmail}: ${result.statusMessage}`
        );
      }

      successResponse();
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/v1/auth/reset-password
router.post(
  '/reset-password',
  validateBody(ResetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword } = req.body as { token: string; newPassword: string };

      // Hash the incoming token to compare with the stored hash
      const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex');
      const record = db.consumePasswordResetToken(tokenHash);

      if (!record) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_OR_EXPIRED_TOKEN',
            message:
              'This password-reset link is invalid or has expired. Please request a new one.',
          },
        });
        return;
      }

      const user = db.findUserById(record.userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'Account not found.' },
        });
        return;
      }

      const passwordHash = await bcrypt.hash(newPassword, 10);
      db.updateUser(user.id, { passwordHash });

      res.json({
        success: true,
        data: { message: 'Your password has been updated successfully. You can now log in.' },
      });
    } catch (err) {
      next(err);
    }
  }
);


export default router;
