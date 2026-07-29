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

export class ProviderUnavailableError extends DomainError {
  constructor(message = 'Market data provider unavailable') {
    super(message, 'PROVIDER_UNAVAILABLE', 503);
  }
}
