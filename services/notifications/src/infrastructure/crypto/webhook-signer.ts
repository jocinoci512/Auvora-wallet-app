import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_SIGNATURE_HEADER = 'x-auvora-signature';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-auvora-timestamp';

/** Computes an HMAC-SHA256 signature over `${timestamp}.${rawBody}`, hex-encoded and prefixed with the scheme version. */
export function signWebhookPayload(secret: string, rawBody: string, timestamp: number): string {
  const signedContent = `${timestamp}.${rawBody}`;
  const digest = createHmac('sha256', secret).update(signedContent).digest('hex');
  return `v1=${digest}`;
}

export function verifyWebhookSignature(
  secret: string,
  rawBody: string,
  timestamp: number,
  signature: string,
): boolean {
  const expected = signWebhookPayload(secret, rawBody, timestamp);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }
  return timingSafeEqual(expectedBuf, actualBuf);
}
