'use client';

const DEVICE_ID_KEY = 'auvora_device_id_v1';

/** Stable per-browser device id for session registration — not invasive fingerprinting. */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-device-placeholder';
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  } catch {
    return `web-ephemeral-${Date.now()}`;
  }
}

export function guessDeviceName(): string {
  if (typeof navigator === 'undefined') return 'Web browser';
  const ua = navigator.userAgent || '';
  let browser = 'Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/chrome\//i.test(ua)) browser = 'Chrome';
  else if (/safari\//i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox\//i.test(ua)) browser = 'Firefox';

  let platform = 'Web';
  if (/windows/i.test(ua)) platform = 'Windows';
  else if (/mac os|macintosh/i.test(ua)) platform = 'macOS';
  else if (/android/i.test(ua)) platform = 'Android';
  else if (/iphone|ipad|ios/i.test(ua)) platform = 'iOS';
  else if (/linux/i.test(ua)) platform = 'Linux';

  return `Auvora Web · ${browser} on ${platform}`;
}
