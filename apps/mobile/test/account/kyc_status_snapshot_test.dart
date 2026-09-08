import 'package:flutter_test/flutter_test.dart';

import 'package:auvora_wallet/account/kyc_client.dart';

void main() {
  test('APPROVED maps to Verified', () {
    final snap = KycStatusSnapshot.fromJson({
      'status': 'APPROVED',
      'level': 'BASIC',
    });
    expect(snap.productLabel, 'Verified');
    expect(snap.isApproved, isTrue);
  });

  test('SUBMITTED and IN_REVIEW map to In review', () {
    final sub = KycStatusSnapshot.fromJson({
      'status': 'SUBMITTED',
      'level': 'BASIC',
    });
    expect(sub.productLabel, 'In review');
    expect(sub.isApproved, isFalse);

    final rev = KycStatusSnapshot.fromJson({
      'status': 'IN_REVIEW',
      'level': 'BASIC',
    });
    expect(rev.productLabel, 'In review');
    expect(rev.isApproved, isFalse);
  });

  test('REQUIRES_RESUBMISSION maps to Action required with needsResubmission true', () {
    final resub = KycStatusSnapshot.fromJson({
      'status': 'REQUIRES_RESUBMISSION',
      'level': 'BASIC',
      'rejectionReason': 'Document expired. Please upload a valid ID.',
    });
    expect(resub.productLabel, 'Action required');
    expect(resub.needsResubmission, isTrue);
    expect(resub.customerReason, 'Document expired. Please upload a valid ID.');
  });
}
