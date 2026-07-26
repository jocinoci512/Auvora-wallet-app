import type { PaymentType } from '@auvora/database';
import type { PaymentProvider } from '../../domain';

export const PROVIDER_FACTORY = Symbol('PROVIDER_FACTORY');

export interface ProviderFactoryPort {
  getProvider(code: string): PaymentProvider;
  listProviders(): PaymentProvider[];
  hasProvider(code: string): boolean;
}

export const PROVIDER_RESOLVER = Symbol('PROVIDER_RESOLVER');

export interface ProviderResolverPort {
  /** Selects the best enabled + healthy provider capable of handling `paymentType`. */
  resolve(paymentType: PaymentType): Promise<PaymentProvider>;
}
