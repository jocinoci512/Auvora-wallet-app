# Auvora KYC Implementation Audit

**Date:** 2026-08-27  
**Scope:** Code-backed findings only (no product roadmap claims).

## Summary

KYC in Auvora is implemented as **vendor-agnostic provider ports** in `services/compliance`. There is **no Sumsub (or other commercial KYC vendor) SDK** in the repository. Runtime behavior is either **local simulators** or **unavailable / fail-closed** stubs. Document upload stores an **encrypted storage key** (client-supplied opaque key), not raw file bytes. Mobile exposes **status / basic submit** only — it does not upload ID documents.

---

## Classification: `KYC_PROVIDER`

| Classification    | Meaning in this codebase                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`simulator`**   | When `COMPLIANCE_SIMULATOR_ENABLED=true` (non-production). Identity/document/sanctions/PEP/etc. bind to local simulator providers (`local-identity-simulator`, `local-document-simulator`, …). |
| **`unavailable`** | When simulators are off (required in production). Identity/document providers return `unavailable-identity` / `unavailable-document` and reject with “not configured”.                         |

**There is no env var named `KYC_PROVIDER`.** Effective provider mode is selected by `COMPLIANCE_SIMULATOR_ENABLED` in `services/compliance/src/config/env.schema.ts`, wired in `services/compliance/src/infrastructure/infrastructure.module.ts`.

- Production guard: `COMPLIANCE_SIMULATOR_ENABLED` **must be false** when `NODE_ENV=production`.
- ADR: `docs/adr/0003-compliance-provider-ports.md` — ports exist; concrete vendor adapters are not shipped.

**Sumsub:** zero references in `services/compliance` (or broader KYC paths searched for this audit).

---

## Classification: `KYC_DOCUMENT_STORAGE`

| Classification                       | Meaning in this codebase                                                                                                                                          |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`storageKey` only**                | API accepts a client-supplied opaque `storageKey` (e.g. tests use `s3://bucket/key`).                                                                             |
| **Encrypted at rest in DB**          | Persisted as `storageKeyEncrypted` via field encryption (`COMPLIANCE_FIELD_ENCRYPTION_KEY`). Checksum of the plaintext key is stored as `checksumSha256`.         |
| **No object-storage driver in-repo** | No S3/GCS/Azure upload adapter or bucket env for KYC documents in compliance. The service does not accept or store raw document bytes on the upload path audited. |

Evidence:

- DTO: `UploadDocumentDto.storageKey` — `services/compliance/src/presentation/controllers/compliance.controller.ts`
- Persist/verify: `KycService.uploadDocument` — encrypts key, writes `storageKeyEncrypted`, then calls `documents.verifyDocument({ storageKey })` — `services/compliance/src/application/services/kyc.service.ts`

**There is no env var named `KYC_DOCUMENT_STORAGE`.** Behavior is implicit: opaque key + encrypted DB column.

---

## Mobile client

| Capability | Finding                                                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Status     | `KycClient.fetchStatus` — status snapshot for UI (`apps/mobile/lib/account/kyc_client.dart`)                                                                                              |
| Submit     | `submitBasic` posts `{ requestedLevel: 'BASIC' }` only                                                                                                                                    |
| Documents  | Explicit comment: _“never uploads raw ID documents from this client path”_                                                                                                                |
| Path note  | Mobile `GET /api/v1/compliance/kyc` may not match backend `GET .../profile` and `GET .../kyc/status` (POST `.../kyc` aligns with submit). Treat as a contract mismatch to fix separately. |

---

## Notification events (compliance → notifications)

Mapped in `EventNotificationMapperService`:

- `compliance.kyc.submitted`
- `compliance.kyc.approved`
- `compliance.kyc.rejected`
- `compliance.kyc.resubmission_required`

---

## Bottom line

| Asked label              | Exact code classification                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **KYC_PROVIDER**         | **`simulator`** (dev/non-prod with `COMPLIANCE_SIMULATOR_ENABLED`) **or** **`unavailable`** (simulators off / production). **Not Sumsub.** |
| **KYC_DOCUMENT_STORAGE** | **`storageKey`-only** with **encrypted key in DB**; no in-repo document blob store / vendor upload.                                        |
| **Mobile**               | **Status (+ basic submit) only** — no document upload.                                                                                     |
