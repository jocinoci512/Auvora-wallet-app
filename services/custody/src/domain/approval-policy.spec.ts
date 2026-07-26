import {
  dualApprovalPolicy,
  isApprovalRejected,
  isApprovalSatisfied,
  multiApprovalPolicy,
  requiredApprovalsForPolicy,
  singleApprovalPolicy,
  thresholdApprovalPolicy,
  validateThreshold,
} from './approval-policy';

describe('approval-policy', () => {
  it('single policy requires exactly one approval', () => {
    const policy = singleApprovalPolicy();
    expect(requiredApprovalsForPolicy(policy)).toBe(1);
    expect(isApprovalSatisfied(policy, 0)).toBe(false);
    expect(isApprovalSatisfied(policy, 1)).toBe(true);
  });

  it('dual policy requires two approvals', () => {
    const policy = dualApprovalPolicy();
    expect(requiredApprovalsForPolicy(policy)).toBe(2);
    expect(isApprovalSatisfied(policy, 1)).toBe(false);
    expect(isApprovalSatisfied(policy, 2)).toBe(true);
  });

  it('multi policy honors an arbitrary threshold (e.g. 3-of-5)', () => {
    const policy = multiApprovalPolicy(3);
    expect(requiredApprovalsForPolicy(policy)).toBe(3);
    expect(isApprovalSatisfied(policy, 2)).toBe(false);
    expect(isApprovalSatisfied(policy, 3)).toBe(true);
  });

  it('threshold policy captures N-of-M signer groups', () => {
    const policy = thresholdApprovalPolicy(2, 3);
    expect(policy.totalSigners).toBe(3);
    expect(requiredApprovalsForPolicy(policy)).toBe(2);
    expect(validateThreshold(policy.threshold, policy.totalSigners ?? 0)).toBe(true);
  });

  it('rejects an invalid threshold greater than total signers', () => {
    expect(validateThreshold(4, 3)).toBe(false);
    expect(validateThreshold(0, 3)).toBe(false);
  });

  it('any rejection vetoes the request', () => {
    expect(isApprovalRejected(0)).toBe(false);
    expect(isApprovalRejected(1)).toBe(true);
  });
});
