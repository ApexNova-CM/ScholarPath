import { config } from '../config';
import { db } from '../db/store';

/**
 * PRODUCTION_DOMAINS: Known production hostnames that must NEVER have test overrides enabled.
 */
export const PRODUCTION_DOMAINS = [
  'scholavon.com',
  'www.scholavon.com',
  'scholavon.org',
  'www.scholavon.org',
];

export const AUTHORIZED_TEST_EMAIL = 'apexnovacm@gmail.com';

/**
 * Evaluates whether the staging-only Plus test override is active for a given user.
 * 
 * FAIL-CLOSED SECURITY CONTRACT:
 * 1. Must be explicitly enabled via config (ALLOW_STAGING_PLUS_OVERRIDE === 'true').
 * 2. Must be in a verified non-production environment (NODE_ENV !== 'production').
 * 3. Must not be in a Railway or Vercel production deployment.
 * 4. Must not have appUrl or corsOrigin pointing to production domains.
 * 5. Configured override email must match AUTHORIZED_TEST_EMAIL.
 * 6. User's server-side verified email must match AUTHORIZED_TEST_EMAIL.
 * 
 * If ANY of these conditions fail or are ambiguous, returns false.
 */
export function isStagingPlusOverrideActive(
  userId: string,
  verifiedUserEmail?: string
): boolean {
  // 1. Explicit opt-in flag required
  if (!config.allowStagingPlusOverride) {
    return false;
  }

  // 2. Production deny-list: NODE_ENV, config.env, Railway, Vercel
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
  const configEnv = (config.env || '').toLowerCase().trim();
  const railwayEnv = (process.env.RAILWAY_ENVIRONMENT_NAME || '').toLowerCase().trim();
  const vercelEnv = (process.env.VERCEL_ENV || '').toLowerCase().trim();

  if (
    nodeEnv === 'production' ||
    configEnv === 'production' ||
    railwayEnv === 'production' ||
    vercelEnv === 'production'
  ) {
    return false;
  }

  // 3. Environment verification: Must be positively non-production ('staging', 'development', 'test', 'preview')
  const allowedEnvs = ['staging', 'development', 'test', 'preview'];
  const isRecognizedNonProd =
    allowedEnvs.includes(nodeEnv) ||
    allowedEnvs.includes(configEnv) ||
    allowedEnvs.includes(railwayEnv) ||
    allowedEnvs.includes(vercelEnv);

  if (!isRecognizedNonProd) {
    // Ambiguous environment — fail closed
    return false;
  }

  // 4. Production origin deny-list: config.appUrl and config.corsOrigin
  const appUrl = (config.appUrl || '').toLowerCase();
  const corsOrigin = (config.corsOrigin || '').toLowerCase();

  for (const domain of PRODUCTION_DOMAINS) {
    if (appUrl.includes(domain) || corsOrigin.includes(domain)) {
      return false;
    }
  }

  // 5. Override email configured must match authorized email
  const configuredEmail = (config.stagingPlusOverrideEmail || '').toLowerCase().trim();
  if (configuredEmail !== AUTHORIZED_TEST_EMAIL) {
    return false;
  }

  // 6. User's server-side verified email must match authorized email
  let resolvedEmail = (verifiedUserEmail || '').toLowerCase().trim();

  if (!resolvedEmail && userId) {
    // Fallback: check local store
    const localUser = db.findUserById(userId);
    if (localUser?.email) {
      resolvedEmail = localUser.email.toLowerCase().trim();
    }
  }

  if (resolvedEmail !== AUTHORIZED_TEST_EMAIL) {
    return false;
  }

  return true;
}
