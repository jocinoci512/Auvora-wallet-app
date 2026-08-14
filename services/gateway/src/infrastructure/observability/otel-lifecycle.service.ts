import { type BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import { shutdownOpenTelemetry } from '../observability/otel';

/** Nest shutdown hook — closes OTEL without duplicate process.signal handlers in main.ts. */
@Injectable()
export class OpenTelemetryLifecycle implements BeforeApplicationShutdown {
  async beforeApplicationShutdown(): Promise<void> {
    await shutdownOpenTelemetry();
  }
}
