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
export class BridgeValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BRIDGE_VALIDATION', 400, details);
  }
}

export class BridgeProviderError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BRIDGE_PROVIDER', 502, details);
  }
}

export class BridgeNotFoundError extends DomainError {
  constructor(message = 'Bridge transfer not found') {
    super(message, 'BRIDGE_NOT_FOUND', 404);
  }
}

export class BridgeUnsupportedRouteError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'BRIDGE_UNSUPPORTED_ROUTE', 422, details);
  }
}

export class BridgeConfirmationRequiredError extends DomainError {
  constructor(message = 'User confirmation required before bridge execution') {
    super(message, 'BRIDGE_CONFIRMATION_REQUIRED', 409);
  }
}

export class BridgeExpiredError extends DomainError {
  constructor(message = 'Bridge quote expired') {
    super(message, 'BRIDGE_QUOTE_EXPIRED', 410);
  }
}
