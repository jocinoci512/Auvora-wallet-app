/** Customer-facing KYC labels. Never expose internal verification enums. */
export function productKycLabel(status: string | undefined | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'DRAFT':
    case 'NOT_STARTED':
    case '':
    case 'NONE':
      return 'Not verified';
    case 'SUBMITTED':
      return 'Submitted';
    case 'IN_REVIEW':
    case 'PENDING_PROVIDER':
      return 'In review';
    case 'APPROVED':
      return 'Verified';
    case 'REJECTED':
      return 'Rejected';
    case 'REQUIRES_RESUBMISSION':
    case 'RENEWAL_REQUIRED':
      return 'Action required';
    default:
      return 'Not verified';
  }
}
