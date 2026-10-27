/**
 * Scholavon Email Service
 *
 * Server-side only. Uses Resend (https://resend.com) as the email provider.
 * Activated by setting EMAIL_PROVIDER_API_KEY in your .env file.
 *
 * When no API key is configured the service logs a warning and resolves
 * gracefully — it never throws in non-critical paths (welcome email, reminder).
 * For security-critical paths (password reset) the caller must check
 * EmailSendResult.delivered and handle the failure.
 */

import { Resend } from 'resend';
import { config } from '../config';

export type EmailDeliveryStatus =
  | 'not_configured' // EMAIL_PROVIDER_API_KEY is not set
  | 'rejected'       // Provider returned an error / rejected request
  | 'accepted'       // Provider accepted the email into queue for delivery
  | 'failed';        // Unexpected runtime/network exception

export interface EmailSendResult {
  /** True when provider has accepted the message for queued delivery */
  accepted: boolean;
  /** Kept for backwards-compatibility; reflects provider acceptance (not webhook-confirmed inbox arrival) */
  delivered: boolean;
  status: EmailDeliveryStatus;
  statusMessage: string;
  messageId?: string;
}

// ─── HTML Templates ──────────────────────────────────────────────────────────

function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #f4f7fb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a2e; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2d6a9f 100%); padding: 32px 40px; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 700; color: #ffffff; letter-spacing: -0.3px; }
    .header p { margin: 4px 0 0; font-size: 13px; color: rgba(255,255,255,.75); }
    .body { padding: 36px 40px; }
    .body p { margin: 0 0 16px; font-size: 15px; line-height: 1.65; color: #374151; }
    .body p:last-child { margin-bottom: 0; }
    .cta { display: inline-block; margin: 20px 0; padding: 14px 28px; background: #2d6a9f; color: #ffffff !important; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .footer { padding: 20px 40px 28px; text-align: center; }
    .footer p { margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.6; }
    .footer a { color: #2d6a9f; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Scholavon</h1>
      <p>Opportunities Within Reach</p>
    </div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>
        © ${new Date().getFullYear()} Scholavon &bull;
        <a href="${config.appUrl}">scholavon.org</a><br />
        You are receiving this email because you have an account on Scholavon.<br />
        Questions? <a href="mailto:support@scholavon.com">support@scholavon.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildWelcomeEmail(firstName: string): { subject: string; html: string; text: string } {
  const subject = `Welcome to Scholavon, ${firstName}! 🎓`;

  const html = baseLayout('Welcome to Scholavon', `
    <p>Hi ${firstName},</p>
    <p>
      Welcome to <strong>Scholavon</strong> — your hub for scholarships, grants, fellowships, internships,
      and more opportunities within reach.
    </p>
    <p>Here's what you can do right now:</p>
    <p>
      ✅ &nbsp;<strong>Complete your profile</strong> to unlock personalised opportunity matching<br />
      🔍 &nbsp;<strong>Browse verified opportunities</strong> matched to your education level and country<br />
      📌 &nbsp;<strong>Save and track applications</strong> with built-in deadline reminders
    </p>
    <a class="cta" href="${config.appUrl}/dashboard">Go to your dashboard →</a>
    <hr class="divider" />
    <p>If you did not create this account, you can safely ignore this email.</p>
  `);

  const text = [
    `Hi ${firstName},`,
    '',
    `Welcome to Scholavon — your hub for scholarships, grants, and more opportunities within reach.`,
    '',
    `Visit your dashboard: ${config.appUrl}/dashboard`,
    '',
    `If you did not create this account, you can safely ignore this email.`,
    '',
    `— The Scholavon Team`,
  ].join('\n');

  return { subject, html, text };
}

export function buildPasswordResetEmail(
  firstName: string,
  resetUrl: string
): { subject: string; html: string; text: string } {
  const subject = 'Reset your Scholavon password';

  const html = baseLayout('Reset your password', `
    <p>Hi ${firstName},</p>
    <p>
      We received a request to reset the password for your Scholavon account.
      Click the button below to choose a new password:
    </p>
    <a class="cta" href="${resetUrl}">Reset password →</a>
    <hr class="divider" />
    <p>
      This link expires in <strong>1 hour</strong>. If you did not request a
      password reset, you can safely ignore this email — your password will
      not change.
    </p>
    <p>
      If the button above does not work, copy and paste this URL into your browser:<br />
      <a href="${resetUrl}" style="color:#2d6a9f;word-break:break-all;">${resetUrl}</a>
    </p>
  `);

  const text = [
    `Hi ${firstName},`,
    '',
    `We received a request to reset your Scholavon password.`,
    '',
    `Reset your password here (link expires in 1 hour):`,
    resetUrl,
    '',
    `If you did not request this, you can safely ignore this email.`,
    '',
    `— The Scholavon Team`,
  ].join('\n');

  return { subject, html, text };
}

export function buildApplicationStartedEmail(
  firstName: string,
  scholarshipTitle: string,
  deadline: string,
  applicationId: string,
  providerName?: string
): { subject: string; html: string; text: string } {
  const subject = `Application Started: ${scholarshipTitle} 📝`;
  const formattedDeadline = deadline
    ? new Date(deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No fixed deadline';
  const workspaceUrl = `${config.appUrl}/workspace/${applicationId}`;

  const html = baseLayout(
    `Application Started: ${scholarshipTitle}`,
    `
    <p>Hi ${firstName},</p>
    <p>
      You have successfully started tracking your application for
      <strong>${scholarshipTitle}</strong>${providerName ? ` offered by <strong>${providerName}</strong>` : ''}.
    </p>
    <div style="background:#f0f5fa;border-left:4px solid #2d6a9f;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 8px 0;font-size:14px;color:#1e3a5f;"><strong>Application Details</strong></p>
      <p style="margin:0;font-size:13px;color:#4b5563;">
        &bull; <strong>Status:</strong> Preparing<br />
        &bull; <strong>Deadline:</strong> ${formattedDeadline}
      </p>
    </div>
    <p><strong>What to do next:</strong></p>
    <p>
      1. Review required documents in your application checklist.<br />
      2. Draft your essays and personal statements in the workspace.<br />
      3. Track your submission progress before the deadline.
    </p>
    <a class="cta" href="${workspaceUrl}">Open Application Workspace →</a>
    <hr class="divider" />
    <p style="font-size:12px;color:#6b7280;">
      You received this because you started tracking an application on Scholavon.
    </p>
  `
  );

  const text = [
    `Hi ${firstName},`,
    '',
    `You have started tracking your application for "${scholarshipTitle}"${providerName ? ` offered by ${providerName}` : ''}.`,
    '',
    `Status: Preparing`,
    `Deadline: ${formattedDeadline}`,
    '',
    `What to do next:`,
    `- Review required checklist documents.`,
    `- Draft your essays in the workspace.`,
    `- Complete submission before the deadline.`,
    '',
    `Access your workspace: ${workspaceUrl}`,
    '',
    `— The Scholavon Team`,
  ].join('\n');

  return { subject, html, text };
}

export function buildApplicationStatusChangeEmail(
  firstName: string,
  scholarshipTitle: string,
  oldStatus: string,
  newStatus: string,
  applicationId: string,
  providerName?: string
): { subject: string; html: string; text: string } {
  const subject = `Application Update: ${scholarshipTitle} is now ${newStatus}`;
  const workspaceUrl = `${config.appUrl}/workspace/${applicationId}`;

  let nextStepsHtml = '';
  let nextStepsText = '';

  switch (newStatus) {
    case 'Applied':
      nextStepsHtml = `
        <p>Your application has been marked as <strong>Applied</strong>. Scholavon will help you monitor upcoming milestones.</p>
        <p><strong>Next steps:</strong> Keep an eye on your email for updates from the scholarship provider, and update your tracker if you receive interview or shortlist invitations.</p>
      `;
      nextStepsText = 'Your application is marked as Applied. Keep an eye out for provider notifications and record milestones in your tracker.';
      break;
    case 'Under Review':
      nextStepsHtml = `
        <p>Your application status is now <strong>Under Review</strong>.</p>
        <p><strong>Next steps:</strong> The evaluation committee is reviewing materials. No immediate student action is required at this time.</p>
      `;
      nextStepsText = 'Your application is Under Review. No action required at this time.';
      break;
    case 'Shortlisted':
      nextStepsHtml = `
        <p>Congratulations! You have been <strong>Shortlisted</strong> for this opportunity.</p>
        <p><strong>Next steps:</strong> Check your workspace and provider communications immediately for interview dates or additional requested verification documents.</p>
      `;
      nextStepsText = 'Congratulations! You have been Shortlisted. Check your workspace for interview or preparation instructions.';
      break;
    case 'Interview':
      nextStepsHtml = `
        <p>Great news! Your application has advanced to the <strong>Interview</strong> stage.</p>
        <p><strong>Next steps:</strong> Review interview preparation materials, schedule your session if required, and note the time in your Scholavon calendar.</p>
      `;
      nextStepsText = 'You have reached the Interview stage. Review interview details and prepare in your application workspace.';
      break;
    case 'Successful':
    case 'Awarded':
      nextStepsHtml = `
        <p>🎉 <strong>Congratulations!</strong> Your application was marked as <strong>${newStatus}</strong>.</p>
        <p><strong>Next steps:</strong> Review award acceptance guidelines, ensure all enrollment/onboarding forms are submitted, and record award details in your workspace.</p>
      `;
      nextStepsText = `Congratulations! Your application is ${newStatus}. Review your acceptance guidelines in your workspace.`;
      break;
    case 'Unsuccessful':
    case 'Not Selected':
      nextStepsHtml = `
        <p>Your application for ${scholarshipTitle} was marked as <strong>${newStatus}</strong>.</p>
        <p>While this outcome is disappointing, opportunities are always within reach. Scholavon has more vetted scholarships and grants matched to your profile.</p>
        <p><strong>Next steps:</strong> Browse newly matched opportunities on your dashboard.</p>
      `;
      nextStepsText = `Your application was marked as ${newStatus}. Keep moving forward — browse newly matched opportunities on your dashboard.`;
      break;
    case 'Withdrawn':
      nextStepsHtml = `
        <p>Your application has been recorded as <strong>Withdrawn</strong>.</p>
      `;
      nextStepsText = 'Your application has been recorded as Withdrawn.';
      break;
    default:
      nextStepsHtml = `
        <p>Your application status has transitioned from <em>${oldStatus}</em> to <strong>${newStatus}</strong>.</p>
      `;
      nextStepsText = `Your application status transitioned from ${oldStatus} to ${newStatus}.`;
      break;
  }

  const html = baseLayout(
    `Application Status Update: ${scholarshipTitle}`,
    `
    <p>Hi ${firstName},</p>
    <p>
      There is an update on your application for <strong>${scholarshipTitle}</strong>${providerName ? ` (${providerName})` : ''}.
    </p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:16px 20px;margin:20px 0;border-radius:8px;">
      <p style="margin:0;font-size:13px;color:#64748b;">Previous Status: <span style="text-decoration:line-through;">${oldStatus}</span></p>
      <p style="margin:4px 0 0 0;font-size:16px;font-weight:700;color:#1e293b;">New Status: <span style="color:#2d6a9f;">${newStatus}</span></p>
    </div>
    ${nextStepsHtml}
    <a class="cta" href="${workspaceUrl}">View in Application Workspace →</a>
    <hr class="divider" />
    <p style="font-size:12px;color:#6b7280;">
      You received this because you are tracking this application on Scholavon.
    </p>
  `
  );

  const text = [
    `Hi ${firstName},`,
    '',
    `There is an update on your application for "${scholarshipTitle}"${providerName ? ` (${providerName})` : ''}.`,
    '',
    `Previous status: ${oldStatus}`,
    `New status: ${newStatus}`,
    '',
    nextStepsText,
    '',
    `Open workspace: ${workspaceUrl}`,
    '',
    `— The Scholavon Team`,
  ].join('\n');

  return { subject, html, text };
}

export function buildDeadlineReminderEmail(
  firstName: string,
  scholarshipTitle: string,
  daysLeft: number,
  deadlineStr: string,
  scholarshipId: string,
  applicationId?: string
): { subject: string; html: string; text: string } {
  let subject = '';
  let urgencyText = '';

  if (daysLeft === 0) {
    subject = `🚨 Deadline Today: ${scholarshipTitle}`;
    urgencyText = 'closes TODAY. If you plan to submit, make sure all materials are finalized immediately.';
  } else if (daysLeft === 1) {
    subject = `🚨 Deadline Tomorrow: ${scholarshipTitle}`;
    urgencyText = 'closes TOMORROW. Finish any outstanding requirements and submit your application on time.';
  } else {
    subject = `⏰ ${daysLeft} days remaining: ${scholarshipTitle}`;
    urgencyText = `closes in ${daysLeft} days. Make sure your documents and essays are prepared before the deadline.`;
  }

  const targetUrl = applicationId
    ? `${config.appUrl}/workspace/${applicationId}`
    : `${config.appUrl}/scholarships/${scholarshipId}`;

  const formattedDeadline = deadlineStr
    ? new Date(deadlineStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : deadlineStr;

  const html = baseLayout(
    `Scholarship Deadline Reminder`,
    `
    <p>Hi ${firstName},</p>
    <p>
      This is a reminder that <strong>${scholarshipTitle}</strong> ${urgencyText}
    </p>
    <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:16px 20px;margin:20px 0;border-radius:0 8px 8px 0;">
      <p style="margin:0 0 6px 0;font-size:13px;color:#92400e;font-weight:700;">IMPORTANT DEADLINE</p>
      <p style="margin:0;font-size:14px;color:#78350f;">
        &bull; <strong>Deadline Date:</strong> ${formattedDeadline}<br />
        &bull; <strong>Time Remaining:</strong> ${daysLeft === 0 ? 'Due today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
      </p>
    </div>
    <p><strong>Recommended checklist:</strong></p>
    <p>
      &bull; Verify all required transcripts, recommendations, and documents are ready.<br />
      &bull; Review your application essays against the prompt instructions.<br />
      &bull; Submit early to avoid unexpected provider portal or technical delays.
    </p>
    <a class="cta" href="${targetUrl}">${applicationId ? 'Open Application Workspace →' : 'View Scholarship Details →'}</a>
    <hr class="divider" />
    <p style="font-size:12px;color:#6b7280;">
      You received this because you saved or started an application for this opportunity on Scholavon. You can adjust your deadline reminder alerts in your Account Settings.
    </p>
  `
  );

  const text = [
    `Hi ${firstName},`,
    '',
    `Reminder: "${scholarshipTitle}" ${urgencyText}`,
    '',
    `Deadline: ${formattedDeadline} (${daysLeft === 0 ? 'Today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`})`,
    '',
    `Recommended actions:`,
    `- Verify required documents and recommendations.`,
    `- Complete any unfinished essay drafts.`,
    `- Submit before the deadline to avoid portal congestion.`,
    '',
    `Link: ${targetUrl}`,
    '',
    `— The Scholavon Team`,
  ].join('\n');

  return { subject, html, text };
}

// ─── Email Service ────────────────────────────────────────────────────────────

class EmailService {
  private client: Resend | null = null;

  private getClient(): Resend | null {
    if (!config.emailProviderApiKey) return null;
    if (!this.client) {
      this.client = new Resend(config.emailProviderApiKey);
    }
    return this.client;
  }

  /**
   * Send a single email. Always resolves — never throws.
   * Check result.accepted (or result.delivered) to determine success.
   * Note: result.accepted indicates the provider accepted the email for delivery.
   * Confirmed inbox arrival requires webhook feedback (Phase E4+).
   */
  async sendEmail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
  }): Promise<EmailSendResult> {
    const resend = this.getClient();

    if (!resend) {
      console.warn(
        '[EmailService] EMAIL_PROVIDER_API_KEY is not set — email dispatch skipped for',
        options.to
      );
      return {
        accepted: false,
        delivered: false,
        status: 'not_configured',
        statusMessage:
          'Email provider not configured. Set EMAIL_PROVIDER_API_KEY in your environment.',
      };
    }

    try {
      const requestOptions = options.idempotencyKey
        ? { idempotencyKey: options.idempotencyKey }
        : undefined;

      const { data, error } = await resend.emails.send(
        {
          from: config.emailSender,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        },
        requestOptions
      );

      if (error) {
        console.error('[EmailService] Resend API error:', error.message || error);
        return {
          accepted: false,
          delivered: false,
          status: 'rejected',
          statusMessage: `Provider rejected request: ${error.message ?? 'Unknown provider error'}`,
        };
      }

      return {
        accepted: true,
        delivered: true,
        status: 'accepted',
        statusMessage: `Accepted by provider for delivery (id: ${data?.id ?? 'unknown'})`,
        messageId: data?.id,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[EmailService] Unexpected send exception:', message);
      return {
        accepted: false,
        delivered: false,
        status: 'failed',
        statusMessage: `Unexpected send failure: ${message}`,
      };
    }
  }

  /**
   * Convenience: send welcome email with idempotency key.
   * Non-critical — logs failure safely, never rethrows or interrupts caller.
   */
  async sendWelcome(to: string, firstName: string, userId?: string): Promise<EmailSendResult> {
    const { subject, html, text } = buildWelcomeEmail(firstName);
    const idempotencyKey = userId
      ? `welcome-${userId}`
      : `welcome-${to.toLowerCase().trim()}`;

    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey,
    });

    if (!result.accepted && result.status !== 'not_configured') {
      console.warn(`[EmailService] Welcome email not accepted for ${to}: ${result.statusMessage}`);
    }
    return result;
  }

  /** Send password reset email. Returns the result so the caller can decide how to respond. */
  async sendPasswordReset(
    to: string,
    firstName: string,
    resetUrl: string,
    tokenHash?: string
  ): Promise<EmailSendResult> {
    const { subject, html, text } = buildPasswordResetEmail(firstName, resetUrl);
    // Use token hash prefix as idempotency key to prevent double-dispatch for same token
    const idempotencyKey = tokenHash ? `reset-${tokenHash.slice(0, 24)}` : undefined;

    return this.sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey,
    });
  }

  /**
   * Send application started email.
   * Non-critical — logs safely, never blocks application creation.
   */
  async sendApplicationStarted(
    to: string,
    firstName: string,
    scholarshipTitle: string,
    deadline: string,
    applicationId: string,
    providerName?: string
  ): Promise<EmailSendResult> {
    const { subject, html, text } = buildApplicationStartedEmail(
      firstName,
      scholarshipTitle,
      deadline,
      applicationId,
      providerName
    );
    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey: `app-started-${applicationId}`,
    });
    if (!result.accepted && result.status !== 'not_configured') {
      console.warn(`[EmailService] Application started email not accepted for ${to}: ${result.statusMessage}`);
    }
    return result;
  }

  /**
   * Send application status change email.
   * Triggered only on genuine status transitions (never on draft autosaves or checklist edits).
   */
  async sendApplicationStatusChange(
    to: string,
    firstName: string,
    scholarshipTitle: string,
    oldStatus: string,
    newStatus: string,
    applicationId: string,
    providerName?: string
  ): Promise<EmailSendResult> {
    const { subject, html, text } = buildApplicationStatusChangeEmail(
      firstName,
      scholarshipTitle,
      oldStatus,
      newStatus,
      applicationId,
      providerName
    );
    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey: `app-status-${applicationId}-${newStatus}`,
    });
    if (!result.accepted && result.status !== 'not_configured') {
      console.warn(`[EmailService] Application status change email not accepted for ${to}: ${result.statusMessage}`);
    }
    return result;
  }

  /**
   * Send deadline reminder email.
   * Triggered when an opportunity is approaching its deadline.
   */
  async sendDeadlineReminder(
    to: string,
    firstName: string,
    scholarshipTitle: string,
    daysLeft: number,
    deadlineStr: string,
    scholarshipId: string,
    applicationId?: string,
    reminderType?: string
  ): Promise<EmailSendResult> {
    const { subject, html, text } = buildDeadlineReminderEmail(
      firstName,
      scholarshipTitle,
      daysLeft,
      deadlineStr,
      scholarshipId,
      applicationId
    );
    const key = `rem-${applicationId || scholarshipId}-${reminderType || `${daysLeft}d`}-${deadlineStr.slice(0, 10)}`;
    const result = await this.sendEmail({
      to,
      subject,
      html,
      text,
      idempotencyKey: key,
    });
    if (!result.accepted && result.status !== 'not_configured') {
      console.warn(`[EmailService] Deadline reminder email not accepted for ${to}: ${result.statusMessage}`);
    }
    return result;
  }
}

export const emailService = new EmailService();
