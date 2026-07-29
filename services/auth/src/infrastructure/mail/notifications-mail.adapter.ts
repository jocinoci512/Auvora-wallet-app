import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { MailPort, SendMailInput } from '../../application/ports/mail.port';

/**
 * Routes auth mail through the Notification Platform when configured.
 * Falls back is handled by the MAIL_PORT factory (console/smtp).
 */
@Injectable()
export class NotificationsMailAdapter implements MailPort {
  private readonly logger = new Logger(NotificationsMailAdapter.name);

  constructor(@Inject(ENV) private readonly env: ServiceEnv) {}

  async send(input: SendMailInput): Promise<void> {
    const baseUrl = this.env.NOTIFICATIONS_SERVICE_URL;
    const apiKey = this.env.INTERNAL_API_KEY;
    if (!baseUrl || !apiKey) {
      throw new Error(
        'Notifications mail adapter requires NOTIFICATIONS_SERVICE_URL and INTERNAL_API_KEY',
      );
    }

    // `SendMailInput` (mail.port.ts) carries no user id today, so ownerUserId is intentionally
    // omitted; correlationId still lets this send be traced end-to-end through the platform.
    const correlationId = randomUUID();
    const url = `${baseUrl.replace(/\/$/, '')}/api/v1/internal/notifications/send`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-api-key': apiKey,
      },
      body: JSON.stringify({
        channel: 'EMAIL',
        category: 'AUTH',
        priority: 'HIGH',
        subject: input.subject,
        body: input.html ?? input.text,
        recipient: input.to,
        dedupeKey: `auth-mail:${input.to}:${input.subject}:${Date.now()}`,
        correlationId,
        sourceEventType: 'auth.mail.send',
        metadata: {
          source: 'auth-service',
          text: input.text,
          sourceEventType: 'auth.mail.send',
          correlationId,
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      this.logger.warn(`Notifications send failed HTTP ${response.status}: ${text}`);
      throw new Error(`Notifications platform rejected mail (${response.status})`);
    }
  }
}
