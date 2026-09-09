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
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSendMail = jest.fn();
    (nodemailer.createTransport as jest.Mock).mockReturnValue({
      sendMail: mockSendMail,
    });
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('prefers Resend HTTPS first when SMTP_PASS is a Resend API key', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 're_primary_id' }),
    } as Response);

    const adapter = new SmtpMailAdapter(baseProdEnv as ServiceEnv);
    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Verify your Auvora email',
        text: 'Verify',
        html: '<p>Verify</p>',
      }),
    ).resolves.toBeUndefined();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('falls back to SMTP when Resend HTTPS primary fails, then fails closed in production', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'provider down',
    } as Response);
    mockSendMail.mockRejectedValue(new Error('SMTP Connection Refused (EHOSTUNREACH)'));

    const adapter = new SmtpMailAdapter(baseProdEnv as ServiceEnv);

    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Verify your Auvora email',
        text: 'Click here to verify',
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

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'unauthorized',
    } as Response);
    mockSendMail.mockRejectedValue(new Error('Provider Authentication Failure (535)'));

    const adapter = new SmtpMailAdapter(deceptiveEnv as ServiceEnv);

    await expect(
      adapter.send({
        to: 'user@example.com',
        subject: 'Reset your password',
        text: 'Reset link',
        html: '<p>Reset link</p>',
      }),
    ).rejects.toThrow('Provider Authentication Failure (535)');
  });

  it('delivers via SMTP fallback when HTTPS primary fails but SMTP succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'unavailable',
    } as Response);
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

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'down',
    } as Response);
    mockSendMail.mockRejectedValue(new Error('Local Mailpit / mock SMTP offline'));

    const adapter = new SmtpMailAdapter(stagingEnv as ServiceEnv);

    await expect(
      adapter.send({
        to: 'dev@example.com',
        subject: 'Verify email',
        text: 'Verify',
      }),
    ).resolves.toBeUndefined();
  });
});
