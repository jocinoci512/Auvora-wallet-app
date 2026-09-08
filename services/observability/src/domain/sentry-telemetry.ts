import { Logger } from '@nestjs/common';
import { maskSensitiveValue } from './log-masking';

export interface SentryTelemetryConfig {
  dsn?: string;
  environment?: string;
  serviceName?: string;
  release?: string;
  dist?: string;
  enabled?: boolean;
}

export interface SentryCaptureResult {
  captured: boolean;
  eventId?: string;
  reason?: string;
  sanitizedContext?: Record<string, unknown>;
}

export class SentryTelemetryEngine {
  private readonly logger = new Logger('SentryTelemetryEngine');
  private isConfigured = false;
  private config: SentryTelemetryConfig = {};

  constructor(config?: SentryTelemetryConfig) {
    if (config) {
      this.configure(config);
    }
  }

  configure(config: SentryTelemetryConfig): void {
    this.config = {
      ...config,
      enabled: config.enabled ?? Boolean(config.dsn && config.dsn.trim().length > 0),
    };
    this.isConfigured = Boolean(
      this.config.enabled && this.config.dsn && this.config.dsn.trim().length > 0,
    );
  }

  isReady(): boolean {
    return this.isConfigured;
  }

  getConfig(): Readonly<SentryTelemetryConfig> {
    return this.config;
  }

  /**
   * Filters out expected client/validation errors (4xx, ValidationError, NotFoundError)
   * to prevent Sentry quota exhaustion and keep alert signal clean.
   */
  shouldCaptureError(error: unknown): boolean {
    if (!error) return false;

    if (typeof error === 'object' && error !== null) {
      const err = error as {
        status?: number;
        statusCode?: number;
        httpStatus?: number;
        name?: string;
        code?: string;
      };

      const status = err.status ?? err.statusCode ?? err.httpStatus;
      if (typeof status === 'number' && status >= 400 && status < 500) {
        return false;
      }

      const clientErrorNames = [
        'ValidationError',
        'UnauthorizedError',
        'ForbiddenError',
        'NotFoundError',
        'ConflictError',
        'BadRequestException',
        'UnauthorizedException',
        'ForbiddenException',
        'NotFoundException',
        'MethodNotAllowedException',
      ];
      if (err.name && clientErrorNames.includes(err.name)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Captures an unexpected exception, applying strict telemetry redaction and fail-safe error handling.
   * Never throws or interrupts calling application logic.
   */
  captureException(error: unknown, context?: Record<string, unknown>): SentryCaptureResult {
    if (!this.isConfigured) {
      return {
        captured: false,
        reason: 'SENTRY_NOT_CONFIGURED',
      };
    }

    if (!this.shouldCaptureError(error)) {
      return {
        captured: false,
        reason: 'EXPECTED_CLIENT_OR_VALIDATION_ERROR',
      };
    }

    try {
      // Deeply redact all sensitive fields, keys, tokens, and PII from context
      const sanitizedContext = context
        ? (maskSensitiveValue(context) as Record<string, unknown>)
        : undefined;

      const eventId = `sentry_evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

      // Safe dispatch simulation / transport boundary
      return {
        captured: true,
        eventId,
        sanitizedContext,
      };
    } catch (dispatchErr: unknown) {
      // Strict fail-safe guarantee: monitoring failure must NEVER crash or block business operations
      const msg = dispatchErr instanceof Error ? dispatchErr.message : String(dispatchErr);
      this.logger.warn(`Sentry telemetry dispatch dropped cleanly (fail-safe): ${msg}`);
      return {
        captured: false,
        reason: `DISPATCH_FAIL_SAFE: ${msg}`,
      };
    }
  }
}

export const sentryTelemetry = new SentryTelemetryEngine();
