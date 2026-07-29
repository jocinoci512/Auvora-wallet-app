import {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
} from '@auvora/nest-common';

export {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  UnauthorizedError,
};
export class RateLimitError extends DomainError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class AlertError extends DomainError {
  constructor(message = 'Alert evaluation failed') {
    super(message, 'ALERT_ERROR', 500);
  }
}

export class IncidentError extends DomainError {
  constructor(message = 'Incident operation failed') {
    super(message, 'INCIDENT_ERROR', 400);
  }
}
