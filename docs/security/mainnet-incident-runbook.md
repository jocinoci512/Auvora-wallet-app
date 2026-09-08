# Auvora Mainnet Incident Response Runbook

> **OPERATIONAL SECURITY DIRECTIVE**:  
> In the event of any security anomaly, blockchain reorganization, provider failure, or broadcast ambiguity:  
> **THE PRIMARY RESPONSE IS TO PAUSE BROADCASTING.**  
> Under NO circumstances shall operators request user private keys, seed phrases, or attempt server-side custody.

---

## 1. Severity Levels & Escalation Triggers

| Severity          | Definition & Examples                                                                                                                                                                               | Required Response Time | Action Triggered                                                                                 |
| :---------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :--------------------- | :----------------------------------------------------------------------------------------------- |
| **P0 - Critical** | • Unexpected broadcast detected while `MAINNET_GLOBAL_ENABLED=false`<br>• Multiple conflicting transaction receipts (deep reorg)<br>• Suspected RPC provider compromise or address poisoning attack | Immediate (< 5 min)    | **Global Broadcast Kill Switch ENGAGED** (`MAINNET_GLOBAL_ENABLED=false`). Notify platform lead. |
| **P1 - High**     | • Single-chain RPC outage or desynchronization<br>• Abnormal fee estimate spikes exceeding safety caps<br>• Mobile client report of ambiguous broadcast timeout                                     | < 15 min               | **Engage Chain-Specific Pause** (`MAINNET_<CHAIN>_STATE=PAUSED`). Switch to backup vetted RPC.   |
| **P2 - Medium**   | • High rate of dropped/stale EVM nonces or expired Solana blockhashes<br>• Latency degradation on transaction confirmation indexing                                                                 | < 1 hour               | Adjust provider timeout limits; issue client app warning.                                        |

---

## 2. Specific Incident Playbooks

### Incident A: Ambiguous Broadcast Timeout (Provider Network Timeout)

**Scenario**: Customer device signed and dispatched a transaction; the RPC provider timed out before returning a transaction hash or receipt.

1. **Safety Rule**: **NEVER BLINDLY RESEND.** Blind resubmission risks double-spending or duplicate debits.
2. **Procedure**:
   - Compute the deterministic cryptographic transaction ID (`txHash` / Solana signature / Bitcoin txid) from the locally signed raw payload.
   - Query multiple independent explorer and node endpoints using read-only calls (`eth_getTransactionByHash`, `getTransactionStatus`, etc.).
   - If found in mempool or confirmed: Update database state to `BROADCAST_SUBMITTED` / `CONFIRMING`.
   - If proven completely absent across independent nodes after 300 seconds: Mark status as `DROPPED` and permit customer to rebuild and re-sign with fresh nonce / blockhash.

### Incident B: Abnormal Fee Spikes / Congestion Shock

**Scenario**: Extreme network congestion causes estimated network fees to exceed maximum safety thresholds.

1. **Safety Rule**: **NEVER SILENTLY CAP FEES.** Silently modifying gas limits or gas prices creates stuck transactions or underfunded executions.
2. **Procedure**:
   - The pre-broadcast validation engine automatically rejects the broadcast with `EXCESSIVE_FEE_ESTIMATE`.
   - Display clear customer notice showing current network congestion and the estimated fee.
   - If congestion poses an operational hazard, engage chain pause (`MAINNET_<CHAIN>_STATE=PAUSED`) until gas baseline stabilizes.

### Incident C: Blockchain Deep Reorganization (Reorg)

**Scenario**: A chain undergoes a block reorganization deeper than 2 blocks (e.g., PoW reorg or temporary validator split).

1. **Safety Rule**: **ON-CHAIN COMPLETION REQUIRES FINALITY EVIDENCE.**
2. **Procedure**:
   - Adhere strictly to the `MAINNET_CHAIN_CONFIRMATION_POLICIES`:
     - Ethereum: 12 standard confirmations (64 blocks for full checkpoint finality)
     - Polygon: 32 confirmations (Heimdall milestone finality)
     - BNB: 15 confirmations
     - Solana: `finalized` commitment (32+ root slot confirmations)
     - Bitcoin: 3 confirmations (6 for high value)
     - Tron: 19 solidified block confirmations
   - Transactions in `CONFIRMING` state that disappear during a reorg automatically revert to `CONFIRMING` until re-included or dropped.
   - Never mark a transaction `COMPLETED` merely upon initial inclusion in the mempool.

### Incident D: Compromised Backend Server / Database Breach

**Scenario**: An adversarial actor gains complete root access to the application servers or PostgreSQL database.

1. **Safety Analysis**:
   - Database stores public addresses, status records, and transaction metadata.
   - **Database contains ZERO private keys, seeds, or signing material.**
   - An attacker **cannot** sign transactions on behalf of users.
   - An attacker **cannot** broadcast unauthorized transactions because all valid transactions require customer hardware cryptographic signatures.
2. **Procedure**:
   - Engage `MAINNET_GLOBAL_ENABLED=false` via cloud secret manager / Railway dashboard.
   - Invalidate all active JWT tokens and sessions.
   - Rotate database credentials and internal API keys.
   - Restore database from uncompromised snapshot.

---

## 3. Post-Incident Review & Restoration

1. **Root-Cause Analysis (RCA)** document published within 48 hours of resolution.
2. **Regression Testing**: Execute automated defense-in-depth test suite (`mainnet-rollout.spec.ts`) before unpausing.
3. **Resumption**: Re-enable chain in `CANARY` mode first before returning to `ACTIVE`.
