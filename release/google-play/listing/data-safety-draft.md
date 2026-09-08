# Play Console Data Safety Draft — Auvora Wallet

Human-readable guide for completing the Google Play Console Data Safety declaration.
_Owner & Counsel Note: Review and confirm specific jurisdictional retention periods before production store submission. Do NOT declare "no data collected."_

---

## 1. Overview of Data Processing Architecture

Auvora is a non-custodial cryptocurrency wallet. Private keys and recovery phrases are generated and retained exclusively on the user's device and are never collected or transmitted. However, optional cloud account features and regulatory compliance policies (such as transfer threshold gates) involve specific data collection and first-party verification processing.

---

## 2. Data Types & Processing Classifications

### A. Personal Info

#### 1. Email Address

- **Collected**: Yes (when creating or using an optional Auvora account).
- **Purpose**: Account management, security authentication (verification tokens, password resets), fraud prevention.
- **Shared / Third-Party Processor**: Outbound transactional email delivered via Resend (SMTP).
- **Ephemeral processing?**: No (stored in Auvora backend database until account deletion).

#### 2. Name, Date of Birth & Country

- **Collected**: Yes (only when the user initiates identity verification for high-value transfer policies).
- **Purpose**: Legal compliance, AML/CFT regulations, sanctions screening.
- **Storage**: Stored in Auvora backend database encrypted with AES-256-GCM at rest.
- **Ephemeral processing?**: No.

#### 3. User IDs & Device Identifiers

- **Collected**: Yes (user UUID, coarse device fingerprint, client OS version).
- **Purpose**: Account management, device session security, abuse prevention.

---

### B. Photos and Videos / Files and Docs & Government Identification (KYC)

#### 1. Government-Issued Documents & Identification Cards

- **Processed**: Yes (when user undergoes identity verification).
- **First-Party Processing Architecture**:
  - **Direct Collection**: Government documents (passport, driver's license, national ID, residence permit) are submitted directly to Auvora's secure backend for manual verification by authorized Auvora administrators.
  - **No Commercial KYC Third-Party Sharing**: Auvora does **not** transmit customer identity documents to third-party commercial verification providers (such as Stripe Identity).
  - **Storage & Security**: Uploaded document images are sanitized (metadata and EXIF stripped), encrypted with server-side AES-256-GCM at rest, and stored in private, access-controlled backend storage. They are never publicly accessible, never exposed via permanent URLs, and retrievable only by authorized Super Administrators via short-lived signed tokens.
- **Purpose**: Regulatory compliance, AML/CFT verification, fraud prevention.
- **Shared?**: No third-party sharing. Verified internally by authorized compliance personnel.

---

### C. Blockchain & Network Identifiers

#### 1. Public Blockchain Addresses

- **Processed**: Yes (when querying balances, transaction history, or interacting with dApps via WalletConnect).
- **Purpose**: App functionality.
- **Shared**: Sent via HTTPS to node infrastructure providers (e.g. Alchemy, QuickNode, TronGrid) to read blockchain state.
- **Secrets**: Private keys, mnemonics, and seed phrases are **never** transmitted or shared.

---

### D. Crash Logs & Diagnostics

- **Crash Reporting**: Diagnostic stack traces are collected only when observability/telemetry is enabled for app stability.
- **Redaction**: All personal identifiers, credentials, private keys, and mnemonics are scrubbed before telemetry dispatch.

---

## 3. Security Practices

- **Data Encryption in Transit**: All data is encrypted in transit over secure protocols (TLS 1.3 / HTTPS).
- **Data Encryption at Rest**: Sensitive data fields (PII, tokens, ID numbers) and government ID files are encrypted with AES-256-GCM at rest.
- **Data Deletion Request Mechanism**: Users can request account and data deletion in-app or via support (privacy@auvorawallet.com).
  - _Immediate Deletion_: Unverified user accounts, draft files, and session data are purged immediately.
  - _Statutory Retention Architecture_: Configurable retention separates raw ID documents from compliance audit history. Durations remain subject to final confirmation by legal counsel.
