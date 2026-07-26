export class DomainError extends Error {
  readonly httpStatus: number;

  constructor(
    message: string,
    readonly code: string,
    statusCode: number = 400,
  ) {
    super(message);
    this.name = new.target.name;
    this.httpStatus = statusCode;
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Resource not found') {
    super(message, 'NOT_FOUND', 404);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflict') {
    super(message, 'CONFLICT', 409);
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ProviderUnavailableError extends DomainError {
  constructor(message = 'Custody provider unavailable') {
    super(message, 'PROVIDER_UNAVAILABLE', 503);
  }
}
