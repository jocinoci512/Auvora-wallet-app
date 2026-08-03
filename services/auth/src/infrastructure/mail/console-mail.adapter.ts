import { Injectable, Logger } from '@nestjs/common';
import type { MailPort, SendMailInput } from '../../application/ports/mail.port';
import { redactMailLogBody } from './auth-email.templates';

@Injectable()
export class ConsoleMailAdapter implements MailPort {
  private readonly logger = new Logger(ConsoleMailAdapter.name);

  async send(input: SendMailInput): Promise<void> {
    const safeText = redactMailLogBody(input.text);
    this.logger.log(`Mail to=${input.to} subject="${input.subject}" body=${safeText}`);
  }
}
