import {
  HealthStatus,
  type ApiResponse,
  type AuthTokens,
  type HealthCheckResponse,
  type JwtAccessClaims,
} from '@auvora/types';

export type { AuthTokens, JwtAccessClaims };

export interface AuvoraClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: Record<string, string>;
  credentials?: 'include' | 'omit' | 'same-origin';
  /** Default request timeout in ms (AbortSignal). Set 0 to disable. Default 30_000. */
  timeoutMs?: number;
}

export interface RegisterInput {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  deviceFingerprint?: string;
  deviceName?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  firstName: string | null;
  lastName: string | null;
  status: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export type WalletStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface Wallet {
  id: string;
  ownerUserId: string;
  assetId: string;
  assetCode: string;
  assetSymbol: string;
  assetDecimals: number;
  alias: string | null;
  label: string | null;
  status: WalletStatus;
  metadata: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface WalletListResult {
  items: Wallet[];
  total: number;
}

export interface WalletBalance {
  walletId: string;
  assetId: string;
  available: string;
  pending: string;
  locked: string;
  reserved?: string;
  total: string;
  updatedAt: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  type: string;
  status: string;
  amount: string;
  fromWalletId: string | null;
  toWalletId: string | null;
  description?: string | null;
  createdAt: string;
}

export interface CreateWalletInput {
  assetCode: string;
  alias?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface UpdateWalletInput {
  alias?: string;
  label?: string;
  metadata?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
}

export interface AdminListWalletsQuery {
  ownerUserId?: string;
  assetCode?: string;
  status?: WalletStatus;
  skip?: number;
  take?: number;
}

export interface StatusChangeInput {
  reason?: string;
}

export type ChainNetwork =
  'BITCOIN' | 'ETHEREUM' | 'POLYGON' | 'SOLANA' | 'BNB_SMART_CHAIN' | 'TRON' | 'LITECOIN';

export type ChainAddressStatus = 'PENDING' | 'ACTIVE' | 'ARCHIVED';

export type ChainTxDirection = 'INCOMING' | 'OUTGOING' | 'INTERNAL';

export type ChainTxStatus =
  'MEMPOOL' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REJECTED' | 'CANCELLED' | 'REORGED';

export type FeePriority = 'SLOW' | 'STANDARD' | 'FAST' | 'PRIORITY';

export type SyncJobType = 'BLOCK_SCAN' | 'ADDRESS_WATCH' | 'MEMPOOL' | 'REORG_CHECK' | 'RETRY';

export type SyncJobStatus =
  'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RETRYING' | 'CANCELLED';

export interface SupportedChain {
  id: string;
  chain: ChainNetwork;
  displayName: string;
  isEnabled: boolean;
  requiredConfirmations: number;
  blockTimeSeconds: number;
  nativeSymbol: string;
  explorerUrl: string | null;
}

export interface ChainAddress {
  id: string;
  chain: ChainNetwork;
  walletId: string | null;
  ownerUserId: string;
  address: string;
  label: string | null;
  isPrimary: boolean;
  status: ChainAddressStatus;
  watched: boolean;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  archivedAt: string | null;
}

export interface ChainAddressListResult {
  items: ChainAddress[];
  total: number;
}

export interface CreateChainAddressInput {
  chain: ChainNetwork;
  label?: string;
  walletId?: string;
}

export interface UpdateChainAddressInput {
  label?: string;
  watched?: boolean;
}

export interface ListChainAddressesQuery {
  chain?: ChainNetwork;
  status?: ChainAddressStatus;
  walletId?: string;
  skip?: number;
  take?: number;
}

export interface AdminListChainAddressesQuery extends ListChainAddressesQuery {
  ownerUserId?: string;
}

export interface ValidateAddressInput {
  chain: ChainNetwork;
  address: string;
}

export interface ValidateAddressResult {
  valid: boolean;
  chain: ChainNetwork;
  address: string;
}

export interface ChainBalance {
  addressId: string;
  chain: ChainNetwork;
  address: string;
  confirmed: string;
  unconfirmed: string;
  total: string;
  updatedAt: string;
}

export interface ChainTransaction {
  id: string;
  chain: ChainNetwork;
  addressId: string | null;
  txHash: string;
  direction: ChainTxDirection;
  status: ChainTxStatus;
  amount: string;
  feeAmount: string;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: string | null;
  confirmations: number;
  requiredConfirmations: number;
  broadcastAt: string | null;
  confirmedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChainTransactionListResult {
  items: ChainTransaction[];
  total: number;
}

export interface ListChainTransactionsQuery {
  addressId?: string;
  chain?: ChainNetwork;
  status?: ChainTxStatus;
  skip?: number;
  take?: number;
}

export interface EstimateFeeInput {
  chain: ChainNetwork;
  priority?: FeePriority;
}

export interface FeeEstimate {
  chain: ChainNetwork;
  priority: FeePriority;
  feeAmount: string;
  feeAsset: string;
  estimatedConfirmationSeconds: number | null;
}

export interface NetworkStatus {
  chain: ChainNetwork;
  isHealthy: boolean;
  blockHeight: string | null;
  latencyMs: number | null;
  lastCheckedAt: string | null;
}

export interface BlockchainProvider {
  id: string;
  chain: ChainNetwork;
  code: string;
  name: string;
  isPrimary: boolean;
  isEnabled: boolean;
  endpointUrl: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderHealthSnapshot {
  id: string;
  chain: ChainNetwork;
  providerId: string | null;
  status: string;
  latencyMs: number | null;
  blockHeight: string | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface LiveProviderRpcHealth {
  chain: ChainNetwork;
  status: 'up' | 'down' | 'degraded';
  backend: 'alchemy' | 'simulator';
  syncMode: 'live-backed' | 'simulator-only';
  latencyMs: number;
  latestBlockHeight: string | null;
  synchronized: boolean;
  lastSuccessfulRpc: string | null;
  endpoint: string | null;
  errorState: string | null;
  message?: string;
}

export interface LiveProviderRpcHealthSummary {
  sync: {
    mode: 'live-backed' | 'simulator-only';
    ledgerSyncEnabled: boolean;
    liveProvidersExpected: boolean;
    primaryProvider: string;
  };
  providers: LiveProviderRpcHealth[];
}

export interface SyncJob {
  id: string;
  chain: ChainNetwork;
  type: SyncJobType;
  status: SyncJobStatus;
  cursor: string | null;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SyncJobListResult {
  items: SyncJob[];
  total: number;
}

export interface ListSyncJobsQuery {
  chain?: ChainNetwork;
  status?: SyncJobStatus;
  skip?: number;
  take?: number;
}

export interface TriggerSyncInput {
  chain: ChainNetwork;
  type: SyncJobType;
}

export interface ChainBlock {
  id: string;
  chain: ChainNetwork;
  height: string;
  hash: string;
  parentHash: string | null;
  timestamp: string;
  isOrphan: boolean;
  syncedAt: string;
}

export interface ChainBlockListResult {
  items: ChainBlock[];
  total: number;
}

export interface ListChainBlocksQuery {
  chain?: ChainNetwork;
  skip?: number;
  take?: number;
}

export interface BlockchainMetrics {
  totalAddresses: number;
  totalTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  activeSyncJobs: number;
  healthyProviders: number;
  totalProviders: number;
  updatedAt: string;
}

export interface BlockchainEventLog {
  id: string;
  eventType: string;
  chain: ChainNetwork | null;
  aggregateId: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface BlockchainEventListResult {
  items: BlockchainEventLog[];
  total: number;
}

export interface ListBlockchainEventsQuery {
  eventType?: string;
  chain?: ChainNetwork;
  skip?: number;
  take?: number;
}

export type PaymentType =
  | 'FIAT_DEPOSIT'
  | 'FIAT_WITHDRAWAL'
  | 'CRYPTO_DEPOSIT'
  | 'CRYPTO_WITHDRAWAL'
  | 'INTERNAL_TRANSFER'
  | 'WALLET_TRANSFER'
  | 'MERCHANT_PAYMENT'
  | 'SCHEDULED_PAYMENT'
  | 'RECURRING_PAYMENT'
  | 'PAYMENT_REQUEST'
  | 'REFUND'
  | 'REVERSAL'
  | 'SETTLEMENT';

export type PaymentStatus =
  | 'CREATED'
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PROCESSING'
  | 'SETTLED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'FAILED'
  | 'EXPIRED'
  | 'REFUNDED'
  | 'REVERSED'
  | 'DISPUTED'
  | 'CHARGEBACK';

export type PaymentMethodType =
  'BANK_ACCOUNT' | 'CARD' | 'WALLET' | 'CRYPTO_ADDRESS' | 'MERCHANT' | 'OTHER';

export type SettlementMode = 'INSTANT' | 'DAILY' | 'SCHEDULED' | 'MANUAL';

export type SettlementStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ReconciliationStatus =
  'PENDING' | 'MATCHED' | 'MISMATCH' | 'EXCEPTION' | 'MANUAL_REVIEW' | 'RESOLVED';

export interface Payment {
  id: string;
  reference: string;
  type: PaymentType;
  status: PaymentStatus;
  ownerUserId: string;
  amount: string;
  feeAmount: string;
  currency: string;
  assetCode: string | null;
  fromWalletId: string | null;
  toWalletId: string | null;
  providerRef: string | null;
  idempotencyKey: string | null;
  correlationId: string | null;
  riskFlags: string[];
  description: string | null;
  failureReason: string | null;
  settledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListResult {
  items: Payment[];
  total: number;
}

export interface CreatePaymentInput {
  type: PaymentType;
  amount: string;
  currency: string;
  assetCode?: string;
  fromWalletId?: string;
  toWalletId?: string;
  paymentMethodId?: string;
  idempotencyKey?: string;
  correlationId?: string;
  country?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTransferInput {
  fromWalletId: string;
  toWalletId: string;
  amount: string;
  currency: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface CreatePaymentRequestInput {
  amount: string;
  currency: string;
  description?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchPaymentsQuery {
  type?: PaymentType;
  status?: PaymentStatus;
  currency?: string;
  skip?: number;
  take?: number;
}

export interface PaymentMethod {
  id: string;
  ownerUserId: string;
  type: PaymentMethodType;
  label: string | null;
  isDefault: boolean;
  isActive: boolean;
  last4: string | null;
  country: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodListResult {
  items: PaymentMethod[];
  total: number;
}

export interface CreatePaymentMethodInput {
  type: PaymentMethodType;
  label?: string;
  isDefault?: boolean;
  last4?: string;
  country?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentLimit {
  id: string;
  window: string;
  amount: string;
  currency: string | null;
  assetCode: string | null;
  accountTier: string | null;
  country: string | null;
  riskProfile: string | null;
  isEnabled: boolean;
}

export interface PaymentStatistics {
  totalPayments: number;
  totalCompleted: number;
  totalPending: number;
  totalFailed: number;
  totalVolume: string;
}

export interface PaymentReceipt {
  paymentId: string;
  reference: string;
  type: PaymentType;
  status: PaymentStatus;
  amount: string;
  currency: string;
  feeAmount: string;
  description: string | null;
  createdAt: string;
  completedAt: string | null;
  downloadFormat: 'json';
}

export interface PaymentProvider {
  id: string;
  code: string;
  name: string;
  providerType: string;
  isPrimary: boolean;
  isEnabled: boolean;
  priority: number;
}

export interface PaymentProviderHealth {
  id: string;
  providerCode: string;
  status: string;
  latencyMs: number | null;
  errorMessage: string | null;
  checkedAt: string;
}

export interface PaymentMetrics {
  totalPayments: number;
  pendingPayments: number;
  processingPayments: number;
  completedPayments: number;
  failedPayments: number;
  disputedPayments: number;
  openDisputes: number;
  openChargebacks: number;
  pendingReconciliation: number;
}

export interface Settlement {
  id: string;
  batchId: string | null;
  paymentId: string;
  mode: SettlementMode;
  status: SettlementStatus;
  amount: string;
  currency: string;
  reference: string;
  createdAt: string;
  completedAt: string | null;
}

export interface SettlementBatch {
  id: string;
  reference: string;
  mode: SettlementMode;
  status: SettlementStatus;
  currency: string;
  totalAmount: string;
  paymentCount: number;
  createdAt: string;
  completedAt: string | null;
}

export interface SettlementListResult {
  items: Settlement[];
  total: number;
}

export interface SettlementBatchListResult {
  items: SettlementBatch[];
  total: number;
}

export interface RunSettlementInput {
  mode: 'instant' | 'manual' | 'daily';
  paymentId?: string;
  paymentIds?: string[];
  currency?: string;
}

export interface ReconciliationRecord {
  id: string;
  paymentId: string | null;
  status: ReconciliationStatus;
  source: string;
  expectedAmount: string | null;
  actualAmount: string | null;
  currency: string | null;
  mismatchReason: string | null;
  requiresManualReview: boolean;
  createdAt: string;
}

export interface ReconciliationListResult {
  items: ReconciliationRecord[];
  total: number;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface Dispute {
  id: string;
  paymentId: string;
  status: string;
  reason: string | null;
  amount: string | null;
  currency: string | null;
  openedAt: string;
}

export interface Chargeback {
  id: string;
  paymentId: string;
  status: string;
  amount: string;
  currency: string;
  reason: string | null;
  openedAt: string;
}

export interface KycProfile {
  id: string;
  ownerUserId: string;
  subjectType: string;
  level: string;
  status: string;
  country: string | null;
  riskBand: string;
  riskScore: string;
  verifiedAt: string | null;
  expiresAt: string | null;
}

export interface VerificationRequest {
  id: string;
  profileId: string;
  ownerUserId: string;
  requestedLevel: string;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  completedAt: string | null;
}

export interface ComplianceDocument {
  id: string;
  documentType: string;
  status: string;
  fileName: string | null;
  createdAt: string;
}

export interface SubmitKycInput {
  subjectType?: string;
  requestedLevel: string;
  country?: string;
  nationality?: string;
  legalName?: string;
  dateOfBirth?: string;
  businessName?: string;
}

export interface UploadComplianceDocumentInput {
  documentType: string;
  storageKey: string;
  contentType?: string;
  fileName?: string;
  verificationRequestId?: string;
}

export interface ComplianceRiskSummary {
  score: string | number;
  band: string;
  level: string;
  status: string;
}

export interface ComplianceRiskRecord {
  id: string;
  ownerUserId: string;
  score: string | number;
  band: string;
  factors: Record<string, unknown>;
  providerCode: string;
  createdAt: string;
}

export interface CreateComplianceRuleInput {
  code: string;
  name: string;
  description?: string;
  action: string;
  priority?: number;
  expression: Record<string, unknown>;
  isEnabled?: boolean;
}

export interface UpdateComplianceRuleInput {
  name?: string;
  description?: string;
  action?: string;
  priority?: number;
  expression?: Record<string, unknown>;
}

export interface RecomputeComplianceRiskInput {
  factors: Record<string, number>;
}

export interface ComplianceDashboardMetrics {
  openAlerts: number;
  openCases: number;
  pendingKyc: number;
  enabledProviders: number;
  enabledRules: number;
}

export interface AmlAlert {
  id: string;
  ruleCode: string;
  severity: string;
  status: string;
  title: string;
  createdAt: string;
}

export interface ComplianceCase {
  id: string;
  reference: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
}

export interface ComplianceRule {
  id: string;
  code: string;
  name: string;
  action: string;
  isEnabled: boolean;
  priority: number;
}

export interface ComplianceProvider {
  id: string;
  code: string;
  name: string;
  providerType: string;
  isEnabled: boolean;
  priority: number;
}

export interface CustodyKey {
  id: string;
  ownerUserId: string;
  walletId?: string | null;
  label?: string | null;
  algorithm: string;
  custodyModel: string;
  status: string;
  publicKey: string;
  currentVersion: number;
  createdAt: string;
}

export interface GenerateCustodyKeyInput {
  algorithm: string;
  custodyModel: string;
  walletId?: string;
  label?: string;
}

export interface SigningRequest {
  id: string;
  keyId: string;
  ownerUserId: string;
  requestType: string;
  status: string;
  payloadHash: string;
  amount?: string | null;
  asset?: string | null;
  destination?: string | null;
  requiredApprovals: number;
  receivedApprovals: number;
  signature?: string | null;
  createdAt: string;
}

export interface CreateSigningRequestInput {
  keyId: string;
  requestType?: string;
  payload: string;
  amount?: string;
  asset?: string;
  destination?: string;
  metadata?: Record<string, unknown>;
}

export interface RecoveryContact {
  id: string;
  policyId: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

export interface AddRecoveryContactInput {
  policyId: string;
  label: string;
  email?: string;
  phone?: string;
}

export interface CustodyActivityItem {
  id: string;
  action: string;
  keyId?: string | null;
  createdAt: string;
  details?: Record<string, unknown> | null;
}

export interface CustodyStatusSummary {
  keyCount: number;
  pendingApprovals: number;
  openRecoveries: number;
  activeProviders: number;
}

export interface CustodyDashboardMetrics {
  activeKeys: number;
  revokedKeys?: number;
  pendingSigning: number;
  pendingApprovals: number;
  pendingRecovery?: number;
  openRecoveries?: number;
  enabledProviders: number;
  enabledPolicies?: number;
  recentViolations?: unknown[];
  policyViolations24h?: number;
}

export interface ApprovalQueueItem {
  id: string;
  signingRequestId: string;
  status: string;
  createdAt: string;
}

export interface CustodyProvider {
  id: string;
  code: string;
  name: string;
  custodyModel: string;
  isEnabled: boolean;
  priority: number;
  healthStatus: string;
}

export interface CustodyApprovalPolicy {
  id: string;
  code: string;
  name: string;
  kind: string;
  threshold: number;
  isEnabled: boolean;
}

export interface SignerGroup {
  id: string;
  name: string;
  threshold: number;
  totalSigners: number;
  isEnabled: boolean;
}

export interface CustodyAuditItem {
  id: string;
  action: string;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  ownerUserId?: string | null;
  category: string;
  channel: string;
  priority: string;
  status: string;
  subject?: string | null;
  body: string;
  failureReason?: string | null;
  createdAt: string;
}

export interface NotificationPreferences {
  id: string;
  ownerUserId: string;
  language: string;
  timeZone: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  digestEnabled: boolean;
  channelToggles: Record<string, unknown>;
  categoryToggles: Record<string, unknown>;
}

export interface UpdateNotificationPreferencesInput {
  language?: string;
  timeZone?: string;
  quietHoursStart?: number | null;
  quietHoursEnd?: number | null;
  digestEnabled?: boolean;
  channelToggles?: Record<string, unknown>;
  categoryToggles?: Record<string, unknown>;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  isEnabled: boolean;
  version: string;
  createdAt: string;
}

export interface CreateWebhookEndpointInput {
  name: string;
  url: string;
  eventFilters?: string[];
}

export interface NotificationDashboardMetrics {
  sent: number;
  delivered: number;
  failed: number;
  deadLetter: number;
  queueLength: number;
  averageLatencyMs: number;
  successRate: number;
}

export interface NotificationProvider {
  id: string;
  code: string;
  name: string;
  channel: string;
  isEnabled: boolean;
  healthStatus: string;
  priority: number;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  category: string;
  channel: string;
  locale: string;
  currentVersion: number;
  isEnabled: boolean;
}

export interface NotificationQueueItem {
  id: string;
  notificationId: string;
  priority: string;
  status: string;
  attemptCount: number;
  availableAt: string;
}

export interface BroadcastNotificationInput {
  subject?: string;
  body: string;
  channel: string;
  category: string;
  all?: boolean;
  userIds?: string[];
  roles?: string[];
}

export interface AiAssistant {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  type: string;
  isEnabled: boolean;
}

export interface AiChatInput {
  assistantId?: string;
  conversationId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface AiChatMessage {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export interface AiChatResult {
  conversationId: string;
  message: AiChatMessage;
}

export interface AiConversation {
  id: string;
  ownerUserId?: string | null;
  assistantId?: string | null;
  title?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiConversationDetail extends AiConversation {
  messages: AiChatMessage[];
}

export interface AiKnowledgeSearchResult {
  id: string;
  title: string;
  snippet: string;
  score: number;
  sourceId?: string | null;
}

export interface SubmitAiMessageFeedbackInput {
  rating: 'UP' | 'DOWN';
  comment?: string;
}

export interface AiDashboardMetrics {
  totalConversations: number;
  totalMessages: number;
  activeUsers: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  errorRate: number;
}

export interface AiProvider {
  id: string;
  code: string;
  name: string;
  model: string;
  isEnabled: boolean;
  healthStatus: string;
  priority: number;
}

export interface UpsertAiProviderInput {
  code: string;
  name: string;
  providerType: 'OPENAI' | 'ANTHROPIC' | 'GEMINI' | 'AZURE_OPENAI' | 'LOCAL' | 'SIMULATOR';
  priority: number;
  defaultModel?: string;
  baseUrl?: string;
  isEnabled?: boolean;
}

export interface UpdateAiProviderInput {
  priority?: number;
  name?: string;
  defaultModel?: string;
}

export interface AiPrompt {
  id: string;
  code: string;
  name: string;
  category: string;
  currentVersion: number;
  isEnabled: boolean;
}

export interface AiUsageMetrics {
  period: string;
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  byProvider: Record<string, number>;
}

export interface AiKnowledgeSource {
  id: string;
  name: string;
  type: string;
  status: string;
  documentCount: number;
  lastSyncedAt?: string | null;
}

export interface AnalyticsMetricSnapshot {
  code: string;
  name: string;
  value: number;
  unit?: string | null;
  trend?: number | null;
}

export interface AnalyticsKpiSnapshot {
  code: string;
  name: string;
  currentValue: number;
  targetValue?: number | null;
  status: 'ON_TRACK' | 'WARNING' | 'CRITICAL' | 'UNKNOWN';
}

export interface AnalyticsSummary {
  period: string;
  totalEvents: number;
  activeUsers: number;
  topMetrics: AnalyticsMetricSnapshot[];
  kpiHighlights: AnalyticsKpiSnapshot[];
}

export interface AnalyticsDashboard {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  domain?: string | null;
  visibility: string;
  isSystem: boolean;
  isEnabled: boolean;
}

export interface AnalyticsDashboardWidget {
  id: string;
  title: string;
  widgetType: string;
  metricCode?: string | null;
  kpiCode?: string | null;
  config?: Record<string, unknown> | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

export interface AnalyticsDashboardDetail extends AnalyticsDashboard {
  widgets: AnalyticsDashboardWidget[];
}

export interface AnalyticsReport {
  id: string;
  name: string;
  status: string;
  format: string;
  templateId?: string | null;
  generatedAt?: string | null;
  createdAt: string;
}

export interface GenerateAnalyticsReportInput {
  templateCode?: string;
  name?: string;
  format?: 'JSON' | 'CSV' | 'XLSX' | 'PDF';
  parameters?: Record<string, unknown>;
}

export interface AnalyticsKpi {
  id: string;
  code: string;
  name: string;
  domain: string;
  metricCode: string;
  targetValue?: number | null;
  currentValue?: number | null;
  status?: string | null;
  higherIsBetter: boolean;
}

export interface AnalyticsInsight {
  category: string;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metricCode?: string | null;
  value?: number | null;
}

export interface AnalyticsInsightsSummary {
  generatedAt: string;
  insights: AnalyticsInsight[];
  eventVolume: number;
  aggregationLagMs?: number | null;
}

export interface AnalyticsMetricDefinition {
  id: string;
  code: string;
  name: string;
  domain: string;
  valueType: string;
  unit?: string | null;
  isEnabled: boolean;
}

export interface AnalyticsMetricValuePoint {
  bucketStart: string;
  value: number;
  window: string;
  sampleCount: number;
}

export interface AnalyticsMetricDetail extends AnalyticsMetricDefinition {
  latestValue?: number | null;
  values?: AnalyticsMetricValuePoint[];
}

export interface AnalyticsForecastResult {
  id: string;
  status: string;
  horizonStart: string;
  horizonEnd: string;
  points: Array<{ timestamp: string; value: number }>;
  confidence?: number | null;
  generatedAt?: string | null;
}

export interface AnalyticsForecast {
  id: string;
  code: string;
  name: string;
  domain: string;
  metricCode: string;
  algorithm: string;
  horizon: string;
  isEnabled: boolean;
  latestResult?: AnalyticsForecastResult | null;
}

export interface AnalyticsAggregationJob {
  id: string;
  jobType: string;
  window: string;
  status: string;
  domain?: string | null;
  processedCount: number;
  startedAt?: string | null;
  completedAt?: string | null;
  errorMessage?: string | null;
}

export interface RunAnalyticsAggregationInput {
  window?: 'HOURLY' | 'DAILY' | 'MONTHLY';
  domain?: string;
  bucketStart?: string;
}

export interface PlatformStatus {
  overall: string;
  generatedAt: string;
  services: Array<{ serviceName: string; status: string }>;
  maintenanceNotices: MaintenanceNotice[];
  incidents: PublicIncident[];
}

export interface MaintenanceNotice {
  id: string;
  title: string;
  message: string;
  severity: string;
  startsAt: string;
  endsAt?: string | null;
}

export interface PublicIncident {
  code: string;
  title: string;
  status: string;
  severity: string;
  startedAt: string;
}

export interface OpsAlert {
  id: string;
  code: string;
  title: string;
  message: string;
  severity: string;
  status: string;
  serviceName?: string | null;
  firedAt: string;
}

export interface OpsIncident {
  id: string;
  code: string;
  title: string;
  status: string;
  severity: string;
  serviceName?: string | null;
  startedAt: string;
}

export interface OpsSlo {
  id: string;
  code: string;
  name: string;
  serviceName: string;
  targetPercent: number;
  indicatorType: string;
}

export interface OpsCapacityOverview {
  latest: unknown[];
  samples: unknown[];
  forecast: unknown;
}

export interface OpsHealthOverview {
  services: Array<{ serviceName: string; status: string }>;
  recent: unknown[];
}

export interface OpsDependencyGraph {
  nodes: Array<{ id: string }>;
  edges: unknown[];
}

export interface OpsTrace {
  id: string;
  traceId: string;
  rootService?: string | null;
  durationMs?: number | null;
  startedAt: string;
}

export interface OpsLogEntry {
  id: string;
  serviceName: string;
  level: string;
  message: string;
  occurredAt: string;
}

export interface OpsDashboardOverview {
  generatedAt: string;
  openAlertCount: number;
  openIncidentCount: number;
  unhealthyServiceCount: number;
  openAlerts: OpsAlert[];
  openIncidents: OpsIncident[];
  services: Array<{ serviceName: string; status: string }>;
  maintenanceNotices: MaintenanceNotice[];
  slos: OpsSlo[];
}

export interface InfraEnvironment {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfraDeployment {
  id: string;
  environmentCode: string;
  version: string;
  strategy: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  actorUserId: string | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfraBackupJob {
  id: string;
  environmentCode: string;
  componentKind: string;
  componentName: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  location: string | null;
  checksum: string | null;
  verifiedAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface InfraRecoveryDrill {
  id: string;
  environmentCode: string;
  name: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  rtoMinutes: number | null;
  rpoMinutes: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureFlag {
  id: string;
  code: string;
  description: string | null;
  enabled: boolean;
  environmentCode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateFeatureFlagInput {
  enabled?: boolean;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface AdminUserSearchResult {
  total: number;
  users: UserProfile[];
}

export interface AdminSearchUsersQuery {
  query?: string;
  status?: string;
  skip?: number;
  take?: number;
}

export interface SecurityAuditLog {
  id: string;
  action: string;
  actorUserId: string | null;
  targetUserId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface AdminAuditListResult {
  total: number;
  logs: SecurityAuditLog[];
}

export interface AdminAuditQuery {
  action?: string;
  actorUserId?: string;
  targetUserId?: string;
  skip?: number;
  take?: number;
}

export interface AdminMaintenanceNotice extends MaintenanceNotice {
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMaintenanceInput {
  title: string;
  message: string;
  severity?: string;
  startsAt: string;
  endsAt?: string;
}

export interface InfraDashboardOverview {
  generatedAt: string;
  activeEnvironmentCount: number;
  enabledFeatureFlagCount: number;
  environments: InfraEnvironment[];
  recentDeployments: InfraDeployment[];
  recentBackups: InfraBackupJob[];
  activeDrills: InfraRecoveryDrill[];
  featureFlags: FeatureFlag[];
  deploymentCounts: Record<string, number>;
  backupCounts: Record<string, number>;
}

export interface BroadcastNotificationResult {
  broadcastId: string;
  recipientCount: number;
  enqueued?: number;
  count?: number;
}

export class AuvoraClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'AuvoraClientError';
  }
}

export class AuvoraClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly credentials: 'include' | 'omit' | 'same-origin';
  private readonly timeoutMs: number;
  private accessToken: string | null = null;

  constructor(options: AuvoraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    // Never store bare `fetch` — calling it as `this.fetchImpl(...)` loses the Window binding
    // and throws "Illegal invocation" in browsers.
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.credentials = options.credentials ?? 'include';
    this.timeoutMs = options.timeoutMs === undefined ? 30_000 : options.timeoutMs;
  }

  private requestSignal(): AbortSignal | undefined {
    if (!this.timeoutMs || this.timeoutMs <= 0) return undefined;
    return AbortSignal.timeout(this.timeoutMs);
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  async getHealth(): Promise<HealthCheckResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/health`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...this.defaultHeaders,
      },
      signal: this.requestSignal(),
    });

    const body: unknown = await response.json().catch(() => undefined);

    if (!response.ok) {
      throw new AuvoraClientError(
        `Health check failed with status ${response.status}`,
        response.status,
        body,
      );
    }

    return this.parseHealth(body);
  }

  async register(input: RegisterInput): Promise<{ userId: string; message: string }> {
    return this.request('POST', '/api/v1/auth/register', input);
  }

  async login(input: LoginInput): Promise<AuthTokens & { csrfToken: string }> {
    const result = await this.request<AuthTokens & { csrfToken: string }>(
      'POST',
      '/api/v1/auth/login',
      input,
    );
    this.accessToken = result.accessToken;
    return result;
  }

  async refresh(): Promise<AuthTokens> {
    const result = await this.request<AuthTokens>('POST', '/api/v1/auth/refresh', {});
    this.accessToken = result.accessToken;
    return result;
  }

  async logout(): Promise<{ message: string }> {
    const result = await this.request<{ message: string }>('POST', '/api/v1/auth/logout', {});
    this.accessToken = null;
    return result;
  }

  async getMe(): Promise<UserProfile> {
    return this.request<UserProfile>('GET', '/api/v1/me');
  }

  async listWallets(skip = 0, take = 50): Promise<WalletListResult> {
    const params = new URLSearchParams({ skip: String(skip), take: String(take) });
    return this.request<WalletListResult>('GET', `/api/v1/wallets?${params}`);
  }

  async createWallet(input: CreateWalletInput): Promise<Wallet> {
    return this.request<Wallet>('POST', '/api/v1/wallets', input);
  }

  async getWallet(walletId: string): Promise<Wallet> {
    return this.request<Wallet>('GET', `/api/v1/wallets/${walletId}`);
  }

  async getWalletBalance(walletId: string): Promise<WalletBalance> {
    return this.request<WalletBalance>('GET', `/api/v1/wallets/${walletId}/balance`);
  }

  async getWalletTransactions(walletId: string, skip = 0, take = 50): Promise<WalletTransaction[]> {
    const params = new URLSearchParams({ skip: String(skip), take: String(take) });
    return this.request<WalletTransaction[]>(
      'GET',
      `/api/v1/wallets/${walletId}/transactions?${params}`,
    );
  }

  async updateWallet(walletId: string, input: UpdateWalletInput): Promise<Wallet> {
    return this.request<Wallet>('PATCH', `/api/v1/wallets/${walletId}`, input);
  }

  async suspendWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/wallets/${walletId}/suspend`, input);
  }

  async archiveWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/wallets/${walletId}/archive`, input);
  }

  async restoreWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/wallets/${walletId}/restore`, input);
  }

  async activateWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/wallets/${walletId}/activate`, input);
  }

  async adminListWallets(query: AdminListWalletsQuery = {}): Promise<WalletListResult> {
    const params = new URLSearchParams();
    if (query.ownerUserId) params.set('ownerUserId', query.ownerUserId);
    if (query.assetCode) params.set('assetCode', query.assetCode);
    if (query.status) params.set('status', query.status);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    const qs = params.toString();
    return this.request<WalletListResult>('GET', `/api/v1/admin/wallets?${qs}`);
  }

  async adminGetWallet(walletId: string): Promise<Wallet> {
    return this.request<Wallet>('GET', `/api/v1/admin/wallets/${walletId}`);
  }

  async adminSuspendWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/admin/wallets/${walletId}/suspend`, input);
  }

  async adminRestoreWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/admin/wallets/${walletId}/restore`, input);
  }

  async adminArchiveWallet(walletId: string, input: StatusChangeInput = {}): Promise<Wallet> {
    return this.request<Wallet>('POST', `/api/v1/admin/wallets/${walletId}/archive`, input);
  }

  async listChains(): Promise<SupportedChain[]> {
    return this.request<SupportedChain[]>('GET', '/api/v1/blockchain/chains');
  }

  async createAddress(input: CreateChainAddressInput): Promise<ChainAddress> {
    return this.request<ChainAddress>('POST', '/api/v1/blockchain/addresses', input);
  }

  async listAddresses(query: ListChainAddressesQuery = {}): Promise<ChainAddressListResult> {
    const params = new URLSearchParams();
    if (query.chain) params.set('chain', query.chain);
    if (query.status) params.set('status', query.status);
    if (query.walletId) params.set('walletId', query.walletId);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<ChainAddressListResult>('GET', `/api/v1/blockchain/addresses?${params}`);
  }

  async getAddress(addressId: string): Promise<ChainAddress> {
    return this.request<ChainAddress>('GET', `/api/v1/blockchain/addresses/${addressId}`);
  }

  async updateAddress(addressId: string, input: UpdateChainAddressInput): Promise<ChainAddress> {
    return this.request<ChainAddress>('PATCH', `/api/v1/blockchain/addresses/${addressId}`, input);
  }

  async activateAddress(addressId: string): Promise<ChainAddress> {
    return this.request<ChainAddress>(
      'POST',
      `/api/v1/blockchain/addresses/${addressId}/activate`,
      {},
    );
  }

  async archiveAddress(addressId: string): Promise<ChainAddress> {
    return this.request<ChainAddress>(
      'POST',
      `/api/v1/blockchain/addresses/${addressId}/archive`,
      {},
    );
  }

  async setPrimaryAddress(addressId: string): Promise<ChainAddress> {
    return this.request<ChainAddress>(
      'POST',
      `/api/v1/blockchain/addresses/${addressId}/set-primary`,
      {},
    );
  }

  async validateAddress(input: ValidateAddressInput): Promise<ValidateAddressResult> {
    return this.request<ValidateAddressResult>(
      'POST',
      '/api/v1/blockchain/addresses/validate',
      input,
    );
  }

  async getChainBalance(addressId: string): Promise<ChainBalance> {
    return this.request<ChainBalance>('GET', `/api/v1/blockchain/addresses/${addressId}/balance`);
  }

  async getChainTransaction(transactionId: string): Promise<ChainTransaction> {
    return this.request<ChainTransaction>(
      'GET',
      `/api/v1/blockchain/transactions/${transactionId}`,
    );
  }

  async listChainTransactions(
    query: ListChainTransactionsQuery = {},
  ): Promise<ChainTransactionListResult> {
    const params = new URLSearchParams();
    if (query.addressId) params.set('addressId', query.addressId);
    if (query.chain) params.set('chain', query.chain);
    if (query.status) params.set('status', query.status);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<ChainTransactionListResult>(
      'GET',
      `/api/v1/blockchain/transactions?${params}`,
    );
  }

  async estimateFee(input: EstimateFeeInput): Promise<FeeEstimate> {
    return this.request<FeeEstimate>('POST', '/api/v1/blockchain/fees/estimate', input);
  }

  async getNetworkStatus(chain?: ChainNetwork): Promise<NetworkStatus[]> {
    const params = chain ? `?${new URLSearchParams({ chain })}` : '';
    return this.request<NetworkStatus[]>('GET', `/api/v1/blockchain/network-status${params}`);
  }

  async adminListProviders(chain?: ChainNetwork): Promise<BlockchainProvider[]> {
    const params = chain ? `?${new URLSearchParams({ chain })}` : '';
    return this.request<BlockchainProvider[]>('GET', `/api/v1/admin/blockchain/providers${params}`);
  }

  async adminBlockchainHealth(): Promise<ProviderHealthSnapshot[]> {
    return this.request<ProviderHealthSnapshot[]>('GET', '/api/v1/admin/blockchain/health');
  }

  async adminBlockchainLiveRpcHealth(): Promise<LiveProviderRpcHealthSummary> {
    return this.request<LiveProviderRpcHealthSummary>(
      'GET',
      '/api/v1/admin/blockchain/providers/rpc-health',
    );
  }

  async adminListSyncJobs(query: ListSyncJobsQuery = {}): Promise<SyncJobListResult> {
    const params = new URLSearchParams();
    if (query.chain) params.set('chain', query.chain);
    if (query.status) params.set('status', query.status);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<SyncJobListResult>('GET', `/api/v1/admin/blockchain/sync-jobs?${params}`);
  }

  async adminTriggerSync(input: TriggerSyncInput): Promise<SyncJob> {
    return this.request<SyncJob>('POST', '/api/v1/admin/blockchain/sync-jobs/trigger', input);
  }

  async adminListBlocks(query: ListChainBlocksQuery = {}): Promise<ChainBlockListResult> {
    const params = new URLSearchParams();
    if (query.chain) params.set('chain', query.chain);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<ChainBlockListResult>('GET', `/api/v1/admin/blockchain/blocks?${params}`);
  }

  async adminListChainTransactions(
    query: ListChainTransactionsQuery = {},
  ): Promise<ChainTransactionListResult> {
    const params = new URLSearchParams();
    if (query.addressId) params.set('addressId', query.addressId);
    if (query.chain) params.set('chain', query.chain);
    if (query.status) params.set('status', query.status);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<ChainTransactionListResult>(
      'GET',
      `/api/v1/admin/blockchain/transactions?${params}`,
    );
  }

  async adminListAddresses(
    query: AdminListChainAddressesQuery = {},
  ): Promise<ChainAddressListResult> {
    const params = new URLSearchParams();
    if (query.ownerUserId) params.set('ownerUserId', query.ownerUserId);
    if (query.chain) params.set('chain', query.chain);
    if (query.status) params.set('status', query.status);
    if (query.walletId) params.set('walletId', query.walletId);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<ChainAddressListResult>(
      'GET',
      `/api/v1/admin/blockchain/addresses?${params}`,
    );
  }

  async adminBlockchainMetrics(): Promise<BlockchainMetrics> {
    return this.request<BlockchainMetrics>('GET', '/api/v1/admin/blockchain/metrics');
  }

  async adminListBlockchainEvents(
    query: ListBlockchainEventsQuery = {},
  ): Promise<BlockchainEventListResult> {
    const params = new URLSearchParams();
    if (query.eventType) params.set('eventType', query.eventType);
    if (query.chain) params.set('chain', query.chain);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<BlockchainEventListResult>(
      'GET',
      `/api/v1/admin/blockchain/events?${params}`,
    );
  }

  async createPayment(input: CreatePaymentInput): Promise<Payment> {
    return this.request<Payment>('POST', '/api/v1/payments', input);
  }

  async searchPayments(query: SearchPaymentsQuery = {}): Promise<PaymentListResult> {
    const params = new URLSearchParams();
    if (query.type) params.set('type', query.type);
    if (query.status) params.set('status', query.status);
    if (query.currency) params.set('currency', query.currency);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<PaymentListResult>('GET', `/api/v1/payments?${params}`);
  }

  async getPayment(paymentId: string): Promise<Payment> {
    return this.request<Payment>('GET', `/api/v1/payments/${paymentId}`);
  }

  async cancelPayment(paymentId: string): Promise<Payment> {
    return this.request<Payment>('POST', `/api/v1/payments/${paymentId}/cancel`, {});
  }

  async refundPayment(
    paymentId: string,
    input: { amount?: string; reason?: string } = {},
  ): Promise<Payment> {
    return this.request<Payment>('POST', `/api/v1/payments/${paymentId}/refund`, input);
  }

  async createTransfer(input: CreateTransferInput): Promise<Payment> {
    return this.request<Payment>('POST', '/api/v1/payments/transfers', input);
  }

  async createPaymentRequest(input: CreatePaymentRequestInput): Promise<Payment> {
    return this.request<Payment>('POST', '/api/v1/payments/requests', input);
  }

  async listPaymentMethods(): Promise<PaymentMethodListResult> {
    return this.request<PaymentMethodListResult>('GET', '/api/v1/payments/methods');
  }

  async createPaymentMethod(input: CreatePaymentMethodInput): Promise<PaymentMethod> {
    return this.request<PaymentMethod>('POST', '/api/v1/payments/methods', input);
  }

  async listPaymentLimits(): Promise<PaymentLimit[]> {
    return this.request<PaymentLimit[]>('GET', '/api/v1/payments/limits');
  }

  async getPaymentStatistics(): Promise<PaymentStatistics> {
    return this.request<PaymentStatistics>('GET', '/api/v1/payments/statistics');
  }

  async getPaymentReceipt(paymentId: string): Promise<PaymentReceipt> {
    return this.request<PaymentReceipt>('GET', `/api/v1/payments/${paymentId}/receipt`);
  }

  async adminPaymentMetrics(): Promise<PaymentMetrics> {
    return this.request<PaymentMetrics>('GET', '/api/v1/admin/payments/metrics');
  }

  async adminSearchPayments(
    query: SearchPaymentsQuery & { ownerUserId?: string } = {},
  ): Promise<PaymentListResult> {
    const params = new URLSearchParams();
    if (query.type) params.set('type', query.type);
    if (query.status) params.set('status', query.status);
    if (query.currency) params.set('currency', query.currency);
    if (query.ownerUserId) params.set('ownerUserId', query.ownerUserId);
    params.set('skip', String(query.skip ?? 0));
    params.set('take', String(query.take ?? 50));
    return this.request<PaymentListResult>('GET', `/api/v1/admin/payments?${params}`);
  }

  async adminListPaymentProviders(): Promise<PaymentProvider[]> {
    return this.request<PaymentProvider[]>('GET', '/api/v1/admin/payments/providers');
  }

  async adminPaymentHealth(): Promise<PaymentProviderHealth[]> {
    const result = await this.request<{ items: PaymentProviderHealth[]; total: number }>(
      'GET',
      '/api/v1/admin/payments/health',
    );
    return result.items;
  }

  async adminListSettlements(): Promise<SettlementListResult> {
    return this.request<SettlementListResult>('GET', '/api/v1/admin/payments/settlements');
  }

  async adminRunSettlement(input: RunSettlementInput): Promise<SettlementBatch> {
    return this.request<SettlementBatch>('POST', '/api/v1/admin/payments/settlements/run', input);
  }

  async adminListSettlementBatches(): Promise<SettlementBatchListResult> {
    return this.request<SettlementBatchListResult>(
      'GET',
      '/api/v1/admin/payments/settlements/batches',
    );
  }

  async adminListPaymentLimits(): Promise<PaymentLimit[]> {
    const result = await this.request<{ items: PaymentLimit[]; total: number }>(
      'GET',
      '/api/v1/admin/payments/limits',
    );
    return result.items;
  }

  async adminListRefunds(): Promise<{ items: Refund[]; total: number }> {
    return this.request<{ items: Refund[]; total: number }>(
      'GET',
      '/api/v1/admin/payments/refunds',
    );
  }

  async adminListDisputes(): Promise<{ items: Dispute[]; total: number }> {
    return this.request<{ items: Dispute[]; total: number }>(
      'GET',
      '/api/v1/admin/payments/disputes',
    );
  }

  async adminListChargebacks(): Promise<{ items: Chargeback[]; total: number }> {
    return this.request<{ items: Chargeback[]; total: number }>(
      'GET',
      '/api/v1/admin/payments/chargebacks',
    );
  }

  async adminListReconciliation(): Promise<ReconciliationListResult> {
    return this.request<ReconciliationListResult>('GET', '/api/v1/admin/payments/reconciliation');
  }

  async adminRunReconciliation(): Promise<{ processed: number; mismatches: number }> {
    return this.request<{ processed: number; mismatches: number }>(
      'POST',
      '/api/v1/admin/payments/reconciliation/run',
      {},
    );
  }

  async getComplianceProfile(): Promise<KycProfile> {
    return this.request<KycProfile>('GET', '/api/v1/compliance/profile');
  }

  async submitKyc(input: SubmitKycInput): Promise<VerificationRequest> {
    return this.request<VerificationRequest>('POST', '/api/v1/compliance/kyc', input);
  }

  async getKycStatus(): Promise<VerificationRequest | null> {
    return this.request<VerificationRequest | null>('GET', '/api/v1/compliance/kyc/status');
  }

  async listComplianceDocuments(): Promise<ComplianceDocument[]> {
    return this.request<ComplianceDocument[]>('GET', '/api/v1/compliance/documents');
  }

  async uploadComplianceDocument(
    input: UploadComplianceDocumentInput,
  ): Promise<ComplianceDocument> {
    return this.request<ComplianceDocument>('POST', '/api/v1/compliance/documents', input);
  }

  async getComplianceRisk(): Promise<ComplianceRiskSummary> {
    return this.request<ComplianceRiskSummary>('GET', '/api/v1/compliance/risk');
  }

  async getComplianceRiskHistory(): Promise<ComplianceRiskRecord[]> {
    return this.request<ComplianceRiskRecord[]>('GET', '/api/v1/compliance/risk/history');
  }

  async adminComplianceDashboard(): Promise<ComplianceDashboardMetrics> {
    return this.request<ComplianceDashboardMetrics>('GET', '/api/v1/admin/compliance/dashboard');
  }

  async adminComplianceKycQueue(): Promise<VerificationRequest[]> {
    return this.request<VerificationRequest[]>('GET', '/api/v1/admin/compliance/kyc/queue');
  }

  async adminApproveKyc(id: string): Promise<VerificationRequest> {
    return this.request<VerificationRequest>(
      'POST',
      `/api/v1/admin/compliance/kyc/${id}/approve`,
      {},
    );
  }

  async adminRejectKyc(id: string, reason: string): Promise<VerificationRequest> {
    return this.request<VerificationRequest>('POST', `/api/v1/admin/compliance/kyc/${id}/reject`, {
      reason,
    });
  }

  async adminListComplianceAlerts(): Promise<{ items: AmlAlert[]; total: number }> {
    return this.request<{ items: AmlAlert[]; total: number }>(
      'GET',
      '/api/v1/admin/compliance/alerts',
    );
  }

  async adminListComplianceCases(): Promise<{ items: ComplianceCase[]; total: number }> {
    return this.request<{ items: ComplianceCase[]; total: number }>(
      'GET',
      '/api/v1/admin/compliance/cases',
    );
  }

  async adminListComplianceRules(): Promise<ComplianceRule[]> {
    return this.request<ComplianceRule[]>('GET', '/api/v1/admin/compliance/rules');
  }

  async adminGetComplianceRule(id: string): Promise<ComplianceRule> {
    return this.request<ComplianceRule>('GET', `/api/v1/admin/compliance/rules/${id}`);
  }

  async adminCreateComplianceRule(input: CreateComplianceRuleInput): Promise<ComplianceRule> {
    return this.request<ComplianceRule>('POST', '/api/v1/admin/compliance/rules', input);
  }

  async adminUpdateComplianceRule(
    id: string,
    input: UpdateComplianceRuleInput,
  ): Promise<ComplianceRule> {
    return this.request<ComplianceRule>('PATCH', `/api/v1/admin/compliance/rules/${id}`, input);
  }

  async adminEnableComplianceRule(id: string): Promise<ComplianceRule> {
    return this.request<ComplianceRule>('POST', `/api/v1/admin/compliance/rules/${id}/enable`, {});
  }

  async adminDisableComplianceRule(id: string): Promise<ComplianceRule> {
    return this.request<ComplianceRule>('POST', `/api/v1/admin/compliance/rules/${id}/disable`, {});
  }

  async adminRecomputeComplianceRisk(
    ownerUserId: string,
    input: RecomputeComplianceRiskInput,
  ): Promise<ComplianceRiskRecord> {
    return this.request<ComplianceRiskRecord>(
      'POST',
      `/api/v1/admin/compliance/risk/${ownerUserId}/recompute`,
      input,
    );
  }

  async adminListComplianceProviders(): Promise<ComplianceProvider[]> {
    return this.request<ComplianceProvider[]>('GET', '/api/v1/admin/compliance/providers');
  }

  async getCustodyStatus(): Promise<CustodyStatusSummary> {
    return this.request<CustodyStatusSummary>('GET', '/api/v1/custody/status');
  }

  async listCustodyKeys(): Promise<{ items: CustodyKey[]; total: number }> {
    return this.request<{ items: CustodyKey[]; total: number }>('GET', '/api/v1/custody/keys');
  }

  async generateCustodyKey(input: GenerateCustodyKeyInput): Promise<CustodyKey> {
    return this.request<CustodyKey>('POST', '/api/v1/custody/keys', input);
  }

  async getCustodyKey(id: string): Promise<CustodyKey> {
    return this.request<CustodyKey>('GET', `/api/v1/custody/keys/${id}`);
  }

  async rotateCustodyKey(id: string): Promise<CustodyKey> {
    return this.request<CustodyKey>('POST', `/api/v1/custody/keys/${id}/rotate`, {});
  }

  async listSigningRequests(): Promise<{ items: SigningRequest[]; total: number }> {
    return this.request<{ items: SigningRequest[]; total: number }>(
      'GET',
      '/api/v1/custody/signing-requests',
    );
  }

  async createSigningRequest(input: CreateSigningRequestInput): Promise<SigningRequest> {
    return this.request<SigningRequest>('POST', '/api/v1/custody/signing-requests', input);
  }

  async approveSigningRequest(id: string, note?: string): Promise<SigningRequest> {
    return this.request<SigningRequest>('POST', `/api/v1/custody/signing-requests/${id}/approve`, {
      note,
    });
  }

  async rejectSigningRequest(id: string, note?: string): Promise<SigningRequest> {
    return this.request<SigningRequest>('POST', `/api/v1/custody/signing-requests/${id}/reject`, {
      note,
    });
  }

  async listRecoveryContacts(): Promise<RecoveryContact[]> {
    return this.request<RecoveryContact[]>('GET', '/api/v1/custody/recovery/contacts');
  }

  async addRecoveryContact(input: AddRecoveryContactInput): Promise<RecoveryContact> {
    return this.request<RecoveryContact>('POST', '/api/v1/custody/recovery/contacts', input);
  }

  async listCustodyActivity(): Promise<CustodyActivityItem[]> {
    return this.request<CustodyActivityItem[]>('GET', '/api/v1/custody/security/activity');
  }

  async adminCustodyDashboard(): Promise<CustodyDashboardMetrics> {
    return this.request<CustodyDashboardMetrics>('GET', '/api/v1/admin/custody/dashboard');
  }

  async adminListCustodyKeys(): Promise<{ items: CustodyKey[]; total: number }> {
    return this.request<{ items: CustodyKey[]; total: number }>(
      'GET',
      '/api/v1/admin/custody/keys',
    );
  }

  async adminCustodySigningQueue(): Promise<{ items: SigningRequest[]; total: number }> {
    return this.request<{ items: SigningRequest[]; total: number }>(
      'GET',
      '/api/v1/admin/custody/signing/queue',
    );
  }

  async adminCustodyApprovalQueue(): Promise<{ items: ApprovalQueueItem[]; total: number }> {
    return this.request<{ items: ApprovalQueueItem[]; total: number }>(
      'GET',
      '/api/v1/admin/custody/approvals/queue',
    );
  }

  async adminListCustodyProviders(): Promise<CustodyProvider[]> {
    return this.request<CustodyProvider[]>('GET', '/api/v1/admin/custody/providers');
  }

  async adminListApprovalPolicies(): Promise<CustodyApprovalPolicy[]> {
    return this.request<CustodyApprovalPolicy[]>('GET', '/api/v1/admin/custody/policies/approval');
  }

  async adminListSignerGroups(): Promise<SignerGroup[]> {
    return this.request<SignerGroup[]>('GET', '/api/v1/admin/custody/signer-groups');
  }

  async adminListCustodyAudit(): Promise<{ items: CustodyAuditItem[]; total: number }> {
    return this.request<{ items: CustodyAuditItem[]; total: number }>(
      'GET',
      '/api/v1/admin/custody/audit',
    );
  }

  async listNotifications(): Promise<{ items: NotificationItem[]; total: number }> {
    return this.request<{ items: NotificationItem[]; total: number }>(
      'GET',
      '/api/v1/notifications',
    );
  }

  async markNotificationRead(id: string): Promise<NotificationItem> {
    return this.request<NotificationItem>('POST', `/api/v1/notifications/${id}/read`, {});
  }

  async getNotificationPreferences(): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('GET', '/api/v1/notifications/preferences');
  }

  async updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
  ): Promise<NotificationPreferences> {
    return this.request<NotificationPreferences>('PUT', '/api/v1/notifications/preferences', input);
  }

  async listWebhookEndpoints(): Promise<WebhookEndpoint[]> {
    return this.request<WebhookEndpoint[]>('GET', '/api/v1/notifications/webhooks');
  }

  async createWebhookEndpoint(input: CreateWebhookEndpointInput): Promise<WebhookEndpoint> {
    return this.request<WebhookEndpoint>('POST', '/api/v1/notifications/webhooks', input);
  }

  async adminNotificationDashboard(): Promise<NotificationDashboardMetrics> {
    return this.request<NotificationDashboardMetrics>(
      'GET',
      '/api/v1/admin/notifications/dashboard',
    );
  }

  async adminListNotificationProviders(): Promise<NotificationProvider[]> {
    return this.request<NotificationProvider[]>('GET', '/api/v1/admin/notifications/providers');
  }

  async adminListNotificationTemplates(): Promise<NotificationTemplate[]> {
    const result = await this.request<{ items: NotificationTemplate[]; total: number }>(
      'GET',
      '/api/v1/admin/notifications/templates',
    );
    return result.items;
  }

  async adminNotificationQueue(): Promise<{ items: NotificationQueueItem[]; total: number }> {
    return this.request<{ items: NotificationQueueItem[]; total: number }>(
      'GET',
      '/api/v1/admin/notifications/queue',
    );
  }

  async adminFailedNotifications(): Promise<{ items: NotificationItem[]; total: number }> {
    return this.request<{ items: NotificationItem[]; total: number }>(
      'GET',
      '/api/v1/admin/notifications/failed',
    );
  }

  async adminBroadcastNotification(
    input: BroadcastNotificationInput,
  ): Promise<BroadcastNotificationResult> {
    return this.request<BroadcastNotificationResult>(
      'POST',
      '/api/v1/admin/notifications/broadcast',
      {
        ...input,
        all: input.all ?? true,
      },
    );
  }

  async adminListWebhookEndpoints(): Promise<WebhookEndpoint[]> {
    return this.request<WebhookEndpoint[]>('GET', '/api/v1/admin/notifications/webhooks');
  }

  async chatAi(input: AiChatInput): Promise<AiChatResult> {
    return this.request<AiChatResult>('POST', '/api/v1/ai/chat', input);
  }

  async listAiConversations(): Promise<{ items: AiConversation[]; total: number }> {
    return this.request<{ items: AiConversation[]; total: number }>(
      'GET',
      '/api/v1/ai/conversations',
    );
  }

  async getAiConversation(id: string): Promise<AiConversationDetail> {
    return this.request<AiConversationDetail>('GET', `/api/v1/ai/conversations/${id}`);
  }

  async searchAiKnowledge(
    query: string,
  ): Promise<{ items: AiKnowledgeSearchResult[]; total: number }> {
    return this.request<{ items: AiKnowledgeSearchResult[]; total: number }>(
      'POST',
      '/api/v1/ai/knowledge/search',
      { query },
    );
  }

  async listAiAssistants(): Promise<AiAssistant[]> {
    return this.request<AiAssistant[]>('GET', '/api/v1/ai/assistants');
  }

  async submitAiMessageFeedback(
    messageId: string,
    input: SubmitAiMessageFeedbackInput,
  ): Promise<void> {
    await this.request<void>('POST', `/api/v1/ai/messages/${messageId}/feedback`, input);
  }

  async adminAiDashboard(): Promise<AiDashboardMetrics> {
    return this.request<AiDashboardMetrics>('GET', '/api/v1/admin/ai/dashboard');
  }

  async adminListAiProviders(): Promise<AiProvider[]> {
    return this.request<AiProvider[]>('GET', '/api/v1/admin/ai/providers');
  }

  async adminEnableAiProvider(id: string): Promise<AiProvider> {
    return this.request<AiProvider>('POST', `/api/v1/admin/ai/providers/${id}/enable`, {});
  }

  async adminDisableAiProvider(id: string): Promise<AiProvider> {
    return this.request<AiProvider>('POST', `/api/v1/admin/ai/providers/${id}/disable`, {});
  }

  /** Upserts a provider config row (config-only for an existing providerType; a new providerType still needs a backend adapter + deploy). */
  async adminUpsertAiProvider(input: UpsertAiProviderInput): Promise<AiProvider> {
    return this.request<AiProvider>('POST', '/api/v1/admin/ai/providers', input);
  }

  async adminUpdateAiProvider(code: string, input: UpdateAiProviderInput): Promise<AiProvider> {
    return this.request<AiProvider>('PATCH', `/api/v1/admin/ai/providers/${code}`, input);
  }

  async adminSetAiProviderPriority(code: string, priority: number): Promise<AiProvider> {
    return this.request<AiProvider>('PATCH', `/api/v1/admin/ai/providers/${code}`, { priority });
  }

  async adminListAiPrompts(): Promise<AiPrompt[]> {
    return this.request<AiPrompt[]>('GET', '/api/v1/admin/ai/prompts');
  }

  async adminSubmitAiPrompt(id: string): Promise<AiPrompt> {
    return this.request<AiPrompt>('POST', `/api/v1/admin/ai/prompts/${id}/submit`, {});
  }

  async adminApproveAiPrompt(id: string): Promise<AiPrompt> {
    return this.request<AiPrompt>('POST', `/api/v1/admin/ai/prompts/${id}/approve`, {});
  }

  async adminRejectAiPrompt(id: string): Promise<AiPrompt> {
    return this.request<AiPrompt>('POST', `/api/v1/admin/ai/prompts/${id}/reject`, {});
  }

  async adminAiUsage(): Promise<AiUsageMetrics> {
    return this.request<AiUsageMetrics>('GET', '/api/v1/admin/ai/usage');
  }

  async adminListAiKnowledgeSources(): Promise<AiKnowledgeSource[]> {
    return this.request<AiKnowledgeSource[]>('GET', '/api/v1/admin/ai/knowledge/sources');
  }

  async adminListAiConversations(): Promise<{ items: AiConversation[]; total: number }> {
    return this.request<{ items: AiConversation[]; total: number }>(
      'GET',
      '/api/v1/admin/ai/conversations',
    );
  }

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    return this.request<AnalyticsSummary>('GET', '/api/v1/analytics/summary');
  }

  async listAnalyticsDashboards(): Promise<AnalyticsDashboard[]> {
    return this.request<AnalyticsDashboard[]>('GET', '/api/v1/analytics/dashboards');
  }

  async getAnalyticsDashboard(id: string): Promise<AnalyticsDashboardDetail> {
    return this.request<AnalyticsDashboardDetail>('GET', `/api/v1/analytics/dashboards/${id}`);
  }

  async listAnalyticsReports(): Promise<{ items: AnalyticsReport[]; total: number }> {
    return this.request<{ items: AnalyticsReport[]; total: number }>(
      'GET',
      '/api/v1/analytics/reports',
    );
  }

  async generateAnalyticsReport(input: GenerateAnalyticsReportInput): Promise<AnalyticsReport> {
    return this.request<AnalyticsReport>('POST', '/api/v1/analytics/reports', input);
  }

  async getAnalyticsReport(id: string): Promise<AnalyticsReport> {
    return this.request<AnalyticsReport>('GET', `/api/v1/analytics/reports/${id}`);
  }

  async listAnalyticsKpis(): Promise<AnalyticsKpi[]> {
    return this.request<AnalyticsKpi[]>('GET', '/api/v1/analytics/kpis');
  }

  async adminAnalyticsInsights(): Promise<AnalyticsInsightsSummary> {
    return this.request<AnalyticsInsightsSummary>('GET', '/api/v1/analytics/insights');
  }

  async adminListAnalyticsMetrics(): Promise<AnalyticsMetricDefinition[]> {
    return this.request<AnalyticsMetricDefinition[]>('GET', '/api/v1/admin/analytics/metrics');
  }

  async adminGetAnalyticsMetric(code: string): Promise<AnalyticsMetricDetail> {
    const metrics = await this.adminListAnalyticsMetrics();
    const match = metrics.find((m) => (m as { code?: string }).code === code);
    if (!match) {
      throw new AuvoraClientError(`Analytics metric not found: ${code}`, 404, null);
    }
    return match as unknown as AnalyticsMetricDetail;
  }

  async adminListAnalyticsForecasts(): Promise<AnalyticsForecast[]> {
    return this.request<AnalyticsForecast[]>('GET', '/api/v1/admin/analytics/forecasts');
  }

  async adminGetAnalyticsForecast(code: string): Promise<AnalyticsForecast> {
    const forecasts = await this.adminListAnalyticsForecasts();
    const match = forecasts.find((f) => (f as { code?: string }).code === code);
    if (!match) {
      throw new AuvoraClientError(`Analytics forecast not found: ${code}`, 404, null);
    }
    return match;
  }

  async adminListAnalyticsAggregationJobs(): Promise<{
    items: AnalyticsAggregationJob[];
    total: number;
  }> {
    // Nest exposes trigger-only aggregate/run; no job list endpoint yet.
    return { items: [], total: 0 };
  }

  async adminRunAnalyticsAggregation(
    input: RunAnalyticsAggregationInput = {},
  ): Promise<AnalyticsAggregationJob> {
    return this.request<AnalyticsAggregationJob>(
      'POST',
      '/api/v1/admin/analytics/aggregate/run',
      input,
    );
  }

  async adminListAnalyticsDashboards(): Promise<AnalyticsDashboard[]> {
    return this.request<AnalyticsDashboard[]>('GET', '/api/v1/admin/analytics/dashboards');
  }

  async adminListAnalyticsKpis(): Promise<AnalyticsKpi[]> {
    return this.request<AnalyticsKpi[]>('GET', '/api/v1/admin/analytics/kpis');
  }

  async adminListAnalyticsReports(): Promise<{ items: AnalyticsReport[]; total: number }> {
    return this.request<{ items: AnalyticsReport[]; total: number }>(
      'GET',
      '/api/v1/admin/analytics/reports',
    );
  }

  async getPlatformStatus(): Promise<PlatformStatus> {
    return this.request<PlatformStatus>('GET', '/api/v1/observability/status');
  }

  async listMaintenanceNotices(): Promise<MaintenanceNotice[]> {
    return this.request<MaintenanceNotice[]>('GET', '/api/v1/observability/maintenance');
  }

  async listPublicIncidents(): Promise<{ items: PublicIncident[]; total: number }> {
    return this.request<{ items: PublicIncident[]; total: number }>(
      'GET',
      '/api/v1/observability/incidents',
    );
  }

  async adminObservabilityDashboard(): Promise<OpsDashboardOverview> {
    return this.request<OpsDashboardOverview>('GET', '/api/v1/admin/observability/dashboard');
  }

  async adminListObservabilityAlerts(): Promise<{ items: OpsAlert[]; total: number }> {
    return this.request<{ items: OpsAlert[]; total: number }>(
      'GET',
      '/api/v1/admin/observability/alerts',
    );
  }

  async adminAcknowledgeAlert(id: string): Promise<OpsAlert> {
    return this.request<OpsAlert>('POST', `/api/v1/admin/observability/alerts/${id}/acknowledge`);
  }

  async adminResolveAlert(id: string): Promise<OpsAlert> {
    return this.request<OpsAlert>('POST', `/api/v1/admin/observability/alerts/${id}/resolve`);
  }

  async adminListObservabilityIncidents(): Promise<{ items: OpsIncident[]; total: number }> {
    return this.request<{ items: OpsIncident[]; total: number }>(
      'GET',
      '/api/v1/admin/observability/incidents',
    );
  }

  async adminAcknowledgeIncident(id: string): Promise<OpsIncident> {
    return this.request<OpsIncident>(
      'POST',
      `/api/v1/admin/observability/incidents/${id}/acknowledge`,
    );
  }

  async adminResolveIncident(
    id: string,
    body?: { rootCause?: string; postmortem?: string },
  ): Promise<OpsIncident> {
    return this.request<OpsIncident>(
      'POST',
      `/api/v1/admin/observability/incidents/${id}/resolve`,
      body ?? {},
    );
  }

  async adminListObservabilitySlos(): Promise<OpsSlo[]> {
    return this.request<OpsSlo[]>('GET', '/api/v1/admin/observability/slos');
  }

  async adminObservabilityCapacity(): Promise<OpsCapacityOverview> {
    return this.request<OpsCapacityOverview>('GET', '/api/v1/admin/observability/capacity');
  }

  async adminObservabilityHealth(): Promise<OpsHealthOverview> {
    return this.request<OpsHealthOverview>('GET', '/api/v1/admin/observability/health');
  }

  async adminObservabilityDependencies(): Promise<OpsDependencyGraph> {
    return this.request<OpsDependencyGraph>('GET', '/api/v1/admin/observability/dependencies');
  }

  async adminSearchObservabilityTraces(params?: {
    serviceName?: string;
    correlationId?: string;
  }): Promise<{ items: OpsTrace[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.serviceName) query.set('serviceName', params.serviceName);
    if (params?.correlationId) query.set('correlationId', params.correlationId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ items: OpsTrace[]; total: number }>(
      'GET',
      `/api/v1/admin/observability/traces${suffix}`,
    );
  }

  async adminSearchObservabilityLogs(params?: {
    serviceName?: string;
    level?: string;
    correlationId?: string;
  }): Promise<{ items: OpsLogEntry[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.serviceName) query.set('serviceName', params.serviceName);
    if (params?.level) query.set('level', params.level);
    if (params?.correlationId) query.set('correlationId', params.correlationId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ items: OpsLogEntry[]; total: number }>(
      'GET',
      `/api/v1/admin/observability/logs${suffix}`,
    );
  }

  async adminInfrastructureDashboard(): Promise<InfraDashboardOverview> {
    return this.request<InfraDashboardOverview>('GET', '/api/v1/admin/infrastructure/dashboard');
  }

  async adminInfrastructureClusterHealth(): Promise<{
    generatedAt: string;
    status: string;
    activeEnvironmentCount: number;
    recentFailedDeployments: number;
    recentVerifiedBackups: number;
    activeRecoveryDrills: number;
    environments: Array<{ code: string; name: string; isActive: boolean }>;
    notes: string;
  }> {
    return this.request('GET', '/api/v1/admin/infrastructure/cluster-health');
  }

  async adminListInfraEnvironments(): Promise<InfraEnvironment[]> {
    return this.request<InfraEnvironment[]>('GET', '/api/v1/admin/infrastructure/environments');
  }

  async adminListInfraDeployments(environmentCode?: string): Promise<{
    items: InfraDeployment[];
    total: number;
  }> {
    const suffix = environmentCode ? `?${new URLSearchParams({ environmentCode }).toString()}` : '';
    return this.request<{ items: InfraDeployment[]; total: number }>(
      'GET',
      `/api/v1/admin/infrastructure/deployments${suffix}`,
    );
  }

  async adminListInfraBackups(environmentCode?: string): Promise<{
    items: InfraBackupJob[];
    total: number;
  }> {
    const suffix = environmentCode ? `?${new URLSearchParams({ environmentCode }).toString()}` : '';
    return this.request<{ items: InfraBackupJob[]; total: number }>(
      'GET',
      `/api/v1/admin/infrastructure/backups${suffix}`,
    );
  }

  async adminListInfraRecovery(environmentCode?: string): Promise<{
    items: InfraRecoveryDrill[];
    total: number;
  }> {
    const suffix = environmentCode ? `?${new URLSearchParams({ environmentCode }).toString()}` : '';
    return this.request<{ items: InfraRecoveryDrill[]; total: number }>(
      'GET',
      `/api/v1/admin/infrastructure/recovery${suffix}`,
    );
  }

  async adminListFeatureFlags(environmentCode?: string): Promise<FeatureFlag[]> {
    const suffix = environmentCode ? `?${new URLSearchParams({ environmentCode }).toString()}` : '';
    return this.request<FeatureFlag[]>(
      'GET',
      `/api/v1/admin/infrastructure/feature-flags${suffix}`,
    );
  }

  async adminUpdateFeatureFlag(code: string, input: UpdateFeatureFlagInput): Promise<FeatureFlag> {
    return this.request<FeatureFlag>(
      'PATCH',
      `/api/v1/admin/infrastructure/feature-flags/${encodeURIComponent(code)}`,
      input,
    );
  }

  async adminSearchUsers(query: AdminSearchUsersQuery = {}): Promise<AdminUserSearchResult> {
    const params = new URLSearchParams();
    if (query.query) params.set('query', query.query);
    if (query.status) params.set('status', query.status);
    if (query.skip != null) params.set('skip', String(query.skip));
    if (query.take != null) params.set('take', String(query.take));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<AdminUserSearchResult>('GET', `/api/v1/admin/users${suffix}`);
  }

  async adminGetUser(userId: string): Promise<UserProfile> {
    return this.request<UserProfile>('GET', `/api/v1/admin/users/${encodeURIComponent(userId)}`);
  }

  async adminUpdateUserStatus(userId: string, status: string): Promise<UserProfile> {
    return this.request<UserProfile>(
      'PATCH',
      `/api/v1/admin/users/${encodeURIComponent(userId)}/status`,
      { status },
    );
  }

  async adminAssignUserRoles(userId: string, roles: string[]): Promise<UserProfile> {
    return this.request<UserProfile>(
      'PATCH',
      `/api/v1/admin/users/${encodeURIComponent(userId)}/roles`,
      { roles },
    );
  }

  async adminForceLogoutUser(userId: string): Promise<{ revoked: number }> {
    return this.request<{ revoked: number }>(
      'POST',
      `/api/v1/admin/users/${encodeURIComponent(userId)}/force-logout`,
    );
  }

  async adminToggleUserMfa(userId: string, enabled: boolean): Promise<UserProfile> {
    return this.request<UserProfile>(
      'PATCH',
      `/api/v1/admin/users/${encodeURIComponent(userId)}/mfa`,
      { enabled },
    );
  }

  async adminListAudit(query: AdminAuditQuery = {}): Promise<AdminAuditListResult> {
    const params = new URLSearchParams();
    if (query.action) params.set('action', query.action);
    if (query.actorUserId) params.set('actorUserId', query.actorUserId);
    if (query.targetUserId) params.set('targetUserId', query.targetUserId);
    if (query.skip != null) params.set('skip', String(query.skip));
    if (query.take != null) params.set('take', String(query.take));
    const suffix = params.toString() ? `?${params.toString()}` : '';
    return this.request<AdminAuditListResult>('GET', `/api/v1/admin/audit${suffix}`);
  }

  async adminListMaintenance(): Promise<AdminMaintenanceNotice[]> {
    return this.request<AdminMaintenanceNotice[]>('GET', '/api/v1/admin/observability/maintenance');
  }

  async adminCreateMaintenance(input: CreateMaintenanceInput): Promise<AdminMaintenanceNotice> {
    return this.request<AdminMaintenanceNotice>(
      'POST',
      '/api/v1/admin/observability/maintenance',
      input,
    );
  }

  async adminSetMaintenanceActive(id: string, isActive: boolean): Promise<AdminMaintenanceNotice> {
    return this.request<AdminMaintenanceNotice>(
      'PATCH',
      `/api/v1/admin/observability/maintenance/${id}`,
      { isActive },
    );
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...this.defaultHeaders,
    };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: this.credentials,
      signal: this.requestSignal(),
    });

    const payload = (await response.json().catch(() => undefined)) as ApiResponse<T> | undefined;

    if (!response.ok || !payload?.success) {
      throw new AuvoraClientError(
        payload?.error?.message ?? `Request failed with status ${response.status}`,
        response.status,
        payload,
      );
    }

    return payload.data as T;
  }

  private parseHealth(body: unknown): HealthCheckResponse {
    if (!body || typeof body !== 'object') {
      throw new AuvoraClientError('Invalid health response payload', 500, body);
    }

    const record = body as Record<string, unknown>;
    const status = record['status'];
    const service = record['service'];
    const version = record['version'];
    const timestamp = record['timestamp'];
    const uptimeSeconds = record['uptimeSeconds'];

    if (
      typeof status !== 'string' ||
      !Object.values(HealthStatus).includes(status as HealthStatus) ||
      typeof service !== 'string' ||
      typeof version !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof uptimeSeconds !== 'number'
    ) {
      throw new AuvoraClientError('Health response failed validation', 500, body);
    }

    return {
      status: status as HealthStatus,
      service,
      version,
      timestamp,
      uptimeSeconds,
    };
  }
}
