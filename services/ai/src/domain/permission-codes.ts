import type { PermissionCode } from '@auvora/types';

export const PERMISSION_AI_READ: PermissionCode = 'ai:read';
export const PERMISSION_AI_WRITE: PermissionCode = 'ai:write';
export const PERMISSION_AI_ADMIN: PermissionCode = 'ai:admin';
export const PERMISSION_AI_PROMPTS: PermissionCode = 'ai:prompts';
export const PERMISSION_AI_KNOWLEDGE: PermissionCode = 'ai:knowledge';
export const PERMISSION_AI_CHAT: PermissionCode = 'ai:chat';

export const ALL_AI_PERMISSION_CODES: readonly PermissionCode[] = [
  PERMISSION_AI_READ,
  PERMISSION_AI_WRITE,
  PERMISSION_AI_ADMIN,
  PERMISSION_AI_PROMPTS,
  PERMISSION_AI_KNOWLEDGE,
  PERMISSION_AI_CHAT,
] as const;

export const ROLE_ADMIN = 'admin';
export const ROLE_SUPER_ADMIN = 'super_admin';
