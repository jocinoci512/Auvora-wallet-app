import type { AdminOperator } from './admin-session';
import { adminRequest } from './admin-session';

export interface AdminUserAccount {
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
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  platforms?: string[];
  deviceCount?: number;
  activeSessionCount?: number;
}

export interface AdminUserDevice {
  id: string;
  fingerprint: string;
  name: string | null;
  platform: string | null;
  appVersion: string | null;
  userAgent: string | null;
  trusted: boolean;
  lastSeenAt: string;
  revokedAt: string | null;
  createdAt: string;
}

export interface AdminUserSession {
  id: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
  active: boolean;
}

export interface OperatorListResult {
  total: number;
  operators: AdminOperator[];
}

export async function adminListUserDevices(userId: string): Promise<AdminUserDevice[]> {
  return adminRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/devices`);
}

export async function adminListUserSessions(userId: string): Promise<AdminUserSession[]> {
  return adminRequest(`/api/v1/admin/users/${encodeURIComponent(userId)}/sessions`);
}

export async function adminListOperators(
  query: {
    query?: string;
    skip?: number;
    take?: number;
  } = {},
): Promise<OperatorListResult> {
  const params = new URLSearchParams();
  if (query.query) params.set('query', query.query);
  if (query.skip != null) params.set('skip', String(query.skip));
  if (query.take != null) params.set('take', String(query.take));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return adminRequest(`/api/v1/admin/operators${suffix}`);
}

export async function adminAssignOperatorRoles(
  userId: string,
  roles: string[],
  reason: string,
): Promise<AdminOperator> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/roles`, {
    method: 'PATCH',
    body: JSON.stringify({ roles, reason }),
  });
}

export async function adminUpdateOperatorStatus(
  userId: string,
  status: string,
  reason: string,
): Promise<AdminOperator> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
}

export async function adminRevokeOperatorSessions(
  userId: string,
  reason: string,
): Promise<{ revoked: number }> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/revoke-sessions`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminResetOperatorMfa(
  userId: string,
  reason: string,
): Promise<AdminOperator> {
  return adminRequest(`/api/v1/admin/operators/${encodeURIComponent(userId)}/mfa/reset`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export interface SafeConnectionRow {
  id: string;
  userId: string;
  kind: string;
  status: string;
  providerCode: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
  connectedAt: string | null;
}

const SECRET_KEYS = /secret|seed|mnemonic|private|symkey|sessionkey|ciphertext|token|password|otp/i;

export function toSafeConnection(row: Record<string, unknown>): SafeConnectionRow {
  return {
    id: String(row.id ?? ''),
    userId: String(row.userId ?? ''),
    kind: String(row.kind ?? 'unknown'),
    status: String(row.status ?? 'unknown'),
    providerCode: String(row.providerCode ?? 'unknown'),
    label: typeof row.label === 'string' ? row.label : null,
    createdAt: String(row.createdAt ?? ''),
    updatedAt: String(row.updatedAt ?? ''),
    connectedAt: typeof row.connectedAt === 'string' ? row.connectedAt : null,
  };
}

export function isUnsafeField(key: string): boolean {
  return SECRET_KEYS.test(key);
}

export interface SimulationBalanceRow {
  id: string;
  assetCode: string;
  assetSymbol: string;
  assetName: string;
  chain: string;
  quantity: string;
  valueUsd: string | null;
  priceUsd: string | null;
  priceSource: string | null;
  priceTimestamp: string | null;
  label: string;
  updatedAt: string;
}

export interface SimulationEventRow {
  id: string;
  assetCode: string | null;
  eventType: string;
  previousQuantity: string | null;
  newQuantity: string | null;
  deltaQuantity: string | null;
  valuationUsd: string | null;
  reason: string;
  adminUserId: string | null;
  createdAt: string;
}

export interface SimulationTransactionRow {
  id: string;
  reference: string;
  status: string;
  direction: string;
  assetCode: string;
  amount: string;
  feeAmount: string;
  destinationAddress: string | null;
  note: string | null;
  reviewId: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface SimulationAccountView {
  id: string;
  ownerUserId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  balances: SimulationBalanceRow[];
  events: SimulationEventRow[];
  transactions: SimulationTransactionRow[];
}

export interface LargeTransferReviewRow {
  id: string;
  ownerUserId: string;
  walletId: string | null;
  sourceType: string;
  sourceId: string | null;
  assetCode: string;
  assetSymbol: string;
  network: string;
  fromAddress: string | null;
  destinationAddress: string;
  amount: string;
  amountUsdCents: string;
  priceUsdCentsPerWhole: string | null;
  priceTimestamp: string | null;
  status: string;
  requestedAt: string;
  decisionAt: string | null;
  decisionReason: string | null;
  rejectionReason: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function adminGetSimulationAccount(
  userId: string,
): Promise<SimulationAccountView | null> {
  return adminRequest(`/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}`);
}

export async function adminListSimulationAccounts(query?: string): Promise<
  Array<{
    id: string;
    ownerUserId: string;
    status: string;
    assetCount: number;
    updatedAt: string;
    createdAt: string;
  }>
> {
  const suffix = query ? `?${new URLSearchParams({ query }).toString()}` : '';
  return adminRequest(`/api/v1/admin/simulation/accounts${suffix}`);
}

export async function adminEnableTestAccount(
  userId: string,
  reason: string,
): Promise<SimulationAccountView | null> {
  return adminRequest(`/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/enable`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminDisableTestAccount(
  userId: string,
  reason: string,
): Promise<SimulationAccountView | null> {
  return adminRequest(`/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/disable`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminUpsertSimulationBalance(input: {
  userId: string;
  assetCode: string;
  operation: 'set' | 'increase' | 'decrease';
  amount: string;
  reason: string;
}): Promise<SimulationAccountView | null> {
  return adminRequest(
    `/api/v1/admin/simulation/accounts/${encodeURIComponent(input.userId)}/balances`,
    {
      method: 'POST',
      body: JSON.stringify({
        assetCode: input.assetCode,
        operation: input.operation,
        amount: input.amount,
        reason: input.reason,
      }),
    },
  );
}

export async function adminRemoveSimulationBalance(
  userId: string,
  assetCode: string,
  reason: string,
): Promise<SimulationAccountView | null> {
  return adminRequest(
    `/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/balances/${encodeURIComponent(assetCode)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
    },
  );
}

export async function adminResetSimulationPortfolio(
  userId: string,
  reason: string,
): Promise<SimulationAccountView | null> {
  return adminRequest(`/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/reset`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminApplySimulationPreset(
  userId: string,
  presetCode: string,
  reason: string,
): Promise<SimulationAccountView | null> {
  return adminRequest(
    `/api/v1/admin/simulation/accounts/${encodeURIComponent(userId)}/presets/${encodeURIComponent(presetCode)}`,
    {
      method: 'POST',
      body: JSON.stringify({ reason }),
    },
  );
}

export async function adminCreateSimulationTransaction(input: {
  userId: string;
  assetCode: string;
  scenario: string;
  amount: string;
  destinationAddress?: string;
  note?: string;
  reason: string;
}) {
  return adminRequest(
    `/api/v1/admin/simulation/accounts/${encodeURIComponent(input.userId)}/transactions`,
    {
      method: 'POST',
      body: JSON.stringify({
        assetCode: input.assetCode,
        scenario: input.scenario,
        amount: input.amount,
        destinationAddress: input.destinationAddress,
        note: input.note,
        reason: input.reason,
      }),
    },
  );
}

export async function adminListLargeTransferReviews(
  query: {
    status?: string;
    ownerUserId?: string;
    skip?: number;
    take?: number;
  } = {},
): Promise<{ total: number; counts: Record<string, number>; items: LargeTransferReviewRow[] }> {
  const params = new URLSearchParams();
  if (query.status) params.set('status', query.status);
  if (query.ownerUserId) params.set('ownerUserId', query.ownerUserId);
  if (query.skip != null) params.set('skip', String(query.skip));
  if (query.take != null) params.set('take', String(query.take));
  const suffix = params.toString() ? `?${params.toString()}` : '';
  return adminRequest(`/api/v1/admin/transaction-reviews${suffix}`);
}

export async function adminReviewSummary(): Promise<{
  pending: number;
  approved: number;
  rejected: number;
}> {
  return adminRequest('/api/v1/admin/transaction-reviews/summary');
}

export async function adminGetLargeTransferReview(
  reviewId: string,
): Promise<LargeTransferReviewRow> {
  return adminRequest(`/api/v1/admin/transaction-reviews/${encodeURIComponent(reviewId)}`);
}

export async function adminApproveLargeTransferReview(reviewId: string, reason: string) {
  return adminRequest(`/api/v1/admin/transaction-reviews/${encodeURIComponent(reviewId)}/approve`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function adminRejectLargeTransferReview(reviewId: string, reason: string) {
  return adminRequest(`/api/v1/admin/transaction-reviews/${encodeURIComponent(reviewId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}
