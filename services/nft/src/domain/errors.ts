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
export class NftValidationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NFT_VALIDATION', 400, details);
  }
}

export class NftProviderError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'NFT_PROVIDER', 502, details);
  }
}

export class NftNotFoundError extends DomainError {
  constructor(message = 'NFT resource not found') {
    super(message, 'NFT_NOT_FOUND', 404);
  }
}

export class NftUnsupportedNetworkError extends DomainError {
  constructor(network: string, reason?: string) {
    super(reason ?? `NFTs not supported on ${network}`, 'NFT_UNSUPPORTED_NETWORK', 422, {
      network,
    });
  }
}
