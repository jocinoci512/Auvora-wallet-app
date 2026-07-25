export interface LoginHistoryRecord {
  id: string;
  userId: string | null;
  email: string | null;
  outcome: 'SUCCESS' | 'FAILURE';
  ipAddress: string | null;
  userAgent: string | null;
  reason: string | null;
  createdAt: Date;
}

export interface RecordLoginInput {
  userId?: string;
  email?: string;
  outcome: 'SUCCESS' | 'FAILURE';
  ipAddress?: string;
  userAgent?: string;
  reason?: string;
}

export const LOGIN_HISTORY_REPOSITORY = Symbol('LOGIN_HISTORY_REPOSITORY');

export interface LoginHistoryRepositoryPort {
  record(input: RecordLoginInput): Promise<void>;
  listByUserId(userId: string, skip?: number, take?: number): Promise<LoginHistoryRecord[]>;
}
