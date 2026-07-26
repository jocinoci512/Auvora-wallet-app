import {
  ALL_ANALYTICS_PERMISSION_CODES,
  PERMISSION_ANALYTICS_ADMIN,
  PERMISSION_ANALYTICS_DASHBOARDS,
  PERMISSION_ANALYTICS_KPIS,
  PERMISSION_ANALYTICS_READ,
  PERMISSION_ANALYTICS_REPORTS,
  PERMISSION_ANALYTICS_WRITE,
} from './permission-codes';

describe('permission-codes', () => {
  it('exports analytics permission constants', () => {
    expect(PERMISSION_ANALYTICS_READ).toBe('analytics:read');
    expect(PERMISSION_ANALYTICS_WRITE).toBe('analytics:write');
    expect(PERMISSION_ANALYTICS_ADMIN).toBe('analytics:admin');
    expect(PERMISSION_ANALYTICS_REPORTS).toBe('analytics:reports');
    expect(PERMISSION_ANALYTICS_DASHBOARDS).toBe('analytics:dashboards');
    expect(PERMISSION_ANALYTICS_KPIS).toBe('analytics:kpis');
  });

  it('lists all analytics permissions', () => {
    expect(ALL_ANALYTICS_PERMISSION_CODES).toHaveLength(6);
    expect(ALL_ANALYTICS_PERMISSION_CODES).toContain('analytics:read');
  });
});
