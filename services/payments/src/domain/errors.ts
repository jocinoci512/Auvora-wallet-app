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

export class LimitExceededError extends DomainError {
  constructor(message = 'Limit exceeded') {
    super(message, 'LIMIT_EXCEEDED', 422);
  }
}

export class InvalidStatusTransitionError extends DomainError {
  constructor(message = 'Invalid status transition') {
    super(message, 'INVALID_STATUS_TRANSITION', 422);
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(message = 'Provider unavailable') {
    super(message, 'PROVIDER_UNAVAILABLE', 503);
  }
}
