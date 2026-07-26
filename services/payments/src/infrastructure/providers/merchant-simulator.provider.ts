import { Injectable } from '@nestjs/common';
import { PaymentType } from '@auvora/database';
import { BasePaymentSimulatorProvider } from './base-payment-simulator.provider';

@Injectable()
export class MerchantSimulatorProvider extends BasePaymentSimulatorProvider {
  constructor() {
    super('MERCHANT_SIMULATOR', 'Merchant Payment Simulator', [
      PaymentType.MERCHANT_PAYMENT,
      PaymentType.SCHEDULED_PAYMENT,
      PaymentType.RECURRING_PAYMENT,
      PaymentType.PAYMENT_REQUEST,
    ]);
  }
}
