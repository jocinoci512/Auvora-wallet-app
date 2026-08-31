import 'package:auvora_wallet/account/account_password_session.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(AccountPasswordSession.clear);

  test('session password is available for automatic vault upload after auth', () {
    AccountPasswordSession.capture('StrongPass!23456');
    expect(AccountPasswordSession.peek(), 'StrongPass!23456');
    AccountPasswordSession.clear();
    expect(AccountPasswordSession.peek(), isNull);
  });
}
