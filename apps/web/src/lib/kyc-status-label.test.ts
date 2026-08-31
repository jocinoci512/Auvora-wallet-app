import { productKycLabel } from './kyc-status-label';

describe('productKycLabel', () => {
  it('shows Verified for APPROVED', () => {
    expect(productKycLabel('APPROVED')).toBe('Verified');
  });

  it('uses customer language for other states', () => {
    expect(productKycLabel('DRAFT')).toBe('Not verified');
    expect(productKycLabel('IN_REVIEW')).toBe('In review');
    expect(productKycLabel('REJECTED')).toBe('Rejected');
  });
});
