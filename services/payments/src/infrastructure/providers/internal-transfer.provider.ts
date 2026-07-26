import { Inject, Injectable } from '@nestjs/common';
import { PaymentType } from '@auvora/database';
import { WALLET_LEDGER, type WalletLedgerPort } from '../../application/ports/wallet-ledger.port';
import type { AuthorizePaymentInput, ProviderOperationResult } from '../../domain';
import { BasePaymentSimulatorProvider } from './base-payment-simulator.provider';

@Injectable()
export class InternalTransferProvider extends BasePaymentSimulatorProvider {
  constructor(@Inject(WALLET_LEDGER) private readonly walletLedger: WalletLedgerPort) {
    super('INTERNAL_TRANSFER', 'Internal Wallet Transfer', [
      PaymentType.INTERNAL_TRANSFER,
      PaymentType.WALLET_TRANSFER,
    ]);
  }

  override async authorize(input: AuthorizePaymentInput): Promise<ProviderOperationResult> {
    if (!input.fromWalletId || !input.toWalletId) {
      return {
        providerRef: this.generateRef('auth'),
        status: 'FAILED',
        message: 'Both fromWalletId and toWalletId are required for an internal transfer',
      };
    }

    const result = await this.walletLedger.transfer({
      fromWalletId: input.fromWalletId,
      toWalletId: input.toWalletId,
      amount: input.amount,
      expectedOwnerUserId: input.ownerUserId,
      description: `Payment ${input.paymentId}`,
    });

    if (!result.success) {
      return { providerRef: this.generateRef('auth'), status: 'FAILED', message: result.message };
    }
    return { providerRef: result.transactionId ?? this.generateRef('auth'), status: 'SUCCEEDED' };
  }
}
