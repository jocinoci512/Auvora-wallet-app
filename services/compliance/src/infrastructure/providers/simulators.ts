import { Injectable } from '@nestjs/common';
import type {
  DocumentVerificationProvider,
  DocumentVerificationRequest,
  DocumentVerificationResult,
  IdentityVerificationProvider,
  IdentityVerificationRequest,
  IdentityVerificationResult,
  ScreeningRequest,
  ScreeningResult,
  SanctionsProvider,
  PEPProvider,
  AddressRiskProvider,
  BlockchainAnalyticsProvider,
  FraudProvider,
  RiskScoringProvider,
  TravelRuleProvider,
} from '../../domain';
import { computeCompositeRiskScore } from '../../domain';

@Injectable()
export class IdentitySimulatorProvider implements IdentityVerificationProvider {
  getCode(): string {
    return 'local-identity-simulator';
  }

  async verifyIdentity(input: IdentityVerificationRequest): Promise<IdentityVerificationResult> {
    const rejected = (input.legalName ?? '').toLowerCase().includes('reject');
    return {
      providerCode: this.getCode(),
      providerRef: `id-${input.ownerUserId.slice(0, 8)}`,
      status: rejected ? 'REJECTED' : 'APPROVED',
      score: rejected ? 10 : 95,
      message: rejected ? 'Simulated identity rejection' : 'Simulated identity approval',
    };
  }
}

@Injectable()
export class DocumentSimulatorProvider implements DocumentVerificationProvider {
  getCode(): string {
    return 'local-document-simulator';
  }

  async verifyDocument(input: DocumentVerificationRequest): Promise<DocumentVerificationResult> {
    return {
      providerCode: this.getCode(),
      providerRef: `doc-${Date.now()}`,
      status: input.documentType === 'OTHER' ? 'PROCESSING' : 'VERIFIED',
    };
  }
}

@Injectable()
export class SanctionsSimulatorProvider implements SanctionsProvider {
  getCode(): string {
    return 'local-sanctions-simulator';
  }

  async screen(input: ScreeningRequest): Promise<ScreeningResult[]> {
    const hit = input.fullName.toLowerCase().includes('sanction');
    const lists = ['OFAC', 'UN', 'EU', 'UK'];
    return lists.map((listSource) => ({
      providerCode: this.getCode(),
      providerRef: `san-${listSource}-${input.ownerUserId.slice(0, 6)}`,
      matchStatus: hit && listSource === 'OFAC' ? 'POTENTIAL' : 'CLEAR',
      matchScore: hit && listSource === 'OFAC' ? 82 : 5,
      matchedName: hit && listSource === 'OFAC' ? input.fullName : undefined,
      listSource,
    }));
  }
}

@Injectable()
export class PepSimulatorProvider implements PEPProvider {
  getCode(): string {
    return 'local-pep-simulator';
  }

  async screen(input: ScreeningRequest): Promise<ScreeningResult> {
    const hit = input.fullName.toLowerCase().includes('pep');
    return {
      providerCode: this.getCode(),
      providerRef: `pep-${input.ownerUserId.slice(0, 8)}`,
      matchStatus: hit ? 'POTENTIAL' : 'CLEAR',
      matchScore: hit ? 75 : 3,
      matchedName: hit ? input.fullName : undefined,
    };
  }
}

@Injectable()
export class AddressRiskSimulatorProvider implements AddressRiskProvider {
  getCode(): string {
    return 'local-address-risk-simulator';
  }

  async assess(input: { address: string; chain?: string }) {
    const risky = input.address.toLowerCase().includes('risk');
    return { score: risky ? 80 : 12, flags: risky ? ['elevated_address_risk'] : [] };
  }
}

@Injectable()
export class BlockchainAnalyticsSimulatorProvider implements BlockchainAnalyticsProvider {
  getCode(): string {
    return 'local-chain-analytics-simulator';
  }

  async analyze(input: { address: string; chain?: string }) {
    const mixer = input.address.toLowerCase().includes('mixer');
    const darknet = input.address.toLowerCase().includes('dark');
    return {
      score: mixer || darknet ? 88 : 15,
      mixerExposure: mixer,
      darknetExposure: darknet,
      flags: [...(mixer ? ['mixer_exposure'] : []), ...(darknet ? ['darknet_exposure'] : [])],
    };
  }
}

@Injectable()
export class FraudSimulatorProvider implements FraudProvider {
  getCode(): string {
    return 'local-fraud-simulator';
  }

  async evaluate(input: {
    ownerUserId: string;
    amount: string;
    currency: string;
    paymentType?: string;
    metadata?: Record<string, unknown>;
  }) {
    const amount = Number(input.amount);
    const block = amount >= 100000 || Boolean(input.metadata?.['forceFraud']);
    return {
      allow: !block,
      riskScore: block ? 95 : amount >= 10000 ? 55 : 18,
      reasons: block ? ['simulated_high_value_fraud_signal'] : [],
    };
  }
}

@Injectable()
export class RiskScoringSimulatorProvider implements RiskScoringProvider {
  getCode(): string {
    return 'local-risk-simulator';
  }

  async score(input: { ownerUserId: string; factors: Record<string, number> }) {
    const result = computeCompositeRiskScore(input.factors);
    return { score: result.score, band: result.band, factors: result.normalized };
  }
}

@Injectable()
export class TravelRuleSimulatorProvider implements TravelRuleProvider {
  getCode(): string {
    return 'local-travel-rule-simulator';
  }

  async submit(input: {
    ownerUserId: string;
    paymentId?: string;
    direction: string;
    amount: string;
    currency: string;
  }) {
    return {
      providerRef: `tr-${input.ownerUserId.slice(0, 8)}`,
      status: Number(input.amount) >= 1000 ? 'SUBMITTED' : 'NOT_REQUIRED',
    };
  }
}

export const COMPLIANCE_SIMULATOR_PROVIDERS = [
  IdentitySimulatorProvider,
  DocumentSimulatorProvider,
  SanctionsSimulatorProvider,
  PepSimulatorProvider,
  AddressRiskSimulatorProvider,
  BlockchainAnalyticsSimulatorProvider,
  FraudSimulatorProvider,
  RiskScoringSimulatorProvider,
  TravelRuleSimulatorProvider,
] as const;
