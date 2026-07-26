import {
  Inject,
  Injectable,
  Optional,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { CORRELATION_ID_HEADER } from '@auvora/security';
import type { Request, Response } from 'express';
import { type Observable, tap } from 'rxjs';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import {
  OBSERVABILITY_PUBLISHER,
  type ObservabilityPublisherPort,
} from '../../infrastructure/observability/observability-publisher.adapter';

@Injectable()
export class ObservabilityMetricsInterceptor implements NestInterceptor {
  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Optional()
    @Inject(OBSERVABILITY_PUBLISHER)
    private readonly observability?: ObservabilityPublisherPort,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http' || !this.observability) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const path = req.path ?? '';
    if (path === '/health' || path === '/ready' || path.startsWith('/api/docs')) {
      return next.handle();
    }

    const started = Date.now();
    const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;

    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<Response>();
          this.emit(started, res.statusCode ?? 200, correlationId);
        },
        error: () => {
          this.emit(started, 500, correlationId);
        },
      }),
    );
  }

  private emit(started: number, statusCode: number, correlationId?: string): void {
    const latencyMs = Date.now() - started;
    const serviceName = this.env.SERVICE_NAME;
    void this.observability?.reportMetric({
      code: 'http_latency_ms',
      name: 'HTTP latency',
      domain: 'SYSTEM',
      serviceName,
      value: latencyMs,
      unit: 'ms',
      correlationId,
      labels: { statusCode },
    });
    void this.observability?.reportMetric({
      code: 'error_rate',
      name: 'Error rate',
      domain: 'SYSTEM',
      serviceName,
      value: statusCode >= 500 ? 1 : 0,
      unit: 'ratio',
      correlationId,
      labels: { statusCode },
    });
  }
}
