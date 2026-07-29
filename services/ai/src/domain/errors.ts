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
export class ProviderUnavailableError extends DomainError {
  constructor(message = 'AI provider unavailable') {
    super(message, 'PROVIDER_UNAVAILABLE', 503);
  }
}

export class SafetyViolationError extends DomainError {
  constructor(message = 'Request violates safety policy') {
    super(message, 'SAFETY_VIOLATION', 422);
  }
}
