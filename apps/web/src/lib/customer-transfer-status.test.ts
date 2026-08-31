import { customerTransferStatus } from './customer-transfer-status';

describe('customerTransferStatus', () => {
  it('maps approved KYC band to Ready and never leaks internal codes', () => {
    expect(customerTransferStatus({ allowed: true, prepareStatus: 'kyc_satisfied' })).toBe('Ready');
    expect(customerTransferStatus({ allowed: false, reviewStatus: 'PENDING' })).toBe(
      'Pending review',
    );
    expect(customerTransferStatus({ allowed: false, reviewStatus: 'REJECTED' })).toBe('Declined');
    expect(customerTransferStatus({ allowed: false, reviewStatus: 'APPROVED' })).toBe('Approved');
    expect(customerTransferStatus({ allowed: false, reviewStatus: 'EXPIRED' })).toBe('Failed');
    expect(customerTransferStatus({ allowed: false, prepareStatus: 'kyc_required' })).toBe(
      'Identity verification required',
    );
    expect(customerTransferStatus({ allowed: true, prepareStatus: 'kyc_satisfied' })).not.toBe(
      'kyc_satisfied',
    );
  });
});
