import { AlertError, IncidentError, NotFoundError, RateLimitError } from './errors';

describe('errors', () => {
  it('sets http statuses', () => {
    expect(new NotFoundError().httpStatus).toBe(404);
    expect(new RateLimitError().httpStatus).toBe(429);
    expect(new AlertError().code).toBe('ALERT_ERROR');
    expect(new IncidentError().code).toBe('INCIDENT_ERROR');
  });
});
