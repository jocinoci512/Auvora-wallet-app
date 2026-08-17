import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { extractAccessTokenFromCookies } from '@auvora/security';
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
        (req: Request) => extractAccessTokenFromCookies(req.cookies as Record<string, unknown>),
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
    if ((payload.surface ?? 'consumer') !== session.surface) {
      throw new UnauthorizedException('Session surface mismatch');
    }
    const stepUpExp = session.stepUpExpiresAt
      ? Math.floor(session.stepUpExpiresAt.getTime() / 1000)
      : undefined;
    return {
      ...payload,
      surface: session.surface === 'admin' ? 'admin' : 'consumer',
      stepUpExp,
    };
  }
}
