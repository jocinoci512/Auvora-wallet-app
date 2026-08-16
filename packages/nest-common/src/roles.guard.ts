import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ADMIN_PORTAL_ROLES, type JwtAccessClaims } from '@auvora/types';
import type { Request } from 'express';
import { ROLES_KEY } from './auth.decorators';

const ADMIN_PORTAL_ROLE_SET = new Set<string>(ADMIN_PORTAL_ROLES);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user: JwtAccessClaims }>();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    const hasRole = requiredRoles.some((role) => user.roles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException('Insufficient role');
    }

    const requiresAdminSurface = requiredRoles.some((role) => ADMIN_PORTAL_ROLE_SET.has(role));
    if (requiresAdminSurface && user.surface !== 'admin') {
      throw new ForbiddenException('Admin session required');
    }
    return true;
  }
}
