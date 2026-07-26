import type { PaymentProvider } from '../../domain';
import { CryptoBridgeProvider } from './crypto-bridge.provider';
import { InternalTransferProvider } from './internal-transfer.provider';
import { LocalFiatSimulatorProvider } from './local-fiat-simulator.provider';
import { MerchantSimulatorProvider } from './merchant-simulator.provider';

export const PAYMENT_PROVIDERS = [
  LocalFiatSimulatorProvider,
  InternalTransferProvider,
  CryptoBridgeProvider,
  MerchantSimulatorProvider,
] as const;

export const PROVIDER_REGISTRY = Symbol('PROVIDER_REGISTRY');

export type ProviderRegistry = Map<string, PaymentProvider>;
