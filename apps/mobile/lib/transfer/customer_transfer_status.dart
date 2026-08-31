/// Customer-facing transfer / review labels. Never expose internal API codes.
abstract final class CustomerTransferStatus {
  static const ready = 'Ready';
  static const processing = 'Processing';
  static const pendingReview = 'Pending review';
  static const approved = 'Approved';
  static const declined = 'Declined';
  static const failed = 'Failed';
  static const completed = 'Completed';
  static const kycRequired = 'Identity verification required';
  static const readyToContinue = 'Ready to continue';

  static String fromPrepare({
    required bool allowed,
    String? prepareStatus,
    String? reviewStatus,
  }) {
    final review = (reviewStatus ?? '').toUpperCase();
    if (review == 'REJECTED') return declined;
    if (review == 'APPROVED') return allowed ? readyToContinue : approved;
    if (review == 'EXPIRED') return failed;
    if (review == 'PENDING') return pendingReview;

    switch ((prepareStatus ?? '').toLowerCase()) {
      case 'kyc_required':
        return kycRequired;
      case 'below_threshold':
      case 'kyc_satisfied':
        return ready;
      case 'review_required':
      case 'price_unavailable':
      case 'stale_price':
        return pendingReview;
      default:
        if (allowed) return ready;
        return processing;
    }
  }
}
