import 'package:auvora_wallet/transfer/customer_transfer_status.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('never exposes internal policy codes', () {
    expect(
      CustomerTransferStatus.fromPrepare(allowed: true, prepareStatus: 'kyc_satisfied'),
      CustomerTransferStatus.ready,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: true, prepareStatus: 'below_threshold'),
      CustomerTransferStatus.ready,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, prepareStatus: 'review_required'),
      CustomerTransferStatus.pendingReview,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, reviewStatus: 'PENDING'),
      CustomerTransferStatus.pendingReview,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, reviewStatus: 'REJECTED'),
      CustomerTransferStatus.declined,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, reviewStatus: 'APPROVED'),
      CustomerTransferStatus.approved,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, reviewStatus: 'EXPIRED'),
      CustomerTransferStatus.failed,
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, reviewStatus: 'REJECTED'),
      isNot(contains('Physical QA')),
    );
    expect(
      CustomerTransferStatus.fromPrepare(allowed: false, prepareStatus: 'kyc_required'),
      CustomerTransferStatus.kycRequired,
    );
    const internals = [
      'kyc_satisfied',
      'below_threshold',
      'review_required',
      'LargeTransferReview',
      'policy_result',
      'admin_review_required',
    ];
    for (final code in internals) {
      expect(
        CustomerTransferStatus.fromPrepare(allowed: false, prepareStatus: code),
        isNot(code),
      );
    }
  });
}
