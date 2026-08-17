import type { PermissionCode, UserStatus } from '@auvora/types';

export interface AuthUser {
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
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  roles: string[];
  permissions: PermissionCode[];
}

export interface CreateUserInput {
  email: string;
  username: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  preferredLanguage?: string;
  timeZone?: string;
  country?: string;
}

export interface UserSearchFilters {
  query?: string;
  status?: UserStatus;
  skip?: number;
  take?: number;
  /** Directory of staff roles (including future non-portal roles). Portal login is SUPER_ADMIN only. */
  adminStaffOnly?: boolean;
}

export interface UserSearchResult {
  users: AuthUser[];
  total: number;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepositoryPort {
  findById(id: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  findByUsername(username: string): Promise<AuthUser | null>;
  create(input: CreateUserInput): Promise<AuthUser>;
  updateProfile(userId: string, input: UpdateProfileInput): Promise<AuthUser>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;
  updateStatus(userId: string, status: UserStatus): Promise<AuthUser>;
  softDelete(userId: string): Promise<AuthUser>;
  restore(userId: string): Promise<AuthUser>;
  assignRoles(userId: string, roleNames: string[]): Promise<AuthUser>;
  toggleMfa(userId: string, enabled: boolean): Promise<AuthUser>;
  markEmailVerified(userId: string): Promise<void>;
  recordFailedLogin(userId: string, failedCount: number, lockedUntil: Date | null): Promise<void>;
  resetFailedLogin(userId: string): Promise<void>;
  updateLastLogin(userId: string, at: Date): Promise<void>;
  search(filters: UserSearchFilters): Promise<UserSearchResult>;
  createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumeEmailVerificationToken(tokenHash: string): Promise<string | null>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  consumePasswordResetToken(tokenHash: string): Promise<string | null>;
}
