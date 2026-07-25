import type { AssetStandard, ChainNetwork } from '@auvora/database';

export const BLOCKCHAIN_PROVIDER = Symbol('BLOCKCHAIN_PROVIDER');

export interface BlockchainProviderPort {
  getChain(): ChainNetwork;
  validateAddress?(address: string): boolean;
  supportsAsset(standard: AssetStandard): boolean;
}
