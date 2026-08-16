-- Admin control-plane RBAC (Phase 3 increment 2) — additive data migration.
--
-- Adds granular admin permissions and the three new production admin roles
-- (support, security_analyst, read_only) with their capability grants. Existing
-- admin/super_admin roles and all current grants are preserved. Fully idempotent
-- and additive:
--   * ON CONFLICT DO NOTHING — safe to re-run, never duplicates.
--   * Only INSERTs into "permissions", "roles", "role_permissions".
--   * Never deletes/updates users, existing roles, existing grants, or any data.
--   * Never resets passwords, never inserts users, never inserts admins.

-- 1) New granular permission definitions.
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'users:suspend',       'Suspend user accounts', now(), now()),
  (gen_random_uuid(), 'users:reactivate',    'Reactivate suspended user accounts', now(), now()),
  (gen_random_uuid(), 'roles:read',          'Read roles and permission assignments', now(), now()),
  (gen_random_uuid(), 'sessions:read',       'Read user sessions', now(), now()),
  (gen_random_uuid(), 'devices:read',        'Read user devices', now(), now()),
  (gen_random_uuid(), 'devices:revoke',      'Revoke user devices', now(), now()),
  (gen_random_uuid(), 'connections:read',    'Read wallet connections', now(), now()),
  (gen_random_uuid(), 'connections:revoke',  'Disconnect wallet connections', now(), now()),
  (gen_random_uuid(), 'security:read',       'Read security events and posture', now(), now()),
  (gen_random_uuid(), 'security:manage',     'Act on security events (approved revocations)', now(), now()),
  (gen_random_uuid(), 'support:read',        'Read support notes and account assistance data', now(), now()),
  (gen_random_uuid(), 'support:write',       'Create and manage support notes', now(), now()),
  (gen_random_uuid(), 'admins:read',         'Read admin users and their safe metadata', now(), now()),
  (gen_random_uuid(), 'admins:manage',       'Manage admin users, roles, and status', now(), now()),
  (gen_random_uuid(), 'health:read',         'Read aggregated system health', now(), now()),
  (gen_random_uuid(), 'realtime:read',       'Connect to the admin realtime event stream', now(), now())
ON CONFLICT ("code") DO NOTHING;

-- 2) New production admin roles.
INSERT INTO "roles" ("id", "name", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'support',          'Support operations (read + limited assistance)', now(), now()),
  (gen_random_uuid(), 'security_analyst', 'Security analysis and approved revocations', now(), now()),
  (gen_random_uuid(), 'read_only',        'Read-only operational access', now(), now())
ON CONFLICT ("name") DO NOTHING;

-- 3) admin + super_admin retain FULL grants — grant them every new permission too.
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('admin', 'super_admin')
  AND p."code" IN (
    'users:suspend','users:reactivate','roles:read','sessions:read','devices:read','devices:revoke',
    'connections:read','connections:revoke','security:read','security:manage','support:read',
    'support:write','admins:read','admins:manage','health:read','realtime:read'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- 4) read_only role — read-only floor.
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'read_only'
  AND p."code" IN (
    'users:read','sessions:read','devices:read','connections:read','wallets:read','security:read',
    'audit:read','support:read','admins:read','roles:read','health:read','realtime:read'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- 5) support role — read floor + limited assistance.
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'support'
  AND p."code" IN (
    'users:read','sessions:read','devices:read','connections:read','wallets:read','security:read',
    'audit:read','support:read','admins:read','roles:read','health:read','realtime:read',
    'users:write','support:write'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- 6) security_analyst role — read floor + approved revocations + security management.
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'security_analyst'
  AND p."code" IN (
    'users:read','sessions:read','devices:read','connections:read','wallets:read','security:read',
    'audit:read','support:read','admins:read','roles:read','health:read','realtime:read',
    'security:manage','sessions:revoke','devices:revoke','connections:revoke'
  )
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
