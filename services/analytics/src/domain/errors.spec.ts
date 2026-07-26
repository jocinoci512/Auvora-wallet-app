import {
  AggregationError,
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
} from './errors';

describe('domain errors', () => {
  it('maps domain errors to HTTP statuses', () => {
    expect(new NotFoundError().httpStatus).toBe(404);
    expect(new ForbiddenError().httpStatus).toBe(403);
    expect(new ConflictError().httpStatus).toBe(409);
    expect(new ValidationError().httpStatus).toBe(400);
    expect(new UnauthorizedError().httpStatus).toBe(401);
    expect(new RateLimitError().httpStatus).toBe(429);
    expect(new AggregationError().httpStatus).toBe(500);
  });

  it('preserves custom codes on DomainError', () => {
    const error = new DomainError('boom', 'CUSTOM', 418);
    expect(error.code).toBe('CUSTOM');
    expect(error.httpStatus).toBe(418);
  });
});
