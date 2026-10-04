import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '5000', 10),
  jwtSecret: process.env.JWT_SECRET || 'scholavon_super_secure_jwt_secret_dev_key_2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieSecret: process.env.COOKIE_SECRET || 'scholavon_cookie_signing_secret_dev_2026',
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  emailSender: process.env.EMAIL_SENDER_ADDRESS || 'scholarships@scholavon.org',
  geminiApiKey: process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '',

  // ── Paystack — server-side ONLY, never expose to frontend or VITE_ vars ──
  // Your Paystack secret key (sk_live_... or sk_test_...) from the dashboard.
  // Used for API calls AND for HMAC-SHA512 webhook signature verification.
  paystackSecretKey: process.env.PAYSTACK_SECRET_KEY || '',

  // ── Paystack Plan Codes — set in Railway, read from Paystack dashboard ────
  // These are the PLN_xxxxxxxxx codes of the recurring plans you created.
  paystackMonthlyPlanCode: process.env.PAYSTACK_MONTHLY_PLAN_CODE || '',
  paystackAnnualPlanCode: process.env.PAYSTACK_ANNUAL_PLAN_CODE || '',

  // ── Supabase Service Role — server-side ONLY, bypasses RLS for webhook ───
  supabaseUrl: process.env.VITE_SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',

  // ── App/Frontend URL (used to build Paystack callback_url) ───────────────
  appUrl: process.env.APP_URL || 'http://localhost:3000',
};
