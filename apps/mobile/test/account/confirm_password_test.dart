import 'package:auvora_wallet/account/account_controller.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('confirmPassword returns false when signed out without mutating session', () async {
    final account = AccountController();
    // Fresh controller is not signed in; confirm must fail closed.
    final ok = await account.confirmPassword('AnyPassword!23456');
    expect(ok, isFalse);
    expect(account.isSignedIn, isFalse);
  });
}
