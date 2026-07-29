# Vercel first deployment guide (`apps/web`)

Checklist for the **first** Vercel project targeting `apps/web` only. No backend Nest services are deployed by this project.

---

## 1. Environment variables to enter in Vercel

Enter these on the Vercel project → **Settings → Environment Variables**. Apply to **Production** and **Preview** (and Development if you use `vercel dev`).

| #   | Name                             | Suggested first value                                                          |
| --- | -------------------------------- | ------------------------------------------------------------------------------ |
| 1   | `NEXT_PUBLIC_API_URL`            | `https://api.example.com`                                                      |
| 2   | `NEXT_PUBLIC_APP_NAME`           | `Auvora Wallet`                                                                |
| 3   | `NEXT_PUBLIC_APP_URL`            | `https://your-web-project.vercel.app` (update after first deploy URL is known) |
| 4   | `NEXT_PUBLIC_ADMIN_URL`          | `https://admin.example.com`                                                    |
| 5   | `NEXT_PUBLIC_DOCS_URL`           | `https://docs.example.com`                                                     |
| 6   | `NEXT_PUBLIC_STATUS_URL`         | `https://status.example.com`                                                   |
| 7   | `NEXT_PUBLIC_MARKETING_URL`      | `https://www.example.com`                                                      |
| 8   | `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | _(leave unset)_ or `https://cdn.example.com`                                   |

Do **not** add Nest/backend secrets (`DATABASE_URL`, `JWT_*`, `CSRF_SECRET`, field encryption keys, etc.) to this Vercel project. They are unused by `apps/web`.

Do **not** set `DOCKER_BUILD` on Vercel (that enables Next `output: 'standalone'` for Docker only).

`NODE_ENV` is set by Vercel automatically — do not override it.

---

## 2. Order to enter them

1. `NEXT_PUBLIC_API_URL` (set this first — it is the only value that affects client API traffic)
2. `NEXT_PUBLIC_APP_NAME`
3. `NEXT_PUBLIC_APP_URL` (placeholder until the Vercel URL exists; then update and redeploy)
4. `NEXT_PUBLIC_ADMIN_URL`
5. `NEXT_PUBLIC_DOCS_URL`
6. `NEXT_PUBLIC_STATUS_URL`
7. `NEXT_PUBLIC_MARKETING_URL`
8. `NEXT_PUBLIC_CDN_ASSET_BASE_URL` (optional; skip if unused)

---

## 3. Values that can temporarily use placeholders

| Variable                         | Placeholder OK?                                                     | Example                                      |
| -------------------------------- | ------------------------------------------------------------------- | -------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | Yes (UI deploys; browser calls fail until a real API origin exists) | `https://api.example.com`                    |
| `NEXT_PUBLIC_APP_NAME`           | Yes (or omit — code default is `Auvora Wallet`)                     | `Auvora Wallet`                              |
| `NEXT_PUBLIC_APP_URL`            | Yes                                                                 | Your Vercel URL or `https://app.example.com` |
| `NEXT_PUBLIC_ADMIN_URL`          | Yes                                                                 | `https://admin.example.com`                  |
| `NEXT_PUBLIC_DOCS_URL`           | Yes                                                                 | `https://docs.example.com`                   |
| `NEXT_PUBLIC_STATUS_URL`         | Yes                                                                 | `https://status.example.com`                 |
| `NEXT_PUBLIC_MARKETING_URL`      | Yes                                                                 | `https://www.example.com`                    |
| `NEXT_PUBLIC_CDN_ASSET_BASE_URL` | Yes — or omit entirely                                              | `https://cdn.example.com`                    |

Empty strings are treated as unset by `apps/web/src/env.ts` (safe if a Vercel field is left blank).

---

## 4. Values that must be real

| Variable                                                 | Must be real before first Vercel deploy?                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nest secrets / DB / Redis / JWT / CSRF / encryption keys | **No** — not used by this project                                                                                                                               |
| `NEXT_PUBLIC_API_URL`                                    | **No** for a successful _build/host_ — **Yes** before the wallet UI can talk to a live gateway (replace the placeholder with your real public API HTTPS origin) |
| Google Fonts / static assets                             | **No** — bundled / loaded from Next + public assets; no extra env required                                                                                      |

There is **no** secret that absolutely must be real for the `apps/web` Vercel build to succeed.

---

## 5. Expected Build Command

```text
cd ../.. && pnpm turbo run build --filter=@auvora/web
```

(Already set in `apps/web/vercel.json`. Leave the Vercel UI Build Command empty so `vercel.json` wins, or paste the same string.)

---

## 6. Expected Install Command

```text
cd ../.. && pnpm install --frozen-lockfile
```

(Already set in `apps/web/vercel.json`. Vercel must detect `packageManager: pnpm@9.15.9` from the repo root `package.json`.)

---

## 7. Expected Root Directory

```text
apps/web
```

---

## 8. Expected Framework

```text
Next.js
```

(`framework: "nextjs"` in `apps/web/vercel.json`.)

---

## 9. Expected Node.js version

```text
22.x
```

Sources: root `engines.node` (`>=22.0.0`), `apps/web` `engines.node` (`22.x`), `.nvmrc` / `apps/web/.nvmrc` (`22`).

In the Vercel project: **Settings → General → Node.js Version → 22.x** (if not auto-detected).

---

## 10. Remaining blockers

| Item                                   | Blocker for Vercel _deploy_ of `apps/web`?                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Missing Nest backend on Vercel         | **No** — backend is out of scope for this project                                        |
| Placeholder `NEXT_PUBLIC_API_URL`      | **No** for hosting — API-backed features will not work until a real origin is set        |
| Prisma generation on Vercel            | **No** — `@auvora/web` turbo graph does not build `@auvora/database`                     |
| Middleware                             | **No** — `apps/web` has no `middleware.ts`                                               |
| Critical build/lint/typecheck failures | **None** as of this guide (local `pnpm install` / `lint` / `typecheck` / `build` passed) |

**No remaining critical blockers** for the first Vercel deployment of `apps/web`.
