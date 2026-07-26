import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashToken, generateOpaqueToken } from '@auvora/security';
import type { JwtAccessClaims } from '@auvora/types';
import { UnauthorizedError } from '../../domain';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import type { AccessTokenPayload, TokenServicePort } from '../../application/ports/token-service.port';

@Injectable()
export class JwtTokenAdapter implements TokenServicePort {
  constructor(
    @Inject(JwtService) private readonly jwtService: JwtService,
    @Inject(ENV) private readonly env: ServiceEnv,
  ) {}

  async issueAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.env.JWT_ACCESS_SECRET,
      expiresIn: this.env.JWT_ACCESS_TTL_SECONDS,
    });
  }

  async verifyAccessToken(token: string): Promise<JwtAccessClaims> {
    try {
      const claims = await this.jwtService.verifyAsync<JwtAccessClaims>(token, {
        secret: this.env.JWT_ACCESS_SECRET,
      });
      return claims;
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }
  }

  generateRefreshToken(): string {
    return generateOpaqueToken(48);
  }

  hashRefreshToken(token: string): string {
    return hashToken(`${token}:${this.env.JWT_REFRESH_SECRET}`);
  }
}
