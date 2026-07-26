import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ACCESS_TOKEN_COOKIE } from '@auvora/security';
import type { JwtAccessClaims } from '@auvora/types';
import type { Request } from 'express';
import { ENV, type ServiceEnv } from '../../config/env.schema';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(ENV) env: ServiceEnv) {
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

  validate(payload: JwtAccessClaims): JwtAccessClaims {
    return payload;
  }
}
