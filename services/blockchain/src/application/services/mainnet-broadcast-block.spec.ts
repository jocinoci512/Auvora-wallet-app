import { ChainNetwork } from '@auvora/database';
import { ValidationError } from '../../domain';
import type { ServiceEnv } from '../../config/env.schema';
import { assertBroadcastAllowed } from './broadcast-policy';

describe('Production Mainnet Broadcast Kill Switch — All 6 Chains', () => {
  const productionEnv: ServiceEnv = {
    NODE_ENV: 'production',
    BLOCKCHAIN_LIVE_BROADCAST: false,
    BLOCKCHAIN_NETWORK_ENV: 'mainnet',
    BLOCKCHAIN_TESTNET_BROADCAST: false,
    PORT: 3003,
    SERVICE_NAME: 'blockchain',
    SERVICE_VERSION: '0.1.0',
    LOG_LEVEL: 'info',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'a'.repeat(32),
    CSRF_SECRET: 'b'.repeat(32),
    RATE_LIMIT_WINDOW_SECONDS: 60,
    RATE_LIMIT_MAX: 100,
    OTEL_ENABLED: false,
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    BLOCKCHAIN_SIMULATOR_ENABLED: false,
    BLOCKCHAIN_PRIMARY_PROVIDER: 'alchemy',
    BLOCKCHAIN_SYNC_INTERVAL_MS: 5000,
    ALCHEMY_RPC_TIMEOUT_MS: 12000,
  } as unknown as ServiceEnv;

  it('blocks Ethereum mainnet broadcast attempt', () => {
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/testkey',
        evmChainId: 1,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/testkey',
        evmChainId: 1,
      }),
    ).toThrow(/Mainnet EVM chainId 1 broadcast is blocked/);
  });

  it('blocks BNB Smart Chain mainnet broadcast attempt', () => {
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.BNB_SMART_CHAIN,
        rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/testkey',
        evmChainId: 56,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.BNB_SMART_CHAIN,
        rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/testkey',
        evmChainId: 56,
      }),
    ).toThrow(/Mainnet EVM chainId 56 broadcast is blocked/);
  });

  it('blocks Polygon mainnet broadcast attempt', () => {
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.POLYGON,
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/testkey',
        evmChainId: 137,
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.POLYGON,
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/testkey',
        evmChainId: 137,
      }),
    ).toThrow(/Mainnet EVM chainId 137 broadcast is blocked/);
  });

  it('blocks Solana mainnet broadcast attempt', () => {
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.SOLANA,
        rpcUrl: 'https://solana-mainnet.g.alchemy.com/v2/testkey',
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.SOLANA,
        rpcUrl: 'https://solana-mainnet.g.alchemy.com/v2/testkey',
      }),
    ).toThrow(/Mainnet RPC host broadcast is blocked/);
  });

  it('blocks Bitcoin mainnet broadcast attempt', () => {
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.BITCOIN,
        rpcUrl: 'https://bitcoin-mainnet.g.alchemy.com/v2/testkey',
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.BITCOIN,
        rpcUrl: 'https://bitcoin-mainnet.g.alchemy.com/v2/testkey',
      }),
    ).toThrow(/Mainnet RPC host broadcast is blocked/);
  });

  it('blocks Tron mainnet broadcast attempt', () => {
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.TRON,
        rpcUrl: 'https://tron-mainnet.g.alchemy.com/v2/testkey',
      }),
    ).toThrow(ValidationError);
    expect(() =>
      assertBroadcastAllowed(productionEnv, {
        chain: ChainNetwork.TRON,
        rpcUrl: 'https://tron-mainnet.g.alchemy.com/v2/testkey',
      }),
    ).toThrow(/Mainnet RPC host broadcast is blocked/);
  });

  it('blocks all 6 chains even if testnet flags are fraudulently flipped', () => {
    const deceptiveEnv = {
      ...productionEnv,
      BLOCKCHAIN_NETWORK_ENV: 'testnet',
      BLOCKCHAIN_TESTNET_BROADCAST: true,
    } as ServiceEnv;

    const mainnets = [
      {
        chain: ChainNetwork.ETHEREUM,
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/x',
        evmChainId: 1,
      },
      {
        chain: ChainNetwork.BNB_SMART_CHAIN,
        rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/x',
        evmChainId: 56,
      },
      {
        chain: ChainNetwork.POLYGON,
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/x',
        evmChainId: 137,
      },
      { chain: ChainNetwork.SOLANA, rpcUrl: 'https://solana-mainnet.g.alchemy.com/v2/x' },
      { chain: ChainNetwork.BITCOIN, rpcUrl: 'https://bitcoin-mainnet.g.alchemy.com/v2/x' },
      { chain: ChainNetwork.TRON, rpcUrl: 'https://tron-mainnet.g.alchemy.com/v2/x' },
    ];

    for (const target of mainnets) {
      expect(() =>
        assertBroadcastAllowed(deceptiveEnv, {
          chain: target.chain,
          rpcUrl: target.rpcUrl,
          evmChainId: target.evmChainId,
        }),
      ).toThrow(ValidationError);
    }
  });

  it('guarantees each chain has independent rollout gate defaulting to OFF', () => {
    const defaultEnv = {
      ...productionEnv,
      MAINNET_GLOBAL_ENABLED: true,
      BLOCKCHAIN_LIVE_BROADCAST: true,
      MAINNET_ETHEREUM_STATE: 'OFF',
      MAINNET_BNB_STATE: 'OFF',
      MAINNET_POLYGON_STATE: 'OFF',
      MAINNET_SOLANA_STATE: 'OFF',
      MAINNET_BITCOIN_STATE: 'OFF',
      MAINNET_TRON_STATE: 'OFF',
    } as ServiceEnv;

    const targets = [
      {
        chain: ChainNetwork.ETHEREUM,
        evmChainId: 1,
        rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/x',
      },
      {
        chain: ChainNetwork.BNB_SMART_CHAIN,
        evmChainId: 56,
        rpcUrl: 'https://bnb-mainnet.g.alchemy.com/v2/x',
      },
      {
        chain: ChainNetwork.POLYGON,
        evmChainId: 137,
        rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/x',
      },
      { chain: ChainNetwork.SOLANA, rpcUrl: 'https://solana-mainnet.g.alchemy.com/v2/x' },
      { chain: ChainNetwork.BITCOIN, rpcUrl: 'https://bitcoin-mainnet.g.alchemy.com/v2/x' },
      { chain: ChainNetwork.TRON, rpcUrl: 'https://tron-mainnet.g.alchemy.com/v2/x' },
    ];

    for (const target of targets) {
      expect(() =>
        assertBroadcastAllowed(defaultEnv, {
          chain: target.chain,
          rpcUrl: target.rpcUrl,
          evmChainId: target.evmChainId,
        }),
      ).toThrow(ValidationError);
    }
  });
});
