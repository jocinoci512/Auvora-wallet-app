import { Injectable } from '@nestjs/common';
import { AssetStandard, ChainNetwork } from '@auvora/database';
import type { BlockchainProviderPort } from '../../domain/blockchain/provider.port';

abstract class BaseChainProvider implements BlockchainProviderPort {
  abstract getChain(): ChainNetwork;

  supportsAsset(standard: AssetStandard): boolean {
    return this.getSupportedStandards().includes(standard);
  }

  protected abstract getSupportedStandards(): AssetStandard[];
}

@Injectable()
export class BitcoinProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.BITCOIN;
  }

  validateAddress(address: string): boolean {
    return /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE];
  }
}

@Injectable()
export class EthereumProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.ETHEREUM;
  }

  validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE, AssetStandard.ERC20];
  }
}

@Injectable()
export class PolygonProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.POLYGON;
  }

  validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE, AssetStandard.ERC20];
  }
}

@Injectable()
export class SolanaProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.SOLANA;
  }

  validateAddress(address: string): boolean {
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE, AssetStandard.SPL];
  }
}

@Injectable()
export class BnbSmartChainProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.BNB_SMART_CHAIN;
  }

  validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE, AssetStandard.BEP20];
  }
}

@Injectable()
export class TronProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.TRON;
  }

  validateAddress(address: string): boolean {
    return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE, AssetStandard.TRC20];
  }
}

@Injectable()
export class LitecoinProvider extends BaseChainProvider {
  getChain(): ChainNetwork {
    return ChainNetwork.LITECOIN;
  }

  validateAddress(address: string): boolean {
    return /^(ltc1|[LM3])[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
  }

  protected getSupportedStandards(): AssetStandard[] {
    return [AssetStandard.NATIVE];
  }
}

export const BLOCKCHAIN_PROVIDERS = [
  BitcoinProvider,
  EthereumProvider,
  PolygonProvider,
  SolanaProvider,
  BnbSmartChainProvider,
  TronProvider,
  LitecoinProvider,
] as const;

export const BLOCKCHAIN_PROVIDER_REGISTRY = Symbol('BLOCKCHAIN_PROVIDER_REGISTRY');

export type BlockchainProviderRegistry = Map<ChainNetwork, BlockchainProviderPort>;
