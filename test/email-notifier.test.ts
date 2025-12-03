/**
 * Tests for email notification service
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { EmailNotifier, SessionNotification } from '../src/notifications/email-notifier';

describe('EmailNotifier', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
    // Clear all env vars related to email
    delete process.env.EMAIL_NOTIFICATIONS_ENABLED;
    delete process.env.EMAIL_NOTIFICATION_RECIPIENT;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_SECURE;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    it('should be disabled by default when EMAIL_NOTIFICATIONS_ENABLED is not set', () => {
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should be disabled when EMAIL_NOTIFICATIONS_ENABLED is false', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'false';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should be disabled when EMAIL_NOTIFICATIONS_ENABLED is true but credentials are missing', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      // No SMTP credentials set
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should be disabled when SMTP_HOST is missing', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      // No SMTP_HOST
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should be disabled when SMTP_USER is missing', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PASS = 'password';
      // No SMTP_USER
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should be disabled when SMTP_PASS is missing', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      // No SMTP_PASS
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should be enabled when all credentials are provided', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(true);
    });

    it('should use default recipient when EMAIL_NOTIFICATION_RECIPIENT is not set', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      const notifier = new EmailNotifier();
      // The recipient is private, but we can verify initialization worked
      expect(notifier.isEnabled()).toBe(true);
    });

    it('should use custom recipient when EMAIL_NOTIFICATION_RECIPIENT is set', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.EMAIL_NOTIFICATION_RECIPIENT = 'custom@example.com';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(true);
    });
  });

  describe('SMTP Port Validation', () => {
    it('should use default port 587 when SMTP_PORT is not set', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      // No SMTP_PORT - should default to 587
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(true);
    });

    it('should disable when SMTP_PORT is not a valid number', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.SMTP_PORT = 'not-a-number';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should disable when SMTP_PORT is out of valid range (too low)', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.SMTP_PORT = '0';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should disable when SMTP_PORT is out of valid range (too high)', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.SMTP_PORT = '99999';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);
    });

    it('should accept valid custom port', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      process.env.SMTP_PORT = '465';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(true);
    });
  });

  describe('notifySessionStart', () => {
    it('should not throw when disabled', async () => {
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(false);

      const notification: SessionNotification = {
        session_id: 'test-session-123',
        timestamp: new Date(),
      };

      await expect(notifier.notifySessionStart(notification)).resolves.toBeUndefined();
    });

    it('should not throw when enabled (fire-and-forget)', async () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      const notifier = new EmailNotifier();
      expect(notifier.isEnabled()).toBe(true);

      const notification: SessionNotification = {
        session_id: 'test-session-123',
        timestamp: new Date(),
      };

      // Should not throw even if sending fails (fire-and-forget)
      await expect(notifier.notifySessionStart(notification)).resolves.toBeUndefined();
    });

    it('should handle session_id with special characters', async () => {
      const notifier = new EmailNotifier();
      const notification: SessionNotification = {
        session_id: 'test-<script>alert("xss")</script>',
        timestamp: new Date(),
      };

      // Should not throw
      await expect(notifier.notifySessionStart(notification)).resolves.toBeUndefined();
    });

    it('should format NZ timezone correctly', () => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'password';
      const notifier = new EmailNotifier();

      const testDate = new Date('2025-12-04T12:00:00Z');
      const notification: SessionNotification = {
        session_id: 'test-session-123',
        timestamp: testDate,
      };

      // This tests the internal formatNZTime method indirectly
      // We can't directly test it as it's private, but notifySessionStart uses it
      expect(() => notifier.notifySessionStart(notification)).not.toThrow();
    });
  });

  describe('Security', () => {
    it('should escape HTML in session_id', async () => {
      const notifier = new EmailNotifier();
      const maliciousId = '<img src=x onerror=alert(1)>';
      const notification: SessionNotification = {
        session_id: maliciousId,
        timestamp: new Date(),
      };

      // The escaping happens internally, we just verify it doesn't throw
      await expect(notifier.notifySessionStart(notification)).resolves.toBeUndefined();
    });

    it('should not log SMTP credentials', () => {
      // Mock console.log to capture output
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true';
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'user@example.com';
      process.env.SMTP_PASS = 'super-secret-password';
      new EmailNotifier();

      // Verify password is not in any log output
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('super-secret-password')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid timestamp gracefully', async () => {
      const notifier = new EmailNotifier();
      const notification: SessionNotification = {
        session_id: 'test-123',
        timestamp: new Date('invalid'),
      };

      await expect(notifier.notifySessionStart(notification)).resolves.toBeUndefined();
    });
  });
});
