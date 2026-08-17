import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { JwtAccessClaims } from '@auvora/types';
import type { Request } from 'express';
import { REQUIRE_STEP_UP_KEY } from './auth.decorators';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: JwtAccessClaims }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const stepUpExp = user.stepUpExp;
    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof stepUpExp !== 'number' || stepUpExp <= nowSeconds) {
      throw new ForbiddenException('Step-up authentication required');
    }
    return true;
  }
}
