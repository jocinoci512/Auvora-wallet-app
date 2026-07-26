import { signWebhookPayload, verifyWebhookSignature } from './webhook-signer';

describe('webhook-signer', () => {
  it('produces a v1-prefixed hex-encoded HMAC-SHA256 signature', () => {
    const signature = signWebhookPayload('secret', '{"a":1}', 1_700_000_000_000);
    expect(signature).toMatch(/^v1=[0-9a-f]{64}$/);
  });

  it('verifies a signature generated with the same secret and payload', () => {
    const secret = 'super-secret';
    const rawBody = JSON.stringify({ eventType: 'notification.sent' });
    const timestamp = Date.now();
    const signature = signWebhookPayload(secret, rawBody, timestamp);
    expect(verifyWebhookSignature(secret, rawBody, timestamp, signature)).toBe(true);
  });

  it('rejects a signature generated with a different secret or payload', () => {
    const rawBody = JSON.stringify({ eventType: 'notification.sent' });
    const timestamp = Date.now();
    const signature = signWebhookPayload('secret-a', rawBody, timestamp);
    expect(verifyWebhookSignature('secret-b', rawBody, timestamp, signature)).toBe(false);
    expect(verifyWebhookSignature('secret-a', JSON.stringify({ eventType: 'other' }), timestamp, signature)).toBe(false);
  });
});
