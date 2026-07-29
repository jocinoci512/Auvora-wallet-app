# New Repository Setup — Auvora Wallet

Manual steps only. Application code, features, and business logic were not removed.

---

## 1. Point Git at the new GitHub repository

Local `.git` history is preserved. Replace the old remote (currently may still point at a previous repo):

```bash
git remote -v
git remote remove origin
git remote add origin https://github.com/<YOUR_ORG>/<YOUR_NEW_REPO>.git
git branch -M main
git push -u origin main
```

If the new repo already has a README/commit and push is rejected, prefer:

```bash
git push -u origin main
# only if you intentionally want to overwrite the empty/default remote main:
# git push -u origin main --force-with-lease
```

Do **not** delete `.git`, rewrite history, or remove local branches unless you explicitly choose to.

---

## 2. Create GitHub Environments & secrets

In the **new** repository:

1. Settings → Environments → create `staging` and `production`  
2. On `production`, enable required reviewers  
3. Add Actions secrets (repo and/or environment):

| Secret | Purpose |
|--------|---------|
| `VERCEL_TOKEN` | Optional if using Vercel GitHub integration |
| `VERCEL_ORG_ID` | New Vercel team/user id |
| `VERCEL_PROJECT_ID_WEB` | **New** web project id |
| `VERCEL_PROJECT_ID_ADMIN` | **New** admin project id |
| `KUBE_CONFIG_DATA` | Base64 kubeconfig for Helm staging (env `staging`) |
| `DATABASE_URL` | Optional migrate step |
| `STAGING_GATEWAY_URL` | Optional smoke URL |

Workflows use `github.repository` for GHCR image paths — no hardcoded old repo name.

---

## 3. Create **new** Vercel projects (do not reuse old ones)

1. Import the **new** GitHub repo into Vercel  
2. Create separate projects:

| Project | Root Directory |
|---------|----------------|
| web | `apps/web` |
| admin | `apps/admin` |
| docs (optional) | `apps/docs` |

3. Production branch: `main`  
4. Copy env vars from `.env.production.example`, replacing `example.com` with your real domain  
5. Redeploy after env changes (`NEXT_PUBLIC_*` are build-time)

---

## 4. Replace placeholder domains

Configs now use `example.com` / `staging.example.com` placeholders. Before live deploy, set your real domain in:

- `.env` / Vercel env / secrets manager  
- `infrastructure/helm/auvora-wallet/values-staging.yaml`  
- `infrastructure/helm/auvora-wallet/values-production.yaml`  

DNS + TLS for app / api / admin / docs / status hosts must match those values.

---

## 5. Backend / Kubernetes (if used)

1. Ensure GHCR packages from the **new** `ghcr.io/<owner>/<repo>/…` are pullable by the cluster  
2. Populate External Secrets / sealed secrets for the new environment  
3. `helm upgrade --install …` via Actions CD (staging) or Deploy workflow (production gated)  

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full operator path.

---

## 6. Database

```bash
export DATABASE_URL='postgresql://…'   # new managed DB
pnpm install --frozen-lockfile
pnpm --filter @auvora/database-schema exec prisma migrate deploy
```

---

## 7. Provider keys

Configure in secrets only (never commit): Alchemy, JWT, CSRF, SMTP, object storage, etc. Templates: `.env.example`, `.env.staging.example`, `.env.production.example`.

---

## 8. Post-connect verification

1. Push a commit to `main` → Actions → **CI** and **Continuous Deployment**  
2. Confirm Vercel preview/production URLs for web/admin  
3. Confirm GHCR images publish under the **new** repository name  
4. Run `pnpm preview:health` locally if validating UI without cloud  

---

## Not automated (by design)

- Creating the empty GitHub repository in the UI  
- Choosing org/repo name and visibility  
- Owning DNS / TLS certificates  
- Paying for / connecting Vercel, Kubernetes, Postgres, Redis  
- Rotating and pasting live secrets  
- Force-push decisions if the new remote is non-empty  
