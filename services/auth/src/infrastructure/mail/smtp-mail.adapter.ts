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

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {
    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_FROM) {
      throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM are required when MAIL_DRIVER=smtp');
    }
    dns.setDefaultResultOrder?.('ipv4first');
    const fromName = env.SMTP_FROM_NAME || AUTH_EMAIL_SENDER_NAME;
    this.fromAddress = `"${fromName.replace(/"/g, '')}" <${env.SMTP_FROM}>`;
    this.transporter = (nodemailer.createTransport as any)({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      family: 4,
      // Defense-in-depth: never resolve local files or remote URLs from message content.
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async send(input: SendMailInput): Promise<void> {
    // Only allow the MailPort contract fields — never raw, attachments, envelope,
    // list headers, jsonTransport, or other attacker-influenced Nodemailer options.
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
      });
      this.logger.log(`SMTP mail sent to=${input.to} subject="${input.subject}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
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
}
