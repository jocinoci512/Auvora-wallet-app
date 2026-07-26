export interface IdentityVerificationRequest {
  subjectType: 'INDIVIDUAL' | 'BUSINESS';
  ownerUserId: string;
  legalName?: string;
  country?: string;
  dateOfBirth?: string;
  businessName?: string;
  level: string;
}

export interface IdentityVerificationResult {
  providerCode: string;
  providerRef: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  score?: number;
  message?: string;
}

export interface IdentityVerificationProvider {
  getCode(): string;
  verifyIdentity(input: IdentityVerificationRequest): Promise<IdentityVerificationResult>;
}

export interface DocumentVerificationRequest {
  documentType: string;
  ownerUserId: string;
  storageKey: string;
  contentType?: string;
}

export interface DocumentVerificationResult {
  providerCode: string;
  providerRef: string;
  status: 'VERIFIED' | 'REJECTED' | 'PROCESSING';
  message?: string;
}

export interface DocumentVerificationProvider {
  getCode(): string;
  verifyDocument(input: DocumentVerificationRequest): Promise<DocumentVerificationResult>;
}

export interface ScreeningRequest {
  ownerUserId: string;
  fullName: string;
  country?: string;
  dateOfBirth?: string;
}

export interface ScreeningResult {
  providerCode: string;
  providerRef: string;
  matchStatus: 'CLEAR' | 'POTENTIAL' | 'CONFIRMED' | 'FALSE_POSITIVE' | 'PENDING';
  matchScore?: number;
  matchedName?: string;
  listSource?: string;
  raw?: Record<string, unknown>;
}

export interface SanctionsProvider {
  getCode(): string;
  screen(input: ScreeningRequest): Promise<ScreeningResult[]>;
}

export interface PEPProvider {
  getCode(): string;
  screen(input: ScreeningRequest): Promise<ScreeningResult>;
}

export interface AddressRiskProvider {
  getCode(): string;
  assess(input: { address: string; chain?: string }): Promise<{ score: number; flags: string[] }>;
}

export interface BlockchainAnalyticsProvider {
  getCode(): string;
  analyze(input: {
    address: string;
    chain?: string;
  }): Promise<{ score: number; mixerExposure: boolean; darknetExposure: boolean; flags: string[] }>;
}

export interface FraudProvider {
  getCode(): string;
  evaluate(input: {
    ownerUserId: string;
    amount: string;
    currency: string;
    paymentType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ allow: boolean; riskScore: number; reasons: string[] }>;
}

export interface RiskScoringProvider {
  getCode(): string;
  score(input: {
    ownerUserId: string;
    factors: Record<string, number>;
  }): Promise<{ score: number; band: string; factors: Record<string, number> }>;
}

export interface TravelRuleProvider {
  getCode(): string;
  submit(input: {
    ownerUserId: string;
    paymentId?: string;
    direction: string;
    amount: string;
    currency: string;
  }): Promise<{ providerRef: string; status: string }>;
}
