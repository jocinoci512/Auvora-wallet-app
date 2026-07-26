import type { ChainNetwork } from '@auvora/database';
import type { BlockchainProvider } from '../../domain';
import { BitcoinProvider } from './bitcoin.provider';
import { BnbSmartChainProvider } from './bnb-smart-chain.provider';
import { EthereumProvider } from './ethereum.provider';
import { LitecoinProvider } from './litecoin.provider';
import { PolygonProvider } from './polygon.provider';
import { SolanaProvider } from './solana.provider';
import { TronProvider } from './tron.provider';

export const CHAIN_PROVIDERS = [
  BitcoinProvider,
  EthereumProvider,
  PolygonProvider,
  BnbSmartChainProvider,
  SolanaProvider,
  TronProvider,
  LitecoinProvider,
] as const;

export const PROVIDER_REGISTRY = Symbol('PROVIDER_REGISTRY');

export type ProviderRegistry = Map<ChainNetwork, BlockchainProvider>;
