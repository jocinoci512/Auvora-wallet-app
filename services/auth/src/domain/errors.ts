import {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from '@auvora/nest-common';

export { DomainError, NotFoundError, ForbiddenError, ConflictError, UnauthorizedError };

/** Auth uses 422 for validation failures. */
export class ValidationError extends DomainError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 422);
  }
}

export class LockedError extends DomainError {
  constructor(message = 'Account locked') {
    super(message, 'ACCOUNT_LOCKED', 423);
  }
}

export class RateLimitError extends DomainError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}
