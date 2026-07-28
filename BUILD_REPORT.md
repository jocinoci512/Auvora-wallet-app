# Build Report — Pre-Deployment Audit

**Date:** 2026-07-27  
**Command set:** `pnpm install` · `pnpm lint` · `pnpm typecheck` · `pnpm build`

---

## Summary

| Step | Exit | Notes |
|------|------|-------|
| Install | **0** | Frozen lockfile; 31 workspace projects |
| Lint | **0** | 35/35 Turbo tasks |
| Typecheck | **0** | 35/35 Turbo tasks |
| Build | **0** | 29/29 Turbo tasks |

**Build status: PASS**

---

## Production Next.js output (First Load JS shared)

| App | Shared First Load JS |
|-----|----------------------|
| `@auvora/web` | ~103 kB |
| `@auvora/admin` | ~102 kB |
| `@auvora/docs` | ~102 kB |

Web routes include static (○) and dynamic (ƒ) App Router pages; wallet detail routes remain dynamic.

Docker / Vercel:

- `infrastructure/docker/Dockerfile.next` — standalone multi-stage  
- `apps/*/vercel.json` — monorepo install/build commands  
- `scripts/next-production-build.mjs` — clears stale `.next` before prod build  

---

## Nest / packages

All Nest services and shared packages completed `turbo run build` without errors in this run.

---

## Prisma

- Schema present (`generator` + PostgreSQL `datasource`)  
- **21** migration directories  
- `prisma format` applied during audit  
- `prisma validate` succeeds when `DATABASE_URL` is set (required by Prisma CLI)

---

## Failures fixed

None required for compile gates. Hygiene fixes: schema format, CD concurrency, `.gitignore` env patterns.

---

## Remaining build risks

| Risk | Severity | Notes |
|------|----------|-------|
| Mixing `next build` + `next dev` `.next` caches | Medium | Mitigated by `preview:ui:clean` / production build wipe |
| Uncommitted local WIP | Medium | Run gates again before merging large pending trees |
