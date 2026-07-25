export interface RefreshTokenRecord {
  id: string;
  userId: string;
  sessionId: string;
  deviceId: string | null;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
  createdAt: Date;
}

export interface CreateRefreshTokenInput {
  userId: string;
  sessionId: string;
  deviceId: string | null;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');

export interface RefreshTokenRepositoryPort {
  create(input: CreateRefreshTokenInput): Promise<RefreshTokenRecord>;
  findByHash(tokenHash: string): Promise<RefreshTokenRecord | null>;
  revoke(tokenId: string, replacedById?: string): Promise<void>;
  revokeFamily(familyId: string): Promise<number>;
  revokeAllForUser(userId: string): Promise<number>;
  revokeAllForSession(sessionId: string): Promise<number>;
}
