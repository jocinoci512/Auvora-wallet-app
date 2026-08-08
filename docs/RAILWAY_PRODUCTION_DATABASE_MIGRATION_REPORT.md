# Railway Production Database Migration Report

**Date:** 2026-08-08  
**Workspace:** `D:\auvora-wallet`  
**Operator:** one-off production Prisma migrate deploy attempt  
**Rule:** No credentials, connection strings, or secret values in this document.

---

## Verdict

**RAILWAY DATABASE ACCESS REQUIRED**

`migrate deploy` was **not** executed. The local environment does **not** positively verify a Railway production Postgres `DATABASE_URL`. Per safety policy, the agent must not guess or migrate against an unverified target.

---

## DATABASE TARGET

| Check                                                                            | Result                                                                                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **DATABASE TARGET**                                                              | **NOT VERIFIED**                                                                                                  |
| Process env `DATABASE_URL`                                                       | Not set                                                                                                           |
| Process env `DATABASE_PUBLIC_URL` / `POSTGRES_URL`                               | Not set                                                                                                           |
| Root `.env` `DATABASE_URL`                                                       | Present; host classifies as **localhost** (not Railway / not `rlwy` / not `railway.app` / not `railway.internal`) |
| Railway CLI (`railway`)                                                          | **Not installed** on PATH                                                                                         |
| Railway project link (`.railway`, `~/.railway`, `railway.toml` / `railway.json`) | **Missing**                                                                                                       |
| `npx railway` linked project                                                     | No `.railway` config from workspace                                                                               |

**Classification rule used:** hostname must contain Railway production markers (`railway`, `rlwy`, `railway.app`, or `railway.internal`) before any migrate command is allowed. Localhost and other remotes fail that gate.

---

## Actions taken (safe only)

1. Searched for Railway CLI and linked project — not available.
2. Classified available `DATABASE_URL` sources **without printing** the URL or credentials.
3. Confirmed Prisma schema package: `@auvora/database-schema` in `database/` (22 migrations under `database/prisma/migrations/`).
4. Confirmed **citext** requirement (see below).
5. **Did not** run: `migrate deploy`, `migrate reset`, `db push`, drop/truncate, Nest deploy, or git commit/push.

---

## Citext extension

| Item            | Detail                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema          | `User.email` and `User.username` use `@db.Citext` in `database/prisma/schema.prisma`                                                                                                                                |
| Migration       | `database/prisma/migrations/20260725180000_auth_identity/migration.sql` starts with `CREATE EXTENSION IF NOT EXISTS citext;`                                                                                        |
| Production note | Railway Postgres must allow the `citext` extension (default Postgres images usually do). Run migrations as a role that can create extensions, or pre-enable `citext` in the Railway Postgres service before deploy. |

---

## Intended migrate commands (when Railway prod URL is verified)

From repo root, with Railway production `DATABASE_URL` injected (never echoed):

```bash
pnpm --filter @auvora/database-schema exec prisma migrate status
pnpm --filter @auvora/database-schema exec prisma migrate deploy
pnpm --filter @auvora/database-schema exec prisma migrate status
pnpm --filter @auvora/database-schema exec prisma validate
pnpm --filter @auvora/database-schema exec prisma generate
```

Optional safe post-check (table names only, no row dumps):

```bash
pnpm --filter @auvora/database-schema exec prisma db execute --stdin <<< "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1;"
```

**Forbidden on production:** `migrate reset`, `db push`, force-reset, drop/truncate scripts.

---

## Safest Railway-side method (recommended)

Do the one-off migrate **on Railway** so `DATABASE_URL` never leaves the platform and is never pasted into local shells or chat.

### Option A — Railway one-off job / shell (preferred)

1. In Railway Dashboard → production project → Postgres service, confirm the production Postgres plugin/service.
2. Open a service that already has production `DATABASE_URL` referenced (or a temporary one-off service using the **same** Postgres variable reference).
3. Run a **one-off** shell/job (Railway shell / one-off run) with repo checkout and Node/pnpm available.
4. Ensure `citext` can be created (or enable extension once in Postgres).
5. Execute **only**:

   ```bash
   pnpm --filter @auvora/database-schema exec prisma migrate status
   pnpm --filter @auvora/database-schema exec prisma migrate deploy
   pnpm --filter @auvora/database-schema exec prisma migrate status
   ```

6. Capture exit codes and pending/applied counts into this report (still no URL). Tear down any temporary one-off service afterward.
7. Do **not** enable broadcast, do **not** deploy Nest as part of this migration step.

### Option B — Local CLI after explicit Railway link (secondary)

1. Install Railway CLI and `railway login` / `railway link` to the **production** project.
2. Inject URL without printing, e.g. assign `DATABASE_URL` from `railway variables` / service variable fetch into the process env (never `echo` / never log).
3. Re-run hostname classification (`rlwy` / `railway` markers) until **DATABASE TARGET: RAILWAY PRODUCTION POSTGRES**.
4. Only then run the `migrate status` → `migrate deploy` → `migrate status` sequence above.

### Option C — Dashboard copy into one-off local session (least preferred)

Copy production `DATABASE_URL` from Railway Postgres **Connect** into a short-lived local shell env var (do not commit, do not paste into docs/chat). Verify hostname markers, run migrate deploy once, then clear the env var.

---

## Migration inventory (repo)

- **Package:** `@auvora/database-schema` (`database/`)
- **Migration count in repo:** 22 SQL migrations under `database/prisma/migrations/`
- **Deploy command (canonical):** `pnpm --filter @auvora/database-schema exec prisma migrate deploy`

---

## Next action

Provide Railway production database access via **Option A** (one-off Railway shell/job with injected `DATABASE_URL`), then re-run this procedure so `migrate deploy` can execute against a positively verified Railway production target and this report can be updated with applied/pending status (still without credentials).

---

## Change log

| When       | What                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-08-08 | Access check only; migrate **skipped**; target **NOT VERIFIED** (local `.env` → localhost; no Railway CLI/link) |
