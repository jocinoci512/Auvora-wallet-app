import 'package:auvora_wallet/connections/evm_local_signer.dart';
import 'package:auvora_wallet/release/release_config.dart';
import 'package:auvora_wallet/wallet_engine/evm_testnet_broadcast.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('default unit tests cannot enable testnet broadcast', () {
    expect(ReleaseConfig.liveBroadcastEnabled, isFalse);
    expect(ReleaseConfig.canBroadcastTestnet, isFalse);
    expect(EvmTestnetBroadcast.enabledNow, isFalse);
  });

  test('assertAllowed refuses mainnet chain IDs', () {
    expect(
      () => EvmTestnetBroadcast.assertAllowed(
        chainId: 1,
        canBroadcastTestnet: true,
        liveBroadcastEnabled: false,
        isTestnetEnv: true,
        rpcUrl: 'https://ethereum-sepolia.publicnode.com',
      ),
      throwsA(isA<StateError>()),
    );
    expect(
      () => EvmTestnetBroadcast.assertAllowed(
        chainId: 56,
        canBroadcastTestnet: true,
        liveBroadcastEnabled: false,
        isTestnetEnv: true,
        rpcUrl: 'https://ethereum-sepolia.publicnode.com',
      ),
      throwsA(isA<StateError>()),
    );
  });

  test('assertAllowed refuses liveBroadcastEnabled even on Sepolia', () {
    expect(
      () => EvmTestnetBroadcast.assertAllowed(
        chainId: 11155111,
        canBroadcastTestnet: true,
        liveBroadcastEnabled: true,
        isTestnetEnv: true,
        rpcUrl: 'https://ethereum-sepolia.publicnode.com',
      ),
      throwsA(isA<StateError>()),
    );
  });

  test('assertAllowed refuses when testnet broadcast flag is off', () {
    expect(
      () => EvmTestnetBroadcast.assertAllowed(
        chainId: 11155111,
        canBroadcastTestnet: false,
        liveBroadcastEnabled: false,
        isTestnetEnv: true,
        rpcUrl: 'https://ethereum-sepolia.publicnode.com',
      ),
      throwsA(isA<StateError>()),
    );
  });

  test('assertAllowed accepts Sepolia when gates are open', () {
    EvmTestnetBroadcast.assertAllowed(
      chainId: 11155111,
      canBroadcastTestnet: true,
      liveBroadcastEnabled: false,
      isTestnetEnv: true,
      rpcUrl: 'https://ethereum-sepolia.publicnode.com',
    );
  });

  test('assertAllowed refuses a mainnet RPC host', () {
    expect(
      () => EvmTestnetBroadcast.assertAllowed(
        chainId: 11155111,
        canBroadcastTestnet: true,
        liveBroadcastEnabled: false,
        isTestnetEnv: true,
        rpcUrl: 'https://ethereum.publicnode.com',
      ),
      throwsA(isA<StateError>()),
    );
  });

  test('local signer refuses mainnet and unknown chain IDs', () {
    const signer = EvmLocalSigner();
    expect(
      () => signer.signLegacyNativeTransfer(
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        to: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
        valueWei: BigInt.one,
        nonce: 0,
        gasPriceWei: BigInt.from(1000000000),
        chainId: 1,
      ),
      throwsA(isA<StateError>()),
    );
    expect(
      () => signer.signLegacyNativeTransfer(
        mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
        to: '0xc3676e0177085d64324fa777325d5d782ebb48e9',
        valueWei: BigInt.one,
        nonce: 0,
        gasPriceWei: BigInt.from(1000000000),
        chainId: 999999,
      ),
      throwsA(isA<StateError>()),
    );
  });
}
