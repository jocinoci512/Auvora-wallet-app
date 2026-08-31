import { formatApiError } from './api-client';

describe('formatApiError', () => {
  it('does not expose NEXT_PUBLIC_API_URL to customers on network failure', () => {
    const msg = formatApiError(new Error('Failed to fetch'));
    expect(msg).toBe("We couldn't connect to Auvora. Please try again.");
    expect(msg).not.toMatch(/NEXT_PUBLIC/i);
  });

  it('keeps rate-limit copy customer-safe', () => {
    expect(formatApiError(new Error('429 Too Many Requests'))).toMatch(/Too many attempts/i);
  });
});
