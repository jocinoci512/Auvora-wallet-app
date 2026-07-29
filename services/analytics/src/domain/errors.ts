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

export class AggregationError extends DomainError {
  constructor(message = 'Aggregation failed') {
    super(message, 'AGGREGATION_ERROR', 500);
  }
}
