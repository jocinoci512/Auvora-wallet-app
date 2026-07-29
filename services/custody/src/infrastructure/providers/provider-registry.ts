import { Inject, Injectable } from '@nestjs/common';
import type {
  CustodyModelCode,
  CustodyProviderPort,
  CustodyProviderRegistryPort,
} from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { SimulatorCustodyProvider } from './simulator.provider';
import { UnavailableCustodyProvider } from './unavailable.provider';

const ALL_MODELS: CustodyModelCode[] = ['SELF', 'HOSTED', 'SHARED', 'INSTITUTIONAL', 'MPC', 'HSM'];

/** Resolves the concrete custody backend strategy for a given custody model. */
@Injectable()
export class CustodyProviderRegistry implements CustodyProviderRegistryPort {
  private readonly providers = new Map<CustodyModelCode, CustodyProviderPort>();

  constructor(
    @Inject(ENV) env: ServiceEnv,
    @Inject(SimulatorCustodyProvider) simulator: SimulatorCustodyProvider,
    @Inject(UnavailableCustodyProvider) unavailable: UnavailableCustodyProvider,
  ) {
    const provider: CustodyProviderPort = env.CUSTODY_SIMULATOR_ENABLED ? simulator : unavailable;
    for (const model of ALL_MODELS) {
      this.providers.set(model, provider);
    }
  }

  resolve(custodyModel: CustodyModelCode): CustodyProviderPort {
    const provider = this.providers.get(custodyModel);
    if (!provider) {
      throw new Error(`No custody provider registered for model ${custodyModel}`);
    }
    return provider;
  }
}
