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
  constructor(message = 'Notification provider unavailable') {
    super(message, 'PROVIDER_UNAVAILABLE', 503);
  }
}
