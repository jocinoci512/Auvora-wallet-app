import { Inject, Injectable, Logger } from '@nestjs/common';
import dns from 'node:dns';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { MailPort, SendMailInput } from '../../application/ports/mail.port';
import { AUTH_EMAIL_SENDER_NAME } from './auth-email.templates';

@Injectable()
export class SmtpMailAdapter implements MailPort {
  private readonly logger = new Logger(SmtpMailAdapter.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly preferResendHttps: boolean;

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {
    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_FROM) {
      throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM are required when MAIL_DRIVER=smtp');
    }
    dns.setDefaultResultOrder?.('ipv4first');
    const fromName = env.SMTP_FROM_NAME || AUTH_EMAIL_SENDER_NAME;
    this.fromAddress = `"${fromName.replace(/"/g, '')}" <${env.SMTP_FROM}>`;
    // Railway / many cloud hosts block outbound SMTP — prefer Resend HTTPS when
    // the SMTP password is a Resend API key so the first attempt is immediate.
    this.preferResendHttps =
      env.SMTP_HOST === 'smtp.resend.com' && Boolean(env.SMTP_PASS?.startsWith('re_'));
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 4000,
      greetingTimeout: 4000,
      socketTimeout: 4000,
      family: 4,
      // Defense-in-depth: never resolve local files or remote URLs from message content.
      disableFileAccess: true,
      disableUrlAccess: true,
    } as Parameters<typeof nodemailer.createTransport>[0]);
  }

  async send(input: SendMailInput): Promise<void> {
    if (this.preferResendHttps) {
      try {
        await this.sendViaResendHttps(input);
        return;
      } catch (httpsErr: unknown) {
        const httpsMsg = httpsErr instanceof Error ? httpsErr.message : String(httpsErr);
        this.logger.warn(
          `Resend HTTPS primary send failed to=${input.to}: ${httpsMsg}; falling back to SMTP`,
        );
      }
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(`SMTP mail sent to=${input.to} subject="${input.subject}"`);
      return;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`SMTP send attempt to=${input.to} resulted in: ${msg}`);

      // Fallback when SMTP was primary (or HTTPS primary already failed): try HTTPS once.
      if (
        this.env.SMTP_HOST === 'smtp.resend.com' &&
        this.env.SMTP_PASS?.startsWith('re_') &&
        !this.preferResendHttps
      ) {
        try {
          await this.sendViaResendHttps(input);
          return;
        } catch (httpErr) {
          this.logger.error(
            `Resend HTTPS fallback connection error: ${httpErr instanceof Error ? httpErr.message : String(httpErr)}`,
          );
        }
      }

      this.logger.error(`SMTP send failure to=${input.to}: ${msg}`);
      if (this.env.NODE_ENV !== 'production' && this.env.STAGING_ALLOW_MAIL_FAILOPEN) {
        this.logger.warn(
          `[STAGING] Mail fail-open active — account verification link generated but SMTP undelivered. Provider credentials required for live delivery.`,
        );
        return;
      }
      throw err;
    }
  }

  private async sendViaResendHttps(input: SendMailInput): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.env.SMTP_PASS}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as { id?: string };
      this.logger.log(`Resend HTTPS mail delivered to=${input.to} messageId=${data.id || 'ok'}`);
      return;
    }
    const errBody = await res.text().catch(() => '');
    this.logger.error(`Resend HTTPS failed HTTP ${res.status}: ${errBody}`);
    throw new Error(`Resend HTTPS failed HTTP ${res.status}`);
  }
}
