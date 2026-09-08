import { productKycLabel } from './kyc-status-label';

describe('productKycLabel', () => {
  it('shows Verified for APPROVED', () => {
    expect(productKycLabel('APPROVED')).toBe('Verified');
  });

  it('uses customer language for other states', () => {
    expect(productKycLabel('DRAFT')).toBe('Not verified');
    expect(productKycLabel('NOT_STARTED')).toBe('Not verified');
    expect(productKycLabel('SUBMITTED')).toBe('Submitted');
    expect(productKycLabel('IN_REVIEW')).toBe('In review');
    expect(productKycLabel('REJECTED')).toBe('Rejected');
    expect(productKycLabel('REQUIRES_RESUBMISSION')).toBe('Action required');
    expect(productKycLabel('RENEWAL_REQUIRED')).toBe('Action required');
  });
});
