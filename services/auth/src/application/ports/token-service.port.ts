import type { JwtAccessClaims } from '@auvora/types';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  sessionId: string;
  roles: string[];
  permissions: string[];
  surface?: 'consumer' | 'admin';
  stepUpExp?: number;
}

export const TOKEN_SERVICE = Symbol('TOKEN_SERVICE');

export interface TokenServicePort {
  issueAccessToken(payload: AccessTokenPayload): Promise<string>;
  verifyAccessToken(token: string): Promise<JwtAccessClaims>;
  generateRefreshToken(): string;
  hashRefreshToken(token: string): string;
}
