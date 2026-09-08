# Play Console Data Safety Draft — Auvora Wallet

Human-readable guide for completing the Google Play Console Data Safety declaration.
_Owner & Counsel Note: Review and confirm specific jurisdictional retention periods before production store submission. Do NOT declare "no data collected."_

---

## 1. Overview of Data Processing Architecture

Auvora is a non-custodial cryptocurrency wallet. Private keys and recovery phrases are generated and retained exclusively on the user's device and are never collected or transmitted. However, optional cloud account features and regulatory compliance policies (such as transfer threshold gates) involve specific data collection and third-party service provider processing.

---

## 2. Data Types & Processing Classifications

### A. Personal Info

#### 1. Email Address

- **Collected**: Yes (when creating or using an optional Auvora account).
- **Purpose**: Account management, security authentication (verification tokens, password resets), fraud prevention.
- **Shared / Third-Party Processor**: Outbound transactional email delivered via Resend (SMTP).
- **Ephemeral processing?**: No (stored in Auvora backend database until account deletion).

#### 2. Name & Date of Birth

- **Collected**: Yes (only when the user initiates identity verification for high-value transfer policies).
- **Purpose**: Legal compliance, AML/CFT regulations, sanctions screening.
- **Storage**: Stored in Auvora backend database encrypted with AES-256 at rest.
- **Ephemeral processing?**: No.

#### 3. User IDs & Device Identifiers

- **Collected**: Yes (user UUID, coarse device fingerprint, client OS version).
- **Purpose**: Account management, device session security, abuse prevention.

---

### B. Financial Information & Identity Documents (KYC)

#### 1. Government-Issued Documents & Biometric Selfie Imagery

- **Processed**: Yes (when user undergoes identity verification).
- **Distinction (Provider-Hosted vs Auvora Storage)**:
  - **Third-Party Service Provider Processing**: Government documents (passport, driver's license, national ID) and facial biometric verification selfies are uploaded directly over TLS to Auvora's authorized verification partner (**Stripe Identity**) for verification and fraud detection on Auvora's behalf.
  - **Auvora-Controlled Storage**: Auvora does **not** store raw document images, passport scans, or facial biometric templates in its databases. Auvora stores only the external verification reference ID (`providerRef`), canonical verification status (`APPROVED`, `REJECTED`, `IN_REVIEW`), and compliance audit timestamps.
- **Purpose**: Regulatory compliance, AML/CFT verification, fraud prevention.
- **Shared?**: Yes, processed by authorized verification partner (Stripe Identity) as a data processor.

---

### C. Blockchain & Network Identifiers

#### 1. Public Blockchain Addresses

- **Processed**: Yes (when querying balances, transaction history, or interacting with dApps via WalletConnect).
- **Purpose**: App functionality.
- **Shared**: Sent via HTTPS to node infrastructure providers (e.g. Alchemy, QuickNode, TronGrid) to read blockchain state.
- **Secrets**: Private keys, mnemonics, and seed phrases are **never** transmitted or shared.

---

### D. Crash Logs & Diagnostics

- **Crash Reporting**: Sentry integration architecture is prepared. When enabled in production builds via compile-time/runtime configuration, diagnostic stack traces are collected for app stability.
- **Redaction**: All personal identifiers, credentials, private keys, and mnemonics are scrubbed before telemetry dispatch.

---

## 3. Security Practices

- **Data Encryption in Transit**: All data is encrypted in transit over secure protocols (TLS 1.3 / HTTPS).
- **Data Encryption at Rest**: Sensitive data fields (PII, tokens) are encrypted with AES-256 in the database.
- **Data Deletion Request Mechanism**: Users can request account and data deletion in-app or via support (privacy@auvorawallet.com).
  - _Immediate Deletion_: Unverified user accounts and session data are purged immediately.
  - _Statutory Legal Retention_: Under applicable AML/BSA regulations (e.g., 31 CFR § 1010.410), verified customer identity records must be retained for the statutory period (typically 5 years post-account closure) before permanent purge.
