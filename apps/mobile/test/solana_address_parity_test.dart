import 'package:auvora_wallet/crypto/hd_derivation.dart';
import 'package:auvora_wallet/portfolio/models.dart';
import 'package:auvora_wallet/release/auvora_qa_local_solana.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('controlled LOCAL QA recipient matches abandon account zero', () {
    expect(
      AuvoraQaLocalSolana.controlledRecipient,
      'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk',
    );
  });

  test('registered QA address matches the DB public address', () {
    const dbQaAddress = '8jFiN4JabxmBwkCVVFnaNyszExbCdd7k2TDuFQHyNThQ';
    expect(AuvoraQaLocalSolana.registeredQaAddress, dbQaAddress);
  });

  test('Solana account zero uses the hardened Auvora path', () {
    expect(
      HdDerivation.derivationPath(AssetNetwork.solana),
      "m/44'/501'/0'/0'",
    );
  });
}
