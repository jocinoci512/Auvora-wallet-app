# Auvora Controlled Mainnet Activation Runbook

> **CRITICAL NOTICE**:  
> **THIS DOCUMENT IS A FUTURE OPERATIONAL PROCEDURE ONLY.**  
> **MAINNET BROADCAST IS STRICTLY PROHIBITED DURING THIS PHASE.**  
> Current status: **MAINNET OFF** (`liveBroadcastEnabled = false`, `BLOCKCHAIN_LIVE_BROADCAST = false`, `MAINNET_GLOBAL_ENABLED = false`).  
> Any future activation requires explicit, written, cryptographically signed authorization by the platform owner/signers.  
> No private keys, mnemonics, or production secrets are ever contained in this repository or runbook.

---

## 1. Governance & Authorization Principles

1. **Self-Custody Invariant**:  
   Private keys originate, remain, and sign exclusively within the customer device's secure hardware enclave (Android Keystore / iOS Secure Enclave). The backend, admin portal, databases, and RPC relays **never** access private keys or recovery phrases.
2. **One-Chain-at-a-Time Rollout**:  
   Mainnet shall **never** be activated for all six chains simultaneously. Each chain is isolated behind independent controls.
3. **No Blind Admin Activation**:  
   The Admin dashboard is strictly read-only regarding network state and can never trigger live broadcasts or sign on behalf of users.
4. **Defense-in-Depth Activation Gates**:  
   A broadcast is only permitted when:
   - `NODE_ENV === 'production'`
   - `MAINNET_GLOBAL_ENABLED === true`
   - `MAINNET_<CHAIN>_STATE === 'ACTIVE' | 'CANARY'`
   - `MAINNET_EMERGENCY_PAUSE === false`
   - RPC URL and Chain ID cryptographically match the verified mainnet specification
   - Local hardware signature is present and cryptographically intact
   - Transaction passes AML/KYC policies ($5,000 threshold for KYC, $10,000 threshold for Admin review)
   - Preflight node simulation (`eth_call` / simulate) succeeds with zero VM execution reverts
   - Nonce/UTXO freshness is verified and duplicate fingerprint check passes

---

## 2. Recommended Technical Chain Rollout Sequence

Based on infrastructure maturity, RPC provider depth, finality determinism, and tooling battle-testing:

| Phase       | Chain               | Target Rollout State | Primary Native Asset | Rationale & Safety Gates                                                                    |
| :---------- | :------------------ | :------------------- | :------------------- | :------------------------------------------------------------------------------------------ |
| **Phase 1** | **Ethereum**        | Canary → Active      | ETH                  | EIP-1559 standard, highest liquidity, battle-tested Gasper PoS finality (12–64 blocks).     |
| **Phase 2** | **Polygon PoS**     | Canary → Active      | POL                  | EVM-compatible, fast Heimdall milestone checkpoints (32 blocks), low fee volatility impact. |
| **Phase 3** | **BNB Smart Chain** | Canary → Active      | BNB                  | Fast finality BFT (15 blocks), standard EVM tooling, strict gas price floors.               |
| **Phase 4** | **Solana**          | Canary → Active      | SOL                  | High throughput, requires strict recent-blockhash freshness checks and priority fee bounds. |
| **Phase 5** | **Bitcoin**         | Canary → Active      | BTC                  | UTXO Nakamoto consensus, SegWit BIP-84, RBF policy, 3-block confirmation requirement.       |
| **Phase 6** | **Tron**            | Canary → Active      | TRX                  | Bandwidth/Energy fee model, Super Representative solidified block receipts (19 blocks).     |

---

## 3. Pre-Activation Checklist (Per Chain)

Before transitioning any chain from `OFF` to `READY` or `CANARY`:

- [ ] **Code Freeze & Hash Verification**: Git release commit signed and verified matching HEAD on `origin/main`.
- [ ] **Database & System Backups**: Live PostgreSQL backup snapshot completed and integrity verified.
- [ ] **Provider RPC Probing**: Alchemy / primary RPC provider latency < 150ms, latest block height synchronized with public chain tips.
- [ ] **Address Checksum Verification**: Test vectors confirmed across all supported script types (EVM EIP-55, Solana Base58, Bitcoin SegWit bech32, Tron Base58Check).
- [ ] **Fee Schedule Limits**: Maximum safety fee bounds configured to prevent gas spike drains.
- [ ] **Policy & Compliance Readiness**: KYC Tier 1 verification queues clear; administrative transaction review dashboard operational.
- [ ] **Legal & Retention Confirmation**: Public launch retention policy sign-off recorded.

---

## 4. Controlled Canary Deployment Protocol

For each chain activation:

1. **Canary Cohort Selection**:
   - Limit access to internal owner test devices and designated allowlisted test accounts.
   - Restrict maximum transaction debit cap (e.g., maximum $50 equivalent) during Canary observation.
2. **Configuration Change Procedure**:
   - Environment update executed strictly via protected Railway / cloud secret management.
   - Example configuration for Phase 1 (Ethereum Canary):
     ```env
     MAINNET_GLOBAL_ENABLED=true
     BLOCKCHAIN_LIVE_BROADCAST=true
     MAINNET_ETHEREUM_STATE=CANARY
     MAINNET_BNB_STATE=OFF
     MAINNET_POLYGON_STATE=OFF
     MAINNET_SOLANA_STATE=OFF
     MAINNET_BITCOIN_STATE=OFF
     MAINNET_TRON_STATE=OFF
     MAINNET_EMERGENCY_PAUSE=false
     ```
3. **Observation Window**:
   - Monitor canary transactions for a minimum 48-hour continuous window.
   - Verify on-chain receipts, event log indexing, push notification delivery, and balance reconciliations.
4. **Promotion to Active**:
   - Update `MAINNET_ETHEREUM_STATE=ACTIVE` only after 100% successful canary transactions without fee or reorg anomalies.

---

## 5. Rollback & Emergency Stop Protocol

If any anomaly occurs (fee deviation, provider desynchronization, duplicate submission warning):

1. **Immediate Global Broadcast Freeze**:
   - Engage emergency pause via runtime environment:
     ```env
     MAINNET_EMERGENCY_PAUSE=true
     ```
   - OR immediately flip global kill switch:
     ```env
     MAINNET_GLOBAL_ENABLED=false
     ```
2. **Single-Chain Circuit Breaker**:
   - If an issue is isolated to a specific chain (e.g., Solana RPC fork or congestion):
     ```env
     MAINNET_SOLANA_STATE=PAUSED
     ```
   - All other chains proceed normally without degradation.
3. **Data Safety**:
   - Freezing or pausing broadcasts **never** mutates user private keys, deletes transaction history, or prevents read-only balance lookups.

---

## 6. Audit & Accountability

Every transition between rollout states must be logged with:

- **Timestamp** (UTC ISO-8601)
- **Target Network** (`ETHEREUM`, `BNB_SMART_CHAIN`, `POLYGON`, `SOLANA`, `BITCOIN`, `TRON`, or `GLOBAL`)
- **Previous State & New State**
- **Authorized Deployer Identity**
- **Release Git SHA**
- **Justification & Change Ticket Reference**
- **Cryptographic exclusion**: Zero secrets, keys, or seeds in audit logs.
