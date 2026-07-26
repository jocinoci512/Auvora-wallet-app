/** Shared proxy timeout: honors PROXY_TIMEOUT_MS when set, else 30s. */
export function getProxyTimeoutMs(): number {
  const raw = process.env['PROXY_TIMEOUT_MS'];
  if (!raw) return 30_000;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
}
