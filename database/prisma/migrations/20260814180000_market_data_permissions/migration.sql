-- Market-data RBAC permissions (data migration).
--
-- The market-data service controllers enforce market-data:read / :write / :admin /
-- :alerts, but these permission rows and role grants were never present in the
-- database, so every authenticated market-data request returned 403 for all users
-- (including admin). This migration seeds the four permission definitions and the
-- intended role grants. It is fully idempotent and additive:
--   * ON CONFLICT DO NOTHING — safe to re-run, never duplicates.
--   * Only INSERTs into "permissions" and "role_permissions".
--   * Never deletes/updates users, roles, existing grants, wallets, or any other data.
--   * Never resets passwords or inserts users.
-- Grants mirror the application seed:
--   admin + super_admin -> all four; user -> read/write/alerts (not admin).

-- 1) Permission definitions.
INSERT INTO "permissions" ("id", "code", "description", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'market-data:read',   'Read market prices, charts, trending, and overviews', now(), now()),
  (gen_random_uuid(), 'market-data:write',  'Manage watchlists and market-data preferences',       now(), now()),
  (gen_random_uuid(), 'market-data:admin',  'Administer market-data providers, cache, and workers', now(), now()),
  (gen_random_uuid(), 'market-data:alerts', 'Create and manage market price alerts',                now(), now())
ON CONFLICT ("code") DO NOTHING;

-- 2) Grant all four to admin and super_admin roles (if present).
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('admin', 'super_admin')
  AND p."code" IN ('market-data:read', 'market-data:write', 'market-data:admin', 'market-data:alerts')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;

-- 3) Grant read/write/alerts to the default user role (if present).
INSERT INTO "role_permissions" ("role_id", "permission_id", "assigned_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" = 'user'
  AND p."code" IN ('market-data:read', 'market-data:write', 'market-data:alerts')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
