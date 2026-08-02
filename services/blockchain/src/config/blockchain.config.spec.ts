import {
  ENABLED_MAINNETS,
  resolveBlockchainConfig,
  assertAlchemyReadyForPrimary,
} from './blockchain.config';
import { ChainNetwork } from '@auvora/database';

describe('blockchain.config', () => {
  it('treats Alchemy as primary when credentials exist', () => {
    const cfg = resolveBlockchainConfig({
      BLOCKCHAIN_PRIMARY_PROVIDER: 'alchemy',
      BLOCKCHAIN_SIMULATOR_ENABLED: false,
      ALCHEMY_API_KEY: 'test-key',
      NODE_ENV: 'development',
    } as never);
    expect(cfg.primaryProvider).toBe('alchemy');
    expect(cfg.alchemyConfigured).toBe(true);
    expect(cfg.alchemyChains).toEqual(expect.arrayContaining([...ENABLED_MAINNETS]));
    expect(cfg.rpcEndpoints.every((e) => e.endpoint.includes('[REDACTED]'))).toBe(true);
  });

  it('does not hard-fail in development without Alchemy', () => {
    expect(() =>
      assertAlchemyReadyForPrimary({
        BLOCKCHAIN_PRIMARY_PROVIDER: 'alchemy',
        NODE_ENV: 'development',
        ALCHEMY_REQUIRED: false,
      } as never),
    ).not.toThrow();
  });

  it('requires Alchemy in production when ALCHEMY_REQUIRED defaults', () => {
    expect(() =>
      assertAlchemyReadyForPrimary({
        BLOCKCHAIN_PRIMARY_PROVIDER: 'alchemy',
        NODE_ENV: 'production',
        ALCHEMY_REQUIRED: undefined,
      } as never),
    ).toThrow(/Alchemy is required/);
  });

  it('lists all six enabled mainnets including Polygon', () => {
    expect(ENABLED_MAINNETS).toContain(ChainNetwork.ETHEREUM);
    expect(ENABLED_MAINNETS).toContain(ChainNetwork.POLYGON);
    expect(ENABLED_MAINNETS).toContain(ChainNetwork.SOLANA);
    expect(ENABLED_MAINNETS).toContain(ChainNetwork.BNB_SMART_CHAIN);
    expect(ENABLED_MAINNETS).toContain(ChainNetwork.TRON);
    expect(ENABLED_MAINNETS).toContain(ChainNetwork.BITCOIN);
    expect(ENABLED_MAINNETS).toHaveLength(6);
  });
});
