import { ChainNetwork } from '@auvora/database';
import { ValidationError } from '../../domain';
import type { ServiceEnv } from '../../config/env.schema';
import { assertBroadcastAllowed, assertLiveBroadcastAllowed } from './broadcast-policy';

describe('assertLiveBroadcastAllowed', () => {
  const base = {
    BLOCKCHAIN_LIVE_BROADCAST: false,
    BLOCKCHAIN_NETWORK_ENV: 'mainnet',
    BLOCKCHAIN_TESTNET_BROADCAST: false,
  } as ServiceEnv;

  it('throws when live broadcast is disabled (default)', () => {
    expect(() => assertLiveBroadcastAllowed(base)).toThrow(ValidationError);
    expect(() => assertLiveBroadcastAllowed(base)).toThrow(/BLOCKCHAIN_LIVE_BROADCAST=false/);
  });

  it('allows when explicitly enabled', () => {
    expect(() =>
      assertLiveBroadcastAllowed({ ...base, BLOCKCHAIN_LIVE_BROADCAST: true }),
    ).not.toThrow();
  });
});

describe('assertBroadcastAllowed — mainnet hard block + testnet allowlist', () => {
  const base = {
    BLOCKCHAIN_LIVE_BROADCAST: false,
    BLOCKCHAIN_NETWORK_ENV: 'mainnet',
    BLOCKCHAIN_TESTNET_BROADCAST: false,
  } as ServiceEnv;

  it('rejects default mainnet broadcast', () => {
    expect(() =>
      assertBroadcastAllowed(base, {
        chain: ChainNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/x',
      }),
    ).toThrow(/Mainnet RPC host|Broadcast denied/);
  });

  it('rejects mainnet EVM chain IDs even if testnet flags are on', () => {
    const env = {
      ...base,
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: true,
    } as ServiceEnv;
    expect(() =>
      assertBroadcastAllowed(env, {
        chain: ChainNetwork.ETHEREUM,
        evmChainId: 1,
        rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/x',
      }),
    ).toThrow(/Mainnet EVM chainId 1/);
  });

  it('rejects BNB mainnet chain id 56', () => {
    const env = {
      ...base,
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: true,
    } as ServiceEnv;
    expect(() =>
      assertBroadcastAllowed(env, { chain: ChainNetwork.BNB_SMART_CHAIN, evmChainId: 56 }),
    ).toThrow(/56/);
  });

  it('rejects Polygon mainnet chain id 137', () => {
    const env = {
      ...base,
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: true,
    } as ServiceEnv;
    expect(() =>
      assertBroadcastAllowed(env, { chain: ChainNetwork.POLYGON, evmChainId: 137 }),
    ).toThrow(/137/);
  });

  it('allows Sepolia when testnet broadcast is enabled', () => {
    const env = {
      ...base,
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: true,
    } as ServiceEnv;
    expect(() =>
      assertBroadcastAllowed(env, {
        chain: ChainNetwork.ETHEREUM,
        evmChainId: 11155111,
        rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/x',
      }),
    ).not.toThrow();
  });

  it('rejects testnet broadcast when NETWORK_ENV is mainnet', () => {
    const env = {
      ...base,
      BLOCKCHAIN_TESTNET_BROADCAST: true,
      BLOCKCHAIN_NETWORK_ENV: 'mainnet',
    } as ServiceEnv;
    expect(() =>
      assertBroadcastAllowed(env, {
        chain: ChainNetwork.ETHEREUM,
        rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/x',
      }),
    ).toThrow(/Broadcast denied/);
  });

  it('rejects mainnet host even under testnet env', () => {
    const env = {
      ...base,
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: true,
    } as ServiceEnv;
    expect(() =>
      assertBroadcastAllowed(env, {
        chain: ChainNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/x',
      }),
    ).toThrow(/Mainnet RPC host/);
  });
});
