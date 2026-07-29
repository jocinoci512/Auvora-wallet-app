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
export class StakingValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STAKING_VALIDATION', 400, details);
  }
}

export class StakingProviderError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'STAKING_PROVIDER', 502, details);
  }
}

export class StakingNotFoundError extends DomainError {
  constructor(message = 'Staking resource not found') {
    super(message, 'STAKING_NOT_FOUND', 404);
  }
}

export class StakingUnsupportedNetworkError extends DomainError {
  constructor(network: string, reason?: string) {
    super(reason ?? `Staking not supported on ${network}`, 'STAKING_UNSUPPORTED_NETWORK', 422, {
      network,
    });
  }
}

export class StakingConfirmationRequiredError extends DomainError {
  constructor(message = 'User confirmation required before signing') {
    super(message, 'STAKING_CONFIRMATION_REQUIRED', 409);
  }
}
