import { Injectable } from '@nestjs/common';
import { PaymentType } from '@auvora/database';
import { BasePaymentSimulatorProvider } from './base-payment-simulator.provider';

@Injectable()
export class LocalFiatSimulatorProvider extends BasePaymentSimulatorProvider {
  constructor() {
    super('LOCAL_FIAT_SIMULATOR', 'Local Fiat Simulator', [
      PaymentType.FIAT_DEPOSIT,
      PaymentType.FIAT_WITHDRAWAL,
    ]);
  }
}
