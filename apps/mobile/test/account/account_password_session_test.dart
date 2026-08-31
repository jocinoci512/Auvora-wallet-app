import 'package:auvora_wallet/account/account_password_session.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  tearDown(AccountPasswordSession.clear);

  test('capture and peek keeps password in memory only', () {
    AccountPasswordSession.capture('StrongPass!234');
    expect(AccountPasswordSession.peek(), 'StrongPass!234');
  });

  test('clear removes password', () {
    AccountPasswordSession.capture('StrongPass!234');
    AccountPasswordSession.clear();
    expect(AccountPasswordSession.peek(), isNull);
  });

  test('empty capture is ignored', () {
    AccountPasswordSession.capture('   ');
    expect(AccountPasswordSession.peek(), isNull);
  });
}
