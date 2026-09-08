import nodemailer from 'nodemailer';
import { SmtpMailAdapter } from './smtp-mail.adapter';
import type { ServiceEnv } from '../../config/env.schema';

jest.mock('nodemailer');

describe('SmtpMailAdapter — Fail-Closed Production Semantics', () => {
  const baseProdEnv: Partial<ServiceEnv> = {
    NODE_ENV: 'production',
    SMTP_HOST: 'smtp.resend.com',
    SMTP_PORT: 465,
    SMTP_USER: 'resend',
    SMTP_PASS: 're_test_key_placeholder',
    SMTP_FROM: 'support@auvorawallet.com',
    SMTP_FROM_NAME: 'Auvora Security',
  };

  let mockSendMail: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });
  });

  it('fails closed in production when SMTP transport fails', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP Connection Refused (EHOSTUNREACH)'));

    const adapter = new SmtpMailAdapter(baseProdEnv as ServiceEnv);

    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Verify your Auvora email',
        text: 'Click here to verify: https://auvorawallet.com/auth/verify?token=123',
        html: '<p>Click here to verify</p>',
      }),
    ).rejects.toThrow('SMTP Connection Refused (EHOSTUNREACH)');

    expect(mockSendMail).toHaveBeenCalledTimes(1);
  });

  it('does NOT fail open in production even if STAGING_ALLOW_MAIL_FAILOPEN is fraudulently true', async () => {
    const deceptiveEnv: Partial<ServiceEnv> = {
      ...baseProdEnv,
      NODE_ENV: 'production',
      STAGING_ALLOW_MAIL_FAILOPEN: true,
    };

    mockSendMail.mockRejectedValue(new Error('Provider Authentication Failure (535)'));

    const adapter = new SmtpMailAdapter(deceptiveEnv as ServiceEnv);

    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Reset your password',
        text: 'Reset link: https://auvorawallet.com/auth/reset?token=456',
        html: '<p>Reset link</p>',
      }),
    ).rejects.toThrow('Provider Authentication Failure (535)');
  });

  it('delivers email successfully when SMTP transport succeeds', async () => {
    mockSendMail.mockResolvedValue({ messageId: 'msg_12345' });

    const adapter = new SmtpMailAdapter(baseProdEnv as ServiceEnv);

    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Verify your Auvora email',
        text: 'Verify',
        html: '<p>Verify</p>',
      }),
    ).resolves.toBeUndefined();

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Verify your Auvora email',
      }),
    );
  });

  it('allows mail fail-open strictly in non-production when STAGING_ALLOW_MAIL_FAILOPEN is true', async () => {
    const stagingEnv: Partial<ServiceEnv> = {
      ...baseProdEnv,
      NODE_ENV: 'development',
      STAGING_ALLOW_MAIL_FAILOPEN: true,
    };

    mockSendMail.mockRejectedValue(new Error('Local Mailpit / mock SMTP offline'));

    const adapter = new SmtpMailAdapter(stagingEnv as ServiceEnv);

    // In staging with explicit opt-in, errors are caught and logged without breaking developer sign-up
    await expect(
      adapter.send({
        to: 'dev@example.com',
        subject: 'Verify email',
        text: 'Verify',
      }),
    ).resolves.toBeUndefined();
  });

  it('delivers successfully via Resend HTTPS fallback when cloud SMTP socket times out', async () => {
    mockSendMail.mockRejectedValue(new Error('Connection timeout'));
    const originalFetch = global.fetch;
    try {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 're_fallback_id_123' }),
      } as unknown as Response);

      const adapter = new SmtpMailAdapter(baseProdEnv as ServiceEnv);
      await expect(
        adapter.send({
          to: 'user@example.com',
          subject: 'Verify your Auvora email',
          text: 'Verify link',
        }),
      ).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
