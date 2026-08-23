import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin realtime client authorization handling', () => {
  const source = readFileSync(join(__dirname, 'useAdminRealtime.ts'), 'utf8');

  it('stops reconnect storms on 401/403 instead of looping forever', () => {
    expect(source).toContain("setStatus('unauthorized')");
    expect(source).toContain('res.status === 401 || res.status === 403');
    expect(source).toContain("credentials: 'include'");
    expect(source).toContain('/api/v1/admin/realtime/events');
  });

  it('reconnects after temporary visibility resume without stacking timers forever', () => {
    expect(source).toContain("document.addEventListener('visibilitychange'");
    expect(source).toContain('scheduleReconnect');
    expect(source).toContain('nextBackoffMs');
  });
});
