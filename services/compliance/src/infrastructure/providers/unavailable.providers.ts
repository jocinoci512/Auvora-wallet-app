import { Injectable } from '@nestjs/common';
import type {
  AddressRiskProvider,
  BlockchainAnalyticsProvider,
  DocumentVerificationProvider,
  FraudProvider,
  IdentityVerificationProvider,
  PEPProvider,
  RiskScoringProvider,
  SanctionsProvider,
  TravelRuleProvider,
} from '../../domain';
import { computeCompositeRiskScore } from '../../domain';

/** Used when simulators are disabled — fail closed for KYC, conservative for fraud. */
@Injectable()
export class UnavailableIdentityProvider implements IdentityVerificationProvider {
  getCode(): string {
    return 'unavailable-identity';
  }
  async verifyIdentity() {
    return {
      providerCode: this.getCode(),
      providerRef: 'unavailable',
      status: 'REJECTED' as const,
      message: 'Identity provider not configured',
    };
  }
}

@Injectable()
export class UnavailableDocumentProvider implements DocumentVerificationProvider {
  getCode(): string {
    return 'unavailable-document';
  }
  async verifyDocument() {
    return {
      providerCode: this.getCode(),
      providerRef: 'unavailable',
      status: 'REJECTED' as const,
      message: 'Document provider not configured',
    };
  }
}

@Injectable()
export class UnavailableSanctionsProvider implements SanctionsProvider {
  getCode(): string {
    return 'unavailable-sanctions';
  }
  async screen() {
    return [
      {
        providerCode: this.getCode(),
        providerRef: 'unavailable',
        matchStatus: 'PENDING' as const,
        listSource: 'UNCONFIGURED',
      },
    ];
  }
}

@Injectable()
export class UnavailablePepProvider implements PEPProvider {
  getCode(): string {
    return 'unavailable-pep';
  }
  async screen() {
    return {
      providerCode: this.getCode(),
      providerRef: 'unavailable',
      matchStatus: 'PENDING' as const,
    };
  }
}

@Injectable()
export class UnavailableAddressRiskProvider implements AddressRiskProvider {
  getCode(): string {
    return 'unavailable-address-risk';
  }
  async assess() {
    return { score: 100, flags: ['provider_unavailable'] };
  }
}

@Injectable()
export class UnavailableBlockchainAnalyticsProvider implements BlockchainAnalyticsProvider {
  getCode(): string {
    return 'unavailable-chain-analytics';
  }
  async analyze() {
    return { score: 100, mixerExposure: false, darknetExposure: false, flags: ['provider_unavailable'] };
  }
}

@Injectable()
export class UnavailableFraudProvider implements FraudProvider {
  getCode(): string {
    return 'unavailable-fraud';
  }
  async evaluate() {
    return { allow: false, riskScore: 100, reasons: ['fraud_provider_unavailable'] };
  }
}

@Injectable()
export class LocalRiskScoringProvider implements RiskScoringProvider {
  getCode(): string {
    return 'local-risk-engine';
  }
  async score(input: { ownerUserId: string; factors: Record<string, number> }) {
    const result = computeCompositeRiskScore(input.factors);
    return { score: result.score, band: result.band, factors: result.normalized };
  }
}

@Injectable()
export class UnavailableTravelRuleProvider implements TravelRuleProvider {
  getCode(): string {
    return 'unavailable-travel-rule';
  }
  async submit() {
    return { providerRef: 'unavailable', status: 'FAILED' };
  }
}
