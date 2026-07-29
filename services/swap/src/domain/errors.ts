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
export class SwapValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SWAP_VALIDATION', 400, details);
  }
}

export class SwapProviderError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'SWAP_PROVIDER', 502, details);
  }
}

export class SwapNotFoundError extends DomainError {
  constructor(message = 'Swap resource not found') {
    super(message, 'SWAP_NOT_FOUND', 404);
  }
}

export class SwapExpiredError extends DomainError {
  constructor(message = 'Swap quote expired') {
    super(message, 'SWAP_EXPIRED', 409);
  }
}

export class SwapUnsupportedNetworkError extends DomainError {
  constructor(network: string, reason?: string) {
    super(reason ?? `Swap not supported on ${network}`, 'SWAP_UNSUPPORTED_NETWORK', 422, {
      network,
    });
  }
}
