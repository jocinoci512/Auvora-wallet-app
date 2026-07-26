import { ALL_OBSERVABILITY_PERMISSION_CODES, PERMISSION_OBSERVABILITY_ADMIN } from './permission-codes';

describe('permission-codes', () => {
  it('includes admin permission', () => {
    expect(ALL_OBSERVABILITY_PERMISSION_CODES).toContain(PERMISSION_OBSERVABILITY_ADMIN);
    expect(ALL_OBSERVABILITY_PERMISSION_CODES).toHaveLength(6);
  });
});
