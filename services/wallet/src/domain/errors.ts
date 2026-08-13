import {
  DomainError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnauthorizedError,
} from '@auvora/nest-common';

export { DomainError, NotFoundError, ForbiddenError, ConflictError, UnauthorizedError };

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 422);
  }
}

export class RateLimitError extends DomainError {
  constructor(message = 'Too many requests') {
    super(message, 'RATE_LIMITED', 429);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(message = 'Invalid status transition') {
    super(message, 'INVALID_STATUS_TRANSITION', 422);
  }
}
