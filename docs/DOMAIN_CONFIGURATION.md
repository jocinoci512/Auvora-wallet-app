# Domain Configuration — Auvora Wallet

**Task:** 036  
**Rule:** All public domains come from **environment / Helm config**. Application source must not hardcode production hostnames.

---

## Production hosts

| URL | Backend | Purpose |
|-----|---------|---------|
| https://example.com | `web` | Marketing / landing |
| https://www.example.com | `web` | WWW alias |
| https://app.example.com | `web` | Primary wallet app |
| https://api.example.com | `gateway` | Public API (+ WSS) |
| https://admin.example.com | `admin` | Admin console |
| https://docs.example.com | `docs` | Product docs |
| https://status.example.com | `web` → `/status` | Public status surface |

CDN (recommended): `https://cdn.example.com` → object storage origin (`CDN_ASSET_BASE_URL`).

## Configuration sources

| Layer | Mechanism |
|-------|-----------|
| Helm production | `infrastructure/helm/auvora-wallet/values-production.yaml` → `ingress.hosts[]` + `config.*` |
| Helm staging | `values-staging.yaml` (`*.staging.example.com`) |
| Process env | `.env.production.example` / `.env.staging.example` (templates only) |
| Next apps | `NEXT_PUBLIC_*` via Zod in `apps/{web,admin,docs}/src/env.ts` |
| Auth cookies | `COOKIE_DOMAIN`, `COOKIE_SECURE`, `APP_PUBLIC_URL` |
| Gateway CORS | `CORS_ORIGINS` (comma-separated) |

## Required env keys (public URLs)

```text
APP_PUBLIC_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_ADMIN_URL
NEXT_PUBLIC_DOCS_URL
NEXT_PUBLIC_STATUS_URL
NEXT_PUBLIC_MARKETING_URL
NEXT_PUBLIC_CDN_ASSET_BASE_URL   # optional
CORS_ORIGINS
COOKIE_DOMAIN
COOKIE_SECURE
CDN_ASSET_BASE_URL               # server-side
```

## DNS checklist

1. Create A/AAAA or CNAME records for each host → ingress load balancer  
2. Issue TLS via cert-manager (`letsencrypt-prod` ClusterIssuer)  
3. Verify HSTS and HTTPS redirects  
4. Point `cdn.` origin to object storage with TLS  
5. Confirm `COOKIE_DOMAIN=.example.com` covers app + admin  

## Legacy single-host mode

If `ingress.hosts` is empty, the chart falls back to path-based routing on `ingress.host`:

- `/` → web  
- `/admin` → admin  
- `/api` → gateway  

Use multi-host mode for public launch.

## TLS / certificate renewal

- **Issuer:** cert-manager + Let’s Encrypt (annotation on Ingress)  
- **Renewal:** automatic (~30 days before expiry)  
- **Ops:** monitor cert-manager Certificate Ready condition; alert on `False`  
- **Manual reissue:** delete Certificate secret or run `cmctl renew` in the namespace  

See also [`SECURITY_HARDENING.md`](./SECURITY_HARDENING.md).
