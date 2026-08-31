/** Customer-facing transfer / review labels. Never expose internal API codes. */
export function customerTransferStatus(input: {
  allowed?: boolean;
  prepareStatus?: string | null;
  reviewStatus?: string | null;
}): string {
  const review = (input.reviewStatus ?? '').toUpperCase();
  if (review === 'REJECTED') return 'Declined';
  if (review === 'APPROVED') return input.allowed ? 'Ready to continue' : 'Approved';
  if (review === 'EXPIRED') return 'Failed';
  if (review === 'PENDING') return 'Pending review';

  switch ((input.prepareStatus ?? '').toLowerCase()) {
    case 'kyc_required':
      return 'Identity verification required';
    case 'below_threshold':
    case 'kyc_satisfied':
      return 'Ready';
    case 'review_required':
    case 'price_unavailable':
    case 'stale_price':
      return 'Pending review';
    default:
      return input.allowed ? 'Ready' : 'Processing';
  }
}
