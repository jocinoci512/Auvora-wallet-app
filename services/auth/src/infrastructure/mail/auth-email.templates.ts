/**
 * Transactional auth email templates — HTML + plain text.
 * Never ask for recovery phrases, private keys, or seed words.
 */

export const AUTH_EMAIL_SENDER_NAME = 'Auvora Wallet';

const ANTI_PHISH = [
  'Auvora Wallet will never ask for your recovery phrase, seed words, or private keys.',
  'If you did not request this email, you can ignore it — your account stays secure.',
].join(' ');

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function layoutHtml(opts: {
  title: string;
  preheader: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const cta =
    opts.ctaLabel && opts.ctaUrl
      ? `<p style="margin:28px 0 8px;">
          <a href="${escapeHtml(opts.ctaUrl)}"
             style="display:inline-block;padding:14px 22px;background:#087F75;color:#F2F6F3;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
            ${escapeHtml(opts.ctaLabel)}
          </a>
        </p>
        <p style="margin:0 0 20px;font-size:13px;line-height:1.5;color:#49605E;word-break:break-all;">
          Or open this link:<br/>
          <a href="${escapeHtml(opts.ctaUrl)}" style="color:#087F75;">${escapeHtml(opts.ctaUrl)}</a>
        </p>`
      : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:#F2F6F3;font-family:Arial,Helvetica,sans-serif;color:#102D32;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F6F3;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;">
          <tr>
            <td style="padding:24px 28px 12px;">
              <img src="https://auvorawallet.com/brand/email/Auvora_Email_Logo.png" alt="Auvora Wallet" width="205" height="80" style="display:block;border:0;width:205px;height:80px;"/>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px;border-top:1px solid #DEE8E3;">
              <h1 style="margin:16px 0 0;font-size:22px;line-height:1.3;font-weight:700;color:#102D32;">${escapeHtml(opts.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 8px;font-size:16px;line-height:26px;color:#102D32;">
              ${opts.bodyHtml}
              ${cta}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;font-size:13px;line-height:22px;color:#49605E;border-top:1px solid #DEE8E3;">
              <p style="margin:0 0 12px;">${escapeHtml(ANTI_PHISH)}</p>
              <p style="margin:0;">Kind regards,<br/><strong>Auvora Wallet Team</strong></p>
              <p style="margin:12px 0 0;">© Auvora Wallet · <a href="https://auvorawallet.com" style="color:#49605E;">auvorawallet.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function layoutText(opts: {
  title: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const lines = [`Auvora Wallet`, opts.title, '', ...opts.bodyLines];
  if (opts.ctaLabel && opts.ctaUrl) {
    lines.push('', `${opts.ctaLabel}: ${opts.ctaUrl}`);
  }
  lines.push('', ANTI_PHISH, '', 'https://auvorawallet.com');
  return lines.join('\n');
}

export type AuthEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function buildVerifyEmail(verifyUrl: string): AuthEmailContent {
  return {
    subject: 'Welcome to Auvora — verify your email',
    text: layoutText({
      title: 'Verify your email',
      bodyLines: [
        'Your Auvora account was created.',
        'Confirm your email address to activate sign-in for Web and Android.',
        'This link expires in 24 hours and can be used once.',
        'Account password reset restores sign-in only — it cannot decrypt self-custody keys on your devices.',
      ],
      ctaLabel: 'Verify email',
      ctaUrl: verifyUrl,
    }),
    html: layoutHtml({
      title: 'Verify your email',
      preheader: 'Confirm your email to activate your Auvora account.',
      bodyHtml: `<p style="margin:0 0 12px;">Your Auvora account was created.</p>
        <p style="margin:0 0 12px;">Confirm your email address to activate sign-in for Web and Android. This link expires in 24 hours and can be used once.</p>
        <p style="margin:0 0 12px;">Account password reset restores sign-in only — it cannot decrypt self-custody keys on your devices.</p>`,
      ctaLabel: 'Verify email',
      ctaUrl: verifyUrl,
    }),
  };
}

export function buildPasswordResetEmail(resetUrl: string): AuthEmailContent {
  return {
    subject: 'Reset your Auvora Wallet password',
    text: layoutText({
      title: 'Reset your password',
      bodyLines: [
        'We received a request to reset the password for your Auvora Wallet account.',
        'This restores account sign-in only. It does not decrypt self-custody wallet keys stored on your devices.',
        'This link expires in 1 hour and can be used once.',
        'If you did not request a reset, you can safely ignore this message.',
      ],
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
    }),
    html: layoutHtml({
      title: 'Reset your password',
      preheader: 'Reset account password — does not decrypt device wallet keys.',
      bodyHtml: `<p style="margin:0 0 12px;">We received a request to reset the password for your Auvora Wallet account.</p>
        <p style="margin:0 0 12px;">This restores account sign-in only. It does not decrypt self-custody wallet keys stored on your devices.</p>
        <p style="margin:0 0 12px;">This link expires in 1 hour and can be used once. If you did not request a reset, you can safely ignore this message.</p>`,
      ctaLabel: 'Reset password',
      ctaUrl: resetUrl,
    }),
  };
}

export function buildEmailVerifiedNotice(): AuthEmailContent {
  return {
    subject: 'Your Auvora Wallet email is verified',
    text: layoutText({
      title: 'Email verified',
      bodyLines: [
        'Your email address is now verified.',
        'You can sign in to Auvora Wallet with this account.',
      ],
    }),
    html: layoutHtml({
      title: 'Email verified',
      preheader: 'Your Auvora Wallet email address is verified.',
      bodyHtml: `<p style="margin:0 0 12px;">Your email address is now verified.</p>
        <p style="margin:0;">You can sign in to Auvora Wallet with this account.</p>`,
    }),
  };
}

export function buildPasswordChangedNotice(): AuthEmailContent {
  return {
    subject: 'Your Auvora Wallet password was changed',
    text: layoutText({
      title: 'Password changed',
      bodyLines: [
        'The password for your Auvora Wallet account was changed successfully.',
        'All active sessions were signed out for your protection.',
        'If you did not make this change, reset your password immediately and contact support.',
      ],
    }),
    html: layoutHtml({
      title: 'Password changed',
      preheader: 'Your Auvora Wallet password was changed.',
      bodyHtml: `<p style="margin:0 0 12px;">The password for your Auvora Wallet account was changed successfully.</p>
        <p style="margin:0 0 12px;">All active sessions were signed out for your protection.</p>
        <p style="margin:0;">If you did not make this change, reset your password immediately and contact support.</p>`,
    }),
  };
}

export function buildNewLoginNotice(details: {
  deviceName?: string | null;
  platform?: string | null;
  ipAddress?: string | null;
}): AuthEmailContent {
  const device = details.deviceName?.trim() || details.platform?.trim() || 'a new device';
  const ip = details.ipAddress?.trim() || 'unknown IP';
  return {
    subject: 'New sign-in to your Auvora Wallet account',
    text: layoutText({
      title: 'New sign-in detected',
      bodyLines: [
        `We noticed a sign-in from ${device} (${ip}).`,
        'If this was you, no action is needed.',
        'If you do not recognize this activity, change your password and revoke sessions in account settings.',
      ],
    }),
    html: layoutHtml({
      title: 'New sign-in detected',
      preheader: 'A new device signed in to your Auvora Wallet account.',
      bodyHtml: `<p style="margin:0 0 12px;">We noticed a sign-in from <strong>${escapeHtml(device)}</strong> (${escapeHtml(ip)}).</p>
        <p style="margin:0 0 12px;">If this was you, no action is needed.</p>
        <p style="margin:0;">If you do not recognize this activity, change your password and revoke sessions in account settings.</p>`,
    }),
  };
}

export function buildSessionRevokedNotice(): AuthEmailContent {
  return {
    subject: 'A session was revoked on your Auvora Wallet account',
    text: layoutText({
      title: 'Session revoked',
      bodyLines: [
        'A sign-in session on your Auvora Wallet account was revoked.',
        'If you did this, no further action is needed.',
        'If you did not, change your password and review your devices.',
      ],
    }),
    html: layoutHtml({
      title: 'Session revoked',
      preheader: 'A session on your Auvora Wallet account was revoked.',
      bodyHtml: `<p style="margin:0 0 12px;">A sign-in session on your Auvora Wallet account was revoked.</p>
        <p style="margin:0 0 12px;">If you did this, no further action is needed.</p>
        <p style="margin:0;">If you did not, change your password and review your devices.</p>`,
    }),
  };
}

/** Redact token query params before logging mail bodies. */
export function redactMailLogBody(body: string): string {
  return body
    .replace(/([?&]token=)[^&\s"'<>]+/gi, '$1[redacted]')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1[redacted]');
}
