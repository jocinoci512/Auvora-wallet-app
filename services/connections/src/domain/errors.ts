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
export class ConnectionsValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTIONS_VALIDATION', 400, details);
  }
}

export class ConnectionsProviderError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTIONS_PROVIDER', 502, details);
  }
}

export class ConnectionsNotFoundError extends DomainError {
  constructor(message = 'Connection resource not found') {
    super(message, 'CONNECTIONS_NOT_FOUND', 404);
  }
}

export class ConnectionsUnsupportedError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONNECTIONS_UNSUPPORTED', 422, details);
  }
}

export class ConnectionsConfirmationRequiredError extends DomainError {
  constructor(message = 'User confirmation required before signing') {
    super(message, 'CONNECTIONS_CONFIRMATION_REQUIRED', 409);
  }
}

export class ConnectionsSigningNotAllowedError extends DomainError {
  constructor(message = 'Signing not allowed for this connection type') {
    super(message, 'CONNECTIONS_SIGNING_NOT_ALLOWED', 403);
  }
}

export class ConnectionsPermissionDeniedError extends DomainError {
  constructor(message = 'dApp permission denied') {
    super(message, 'CONNECTIONS_PERMISSION_DENIED', 403);
  }
}

export class ConnectionsReplayError extends DomainError {
  constructor(message = 'Replay protection rejected this request') {
    super(message, 'CONNECTIONS_REPLAY', 409);
  }
}
