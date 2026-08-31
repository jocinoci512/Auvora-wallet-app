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

  test('REJECTED shows customer reason without internal notes', () {
    final snap = KycStatusSnapshot.fromJson({
      'status': 'REJECTED',
      'level': 'BASIC',
      'rejectionReason': 'Please submit a clearer identity document.',
      'metadata': {'internalAdminNote': 'QA rejection workflow test'},
    });
    expect(snap.productLabel, 'Rejected');
    expect(snap.customerReason, 'Please submit a clearer identity document.');
  });
}
