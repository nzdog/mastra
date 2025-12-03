# Email Notifications

Email notification service for Lichen Protocol diagnostic walk sessions.

## Features

- ✉️ Automatic notifications when new diagnostic walk sessions start
- 🇳🇿 Timestamps formatted in New Zealand timezone
- 🎨 Beautiful HTML email templates with plain text fallback
- 🔒 Secure SMTP credential handling
- 🛡️ XSS protection with HTML escaping
- 🚀 Non-blocking fire-and-forget sending
- ⚙️ Easy enable/disable via environment variables

## Setup

### 1. Install Dependencies

Dependencies are already included in package.json:
- `nodemailer` - Email sending library
- `@types/nodemailer` - TypeScript types

### 2. Configure Environment Variables

Add the following to your `.env` file:

```bash
# Enable email notifications
EMAIL_NOTIFICATIONS_ENABLED=true

# Optional: Custom recipient (defaults to coherence@lichenprotocol.com)
EMAIL_NOTIFICATION_RECIPIENT=your-email@example.com

# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

### 3. SMTP Provider Setup

#### Gmail

1. Enable 2-factor authentication on your Google account
2. Generate an app-specific password:
   - Go to Google Account Settings
   - Security → 2-Step Verification → App passwords
   - Generate a password for "Mail"
3. Use the app-specific password as `SMTP_PASS`

**Gmail Configuration:**
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-char-app-password
```

#### Other Providers

**SendGrid:**
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Mailgun:**
```bash
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=postmaster@your-domain.mailgun.org
SMTP_PASS=your-mailgun-smtp-password
```

**AWS SES:**
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASS=your-ses-smtp-password
```

## Usage

```typescript
import { EmailNotifier } from './notifications/email-notifier';

// Initialize notifier (reads from environment variables)
const notifier = new EmailNotifier();

// Check if enabled
if (notifier.isEnabled()) {
  console.log('Email notifications are enabled');
}

// Send notification when session starts
await notifier.notifySessionStart({
  session_id: 'diagnostic-walk-123',
  timestamp: new Date(),
});
```

## Email Content

### Subject
```
New Diagnostic Walk Session Started
```

### Body
The email includes:
- Session ID
- Timestamp in NZ timezone (NZST/NZDT)
- UTC timestamp
- Lichen Protocol branding

### HTML Template
- Responsive design
- Clean, professional layout
- Color gradient header
- Monospace font for technical data

## Security

- ✅ SMTP credentials are never logged
- ✅ Session IDs are HTML-escaped to prevent XSS
- ✅ Port validation prevents invalid configurations
- ✅ Graceful degradation if credentials are missing
- ✅ Fire-and-forget pattern prevents blocking

## Error Handling

The email notifier is designed to fail gracefully:

1. **Missing credentials**: Disables notifications with warning
2. **Invalid port**: Disables notifications with warning
3. **Send failures**: Logs error but doesn't crash application
4. **Network errors**: Fire-and-forget pattern prevents blocking

## Testing

Run tests with:

```bash
npm test src/notifications/email-notifier.test.ts
```

Tests cover:
- Initialization with/without credentials
- SMTP port validation
- HTML escaping
- Error handling
- Timezone formatting
- Security (credential logging)

## Troubleshooting

### Notifications not being sent

1. Check that `EMAIL_NOTIFICATIONS_ENABLED=true`
2. Verify all SMTP credentials are set
3. Check application logs for warnings:
   ```
   ⚠️  Email notifications enabled but SMTP credentials missing
   ```

### "Invalid SMTP_PORT" warning

- Ensure `SMTP_PORT` is a number between 1-65535
- Common values: `587` (TLS), `465` (SSL), `25` (unencrypted)

### Gmail "Authentication failed"

- Ensure 2-factor authentication is enabled
- Use an app-specific password, not your main password
- Check that "Less secure app access" is NOT needed (app passwords work with it off)

### Send failures logged

```
❌ Failed to send email notification: Error: ...
```

This is expected behavior - the application continues running. Check:
- SMTP credentials are correct
- Network connectivity to SMTP server
- SMTP server is not blocking connections
- Rate limits (if using a service like SendGrid)

## Production Deployment

### Environment Variables

Ensure all required variables are set in production:

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_NOTIFICATION_RECIPIENT=coherence@lichenprotocol.com
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@example.com
SMTP_PASS=your-production-smtp-password
```

### Monitoring

The notifier logs all important events:

**Success:**
```
📧 Email notifier initialized (recipient: coherence@lichenprotocol.com)
📧 Session start notification sent: diagnostic-walk-123
```

**Failures:**
```
⚠️  Email notifications enabled but SMTP credentials missing
⚠️  Invalid SMTP_PORT value: not-a-number. Using default: 587
❌ Failed to send email notification: Error: Connection timeout
```

Monitor these logs to ensure notifications are working correctly.

## Limitations

- Only supports session start notifications currently
- Single recipient per notification (no CC/BCC)
- No retry logic (fire-and-forget)
- No delivery confirmation
- No rate limiting (relies on SMTP provider)

## Future Enhancements

Potential improvements:
- Session end notifications
- Session summary emails
- Multiple recipients
- Email templates customization
- Retry logic with exponential backoff
- Delivery status tracking
- Rate limiting
- Email queueing for high-volume scenarios
