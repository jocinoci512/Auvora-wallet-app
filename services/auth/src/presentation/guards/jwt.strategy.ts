import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '@auvora/security';
import type { JwtAccessClaims } from '@auvora/types';
import type { Request } from 'express';
import {
  SESSION_REPOSITORY,
  type SessionRepositoryPort,
} from '../../application/ports/session-repository.port';
import { ENV, type ServiceEnv } from '../../config/env.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(ENV) env: ServiceEnv,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepositoryPort,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          const cookies = req.cookies as Record<string, string | undefined>;
          return cookies[ACCESS_TOKEN_COOKIE] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
    });
  }

  async validate(payload: JwtAccessClaims): Promise<JwtAccessClaims> {
    if (!payload.sessionId) {
      throw new UnauthorizedException('Invalid access token');
    }
    const session = await this.sessions.findById(payload.sessionId);
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session revoked or expired');
    }
    if (session.userId !== payload.sub) {
      throw new UnauthorizedException('Session does not match token subject');
    }
    return payload;
  }
}
