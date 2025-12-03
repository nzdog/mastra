/**
 * Email notification service for session events
 * Sends notifications to coherence@lichenprotocol.com
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export interface SessionNotification {
  session_id: string;
  timestamp: Date;
}

/**
 * Escape HTML to prevent injection attacks
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class EmailNotifier {
  private transporter: Transporter | null = null;
  private enabled: boolean;
  private recipient: string;

  constructor() {
    this.enabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
    this.recipient = process.env.EMAIL_NOTIFICATION_RECIPIENT || 'coherence@lichenprotocol.com';

    if (this.enabled) {
      this.initializeTransporter();
    }
  }

  private initializeTransporter(): void {
    const host = process.env.SMTP_HOST;
    const portStr = process.env.SMTP_PORT || '587';
    const port = parseInt(portStr, 10);
    const secure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    // Validate SMTP_PORT is a valid number
    if (isNaN(port) || port < 1 || port > 65535) {
      console.warn(`⚠️  Invalid SMTP_PORT value: ${portStr}. Using default: 587`);
      this.enabled = false;
      return;
    }

    if (!host || !user || !pass) {
      console.warn('⚠️  Email notifications enabled but SMTP credentials missing');
      this.enabled = false;
      return;
    }

    // SECURITY: Do not log SMTP credentials in production
    // The credentials are handled securely by nodemailer
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    console.log(`📧 Email notifier initialized (recipient: ${this.recipient})`);
  }

  /**
   * Send notification when a new session starts
   * Non-blocking: errors are logged but do not throw
   */
  async notifySessionStart(notification: SessionNotification): Promise<void> {
    if (!this.enabled || !this.transporter) {
      return;
    }

    // Fire-and-forget: don't await, don't block main flow
    this.sendEmailAsync(notification).catch((error) => {
      console.error('❌ Failed to send email notification:', error);
    });
  }

  /**
   * Internal async email sending logic
   */
  private async sendEmailAsync(notification: SessionNotification): Promise<void> {
    if (!this.transporter) {
      return;
    }

    try {
      // Escape session_id to prevent XSS in HTML emails
      const safeSessionId = escapeHtml(notification.session_id);

      // Convert to NZ time
      const nzTime = this.formatNZTime(notification.timestamp);

      const subject = `New Diagnostic Walk Session Started`;
      const text = `
A new diagnostic walk session has started.

Session ID: ${notification.session_id}
Time (NZ): ${nzTime}
Timestamp: ${notification.timestamp.toISOString()}

---
Lichen Protocol Diagnostic Engine
      `.trim();

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, rgba(88, 184, 132, 0.1), rgba(108, 123, 238, 0.1)); padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 20px; color: #2d3748; }
    .content { background: #f7fafc; padding: 20px; border-radius: 8px; }
    .field { margin-bottom: 12px; }
    .field-label { font-weight: 600; color: #4a5568; }
    .field-value { font-family: 'Courier New', monospace; color: #2d3748; margin-top: 4px; }
    .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🌿 New Diagnostic Walk Session</h1>
    </div>
    <div class="content">
      <div class="field">
        <div class="field-label">Session ID</div>
        <div class="field-value">${safeSessionId}</div>
      </div>
      <div class="field">
        <div class="field-label">Time (NZ)</div>
        <div class="field-value">${escapeHtml(nzTime)}</div>
      </div>
      <div class="field">
        <div class="field-label">Timestamp (UTC)</div>
        <div class="field-value">${escapeHtml(notification.timestamp.toISOString())}</div>
      </div>
    </div>
    <div class="footer">
      Lichen Protocol Diagnostic Engine
    </div>
  </div>
</body>
</html>
      `.trim();

      await this.transporter.sendMail({
        from: `"Lichen Diagnostic Engine" <${process.env.SMTP_USER}>`,
        to: this.recipient,
        subject,
        text,
        html,
      });

      console.log(`📧 Session start notification sent: ${notification.session_id}`);
    } catch (error) {
      // Re-throw to be caught by the fire-and-forget handler
      throw error;
    }
  }

  /**
   * Format timestamp in NZ time (NZST/NZDT)
   */
  private formatNZTime(date: Date): string {
    return date.toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  }

  /**
   * Check if email notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
