import { randomUUID } from 'node:crypto';
import type { PaymentType } from '@auvora/database';
import type {
  AuthorizePaymentInput,
  CapturePaymentInput,
  EstimateFeeInput,
  PaymentProvider,
  ProviderFeeEstimate,
  ProviderHealthResult,
  ProviderOperationResult,
  RefundPaymentInput,
  ReversePaymentInput,
} from '../../domain';

/**
 * Shared behavior for every simulated payment provider: deterministic
 * synthetic provider references and immediate success responses. A real
 * integration would replace these methods with calls to the provider's API.
 */
export abstract class BasePaymentSimulatorProvider implements PaymentProvider {
  protected constructor(
    private readonly code: string,
    private readonly name: string,
    private readonly capabilities: PaymentType[],
  ) {}

  getCode(): string {
    return this.code;
  }

  getName(): string {
    return this.name;
  }

  listCapabilities(): PaymentType[] {
    return this.capabilities;
  }

  async authorize(_input: AuthorizePaymentInput): Promise<ProviderOperationResult> {
    return { providerRef: this.generateRef('auth'), status: 'SUCCEEDED' };
  }

  async capture(input: CapturePaymentInput): Promise<ProviderOperationResult> {
    return { providerRef: input.providerRef, status: 'SUCCEEDED' };
  }

  async refund(_input: RefundPaymentInput): Promise<ProviderOperationResult> {
    return { providerRef: this.generateRef('refund'), status: 'SUCCEEDED' };
  }

  async reverse(_input: ReversePaymentInput): Promise<ProviderOperationResult> {
    return { providerRef: this.generateRef('reverse'), status: 'SUCCEEDED' };
  }

  async getStatus(providerRef: string): Promise<ProviderOperationResult> {
    return { providerRef, status: 'SUCCEEDED' };
  }

  async estimateFee(input: EstimateFeeInput): Promise<ProviderFeeEstimate> {
    return { amount: (Number(input.amount) * 0.01).toFixed(2), currency: input.currency };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    return { healthy: true, latencyMs: 5 };
  }

  protected generateRef(prefix: string): string {
    return `${this.code}-${prefix}-${randomUUID()}`;
  }
}
