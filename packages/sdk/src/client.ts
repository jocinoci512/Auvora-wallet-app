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
  private accessToken: string | null = null;

  constructor(options: AuvoraClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultHeaders = options.defaultHeaders ?? {};
    this.credentials = options.credentials ?? 'include';
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

  async getWalletTransactions(
    walletId: string,
    skip = 0,
    take = 50,
  ): Promise<WalletTransaction[]> {
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

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
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
