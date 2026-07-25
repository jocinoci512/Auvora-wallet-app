import { Inject, Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { MailPort, SendMailInput } from '../../application/ports/mail.port';

@Injectable()
export class SmtpMailAdapter implements MailPort {
  private readonly logger = new Logger(SmtpMailAdapter.name);
  private readonly transporter: Transporter;

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {
    if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_FROM) {
      throw new Error('SMTP_HOST, SMTP_PORT, and SMTP_FROM are required when MAIL_DRIVER=smtp');
    }
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    });
  }

  async send(input: SendMailInput): Promise<void> {
    await this.transporter.sendMail({
      from: this.env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    this.logger.log(`SMTP mail sent to=${input.to} subject="${input.subject}"`);
  }
}
