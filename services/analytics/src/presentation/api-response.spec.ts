import { successResponse, errorResponse } from '@auvora/nest-common';

describe('api-response', () => {
  it('wraps success payloads', () => {
    const response = successResponse({ ok: true });
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ ok: true });
    expect(response.error).toBeNull();
    expect(response.meta?.timestamp).toBeTruthy();
  });

  it('wraps error payloads', () => {
    const response = errorResponse({ code: 'ERR', message: 'failed' });
    expect(response.success).toBe(false);
    expect(response.data).toBeNull();
    expect(response.error?.code).toBe('ERR');
  });
});
