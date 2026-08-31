/** Customer-facing KYC labels. Never expose internal verification enums. */
export function productKycLabel(status: string | undefined | null): string {
  switch ((status ?? '').toUpperCase()) {
    case 'DRAFT':
    case '':
    case 'NONE':
      return 'Not verified';
    case 'SUBMITTED':
    case 'PENDING_PROVIDER':
      return 'Pending';
    case 'IN_REVIEW':
      return 'In review';
    case 'APPROVED':
      return 'Verified';
    case 'REJECTED':
      return 'Rejected';
    case 'RENEWAL_REQUIRED':
      return 'Action required';
    default:
      return 'Not verified';
  }
}
