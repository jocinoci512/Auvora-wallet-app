export type ApprovalPolicyKindCode =
  | 'SINGLE'
  | 'DUAL'
  | 'MULTI'
  | 'THRESHOLD'
  | 'RISK_BASED'
  | 'AMOUNT_BASED'
  | 'ROLE_BASED'
  | 'EMERGENCY';

export interface ApprovalRequirement {
  kind: ApprovalPolicyKindCode;
  threshold: number;
  totalSigners?: number;
}

/** Number of distinct approvals required before a signing/recovery request may proceed. */
export function requiredApprovalsForPolicy(policy: ApprovalRequirement): number {
  switch (policy.kind) {
    case 'SINGLE':
      return 1;
    case 'DUAL':
      return 2;
    case 'MULTI':
    case 'THRESHOLD':
      return Math.max(1, policy.threshold);
    default:
      return Math.max(1, policy.threshold || 1);
  }
}

export function isApprovalSatisfied(
  policy: ApprovalRequirement,
  approvalsReceived: number,
): boolean {
  return approvalsReceived >= requiredApprovalsForPolicy(policy);
}

/** Security posture: any single rejection vetoes the request, regardless of policy kind. */
export function isApprovalRejected(rejectionsReceived: number): boolean {
  return rejectionsReceived > 0;
}

export function singleApprovalPolicy(): ApprovalRequirement {
  return { kind: 'SINGLE', threshold: 1 };
}

export function dualApprovalPolicy(): ApprovalRequirement {
  return { kind: 'DUAL', threshold: 2 };
}

export function multiApprovalPolicy(threshold: number): ApprovalRequirement {
  return { kind: 'MULTI', threshold: Math.max(1, threshold) };
}

export function thresholdApprovalPolicy(
  threshold: number,
  totalSigners: number,
): ApprovalRequirement {
  return {
    kind: 'THRESHOLD',
    threshold: Math.max(1, threshold),
    totalSigners: Math.max(threshold, totalSigners),
  };
}

export function validateThreshold(threshold: number, totalSigners: number): boolean {
  return threshold >= 1 && totalSigners >= 1 && threshold <= totalSigners;
}
