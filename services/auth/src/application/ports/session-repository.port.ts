export interface SessionRecord {
  id: string;
  userId: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateSessionInput {
  userId: string;
  deviceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  expiresAt: Date;
}

export const SESSION_REPOSITORY = Symbol('SESSION_REPOSITORY');

export interface SessionRepositoryPort {
  create(input: CreateSessionInput): Promise<SessionRecord>;
  findById(id: string): Promise<SessionRecord | null>;
  listByUserId(userId: string): Promise<SessionRecord[]>;
  revoke(sessionId: string): Promise<void>;
  revokeAllForUser(userId: string): Promise<number>;
  extend(sessionId: string, expiresAt: Date): Promise<void>;
}
