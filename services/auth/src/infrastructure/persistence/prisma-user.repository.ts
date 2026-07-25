import { Injectable } from '@nestjs/common';
import { type PrismaService } from '@auvora/database';
import { UserStatus as PrismaUserStatus } from '@auvora/database';
import type { PermissionCode, UserStatus } from '@auvora/types';
import type {
  AuthUser,
  CreateUserInput,
  UpdateProfileInput,
  UserRepositoryPort,
  UserSearchFilters,
  UserSearchResult,
} from '../../application/ports/user-repository.port';
import { ROLE_USER } from '../../domain/permission-codes';

const userInclude = {
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
} as const;

function mapStatus(status: PrismaUserStatus): UserStatus {
  return status as unknown as UserStatus;
}

function mapUser(record: {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  avatarUrl: string | null;
  preferredLanguage: string;
  timeZone: string;
  country: string | null;
  status: PrismaUserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  roles: Array<{
    role: {
      name: string;
      permissions: Array<{ permission: { code: string } }>;
    };
  }>;
}): AuthUser {
  const roles = record.roles.map((r) => r.role.name);
  const permissions = [
    ...new Set(
      record.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code as PermissionCode)),
    ),
  ];
  return {
    id: record.id,
    email: record.email,
    username: record.username,
    passwordHash: record.passwordHash,
    firstName: record.firstName,
    lastName: record.lastName,
    phoneNumber: record.phoneNumber,
    avatarUrl: record.avatarUrl,
    preferredLanguage: record.preferredLanguage,
    timeZone: record.timeZone,
    country: record.country,
    status: mapStatus(record.status),
    emailVerified: record.emailVerified,
    mfaEnabled: record.mfaEnabled,
    failedLoginCount: record.failedLoginCount,
    lockedUntil: record.lockedUntil,
    lastLoginAt: record.lastLoginAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    roles,
    permissions,
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: userInclude });
    return user ? mapUser(user) : null;
  }

  async findByEmail(email: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude,
    });
    return user ? mapUser(user) : null;
  }

  async findByUsername(username: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      include: userInclude,
    });
    return user ? mapUser(user) : null;
  }

  async create(input: CreateUserInput): Promise<AuthUser> {
    const defaultRole = await this.prisma.role.findUnique({ where: { name: ROLE_USER } });

    const user = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        username: input.username.toLowerCase(),
        passwordHash: input.passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        status: PrismaUserStatus.PENDING_VERIFICATION,
        roles: defaultRole
          ? { create: [{ roleId: defaultRole.id }] }
          : undefined,
      },
      include: userInclude,
    });
    return mapUser(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: input,
      include: userInclude,
    });
    return mapUser(user);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async updateStatus(userId: string, status: UserStatus): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: status as PrismaUserStatus },
      include: userInclude,
    });
    return mapUser(user);
  }

  async softDelete(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: PrismaUserStatus.DELETED,
      },
      include: userInclude,
    });
    return mapUser(user);
  }

  async restore(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: null,
        status: PrismaUserStatus.ACTIVE,
      },
      include: userInclude,
    });
    return mapUser(user);
  }

  async assignRoles(userId: string, roleNames: string[]): Promise<AuthUser> {
    const roles = await this.prisma.role.findMany({ where: { name: { in: roleNames } } });
    await this.prisma.userRole.deleteMany({ where: { userId } });
    if (roles.length > 0) {
      await this.prisma.userRole.createMany({
        data: roles.map((role) => ({ userId, roleId: role.id })),
      });
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: userInclude });
    return mapUser(user);
  }

  async toggleMfa(userId: string, enabled: boolean): Promise<AuthUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: enabled },
      include: userInclude,
    });
    return mapUser(user);
  }

  async markEmailVerified(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
    });
  }

  async recordFailedLogin(userId: string, failedCount: number, lockedUntil: Date | null): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: failedCount,
        lockedUntil,
        status: lockedUntil ? PrismaUserStatus.LOCKED : undefined,
      },
    });
  }

  async resetFailedLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        status: PrismaUserStatus.ACTIVE,
      },
    });
  }

  async updateLastLogin(userId: string, at: Date): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: at } });
  }

  async search(filters: UserSearchFilters): Promise<UserSearchResult> {
    const where: Record<string, unknown> = {};
    if (filters.status) {
      where.status = filters.status as PrismaUserStatus;
    }
    if (filters.query) {
      where.OR = [
        { email: { contains: filters.query, mode: 'insensitive' } },
        { username: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: userInclude,
        skip: filters.skip ?? 0,
        take: filters.take ?? 25,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users: users.map(mapUser), total };
  }

  async createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({ where: { userId, consumedAt: null } });
    await this.prisma.emailVerificationToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async consumeEmailVerificationToken(tokenHash: string): Promise<string | null> {
    const token = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!token || token.consumedAt || token.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await this.prisma.emailVerificationToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
    return token.userId;
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({ where: { userId, consumedAt: null } });
    await this.prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async consumePasswordResetToken(tokenHash: string): Promise<string | null> {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!token || token.consumedAt || token.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await this.prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { consumedAt: new Date() },
    });
    return token.userId;
  }
}
