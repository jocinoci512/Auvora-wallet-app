import { ChainNetwork } from '@auvora/database';
import { isAllowedTestnetRpcUrl, isMainnetRpcUrl, TESTNET_NETWORKS } from './testnet-networks';

describe('testnet-networks', () => {
  it('marks Alchemy mainnet hosts as mainnet', () => {
    expect(isMainnetRpcUrl('https://eth-mainnet.g.alchemy.com/v2/x')).toBe(true);
    expect(isMainnetRpcUrl('https://bnb-mainnet.g.alchemy.com/v2/x')).toBe(true);
    expect(isMainnetRpcUrl('https://api.mainnet-beta.solana.com')).toBe(true);
  });

  it('does not mark Sepolia / Amoy / Devnet as mainnet', () => {
    expect(isMainnetRpcUrl('https://eth-sepolia.g.alchemy.com/v2/x')).toBe(false);
    expect(isMainnetRpcUrl('https://polygon-amoy.g.alchemy.com/v2/x')).toBe(false);
    expect(isMainnetRpcUrl('https://api.devnet.solana.com')).toBe(false);
  });

  it('allowlists Sepolia for Ethereum testnet', () => {
    expect(
      isAllowedTestnetRpcUrl(ChainNetwork.ETHEREUM, 'https://eth-sepolia.g.alchemy.com/v2/x'),
    ).toBe(true);
    expect(
      isAllowedTestnetRpcUrl(ChainNetwork.ETHEREUM, 'https://eth-mainnet.g.alchemy.com/v2/x'),
    ).toBe(false);
  });

  it('documents exact test network identities', () => {
    expect(TESTNET_NETWORKS[ChainNetwork.ETHEREUM].evmChainId).toBe(11155111);
    expect(TESTNET_NETWORKS[ChainNetwork.BNB_SMART_CHAIN].evmChainId).toBe(97);
    expect(TESTNET_NETWORKS[ChainNetwork.POLYGON].evmChainId).toBe(80002);
    expect(TESTNET_NETWORKS[ChainNetwork.SOLANA].caip2).toBe('solana:devnet');
    expect(TESTNET_NETWORKS[ChainNetwork.BITCOIN].displayName).toMatch(/TESTNET/);
    expect(TESTNET_NETWORKS[ChainNetwork.TRON].displayName).toMatch(/Nile/);
  });
});
