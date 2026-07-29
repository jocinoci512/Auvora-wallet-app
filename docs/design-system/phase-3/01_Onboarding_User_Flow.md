# 01 — Onboarding User Flow

**Product:** Auvora Wallet  
**Phase:** 3  
**Design language:** Aether

---

## North star

Reduce anxiety. Every screen answers: _What do I do next, and am I safe?_

---

## Canonical journey (Create)

```
Welcome (/wallets/onboarding)
  → Choose Create | Import
  → Authentication (unified methods)
  → Wallet setup (name + network)
  → Creating (loading + createWallet API)
  → Recovery education
  → Phrase reveal + acknowledgements
  → Word verification
  → Security Center (optional)
  → Personal preferences (optional)
  → Success
  → Enter Wallet (/dashboard or /wallets/:id)
```

## Import branch

```
Welcome → Choose Import
  → Method (phrase | private key | hardware | WalletConnect)
  → Optional auth link
  → Input + validation
  → Verify (phrase path)
  → Network
  → Security (optional)
  → Success → Dashboard
```

## Progressive disclosure

| Altitude     | Default               | Advanced (collapsed)                |
| ------------ | --------------------- | ----------------------------------- |
| Beginner     | Create / Import only  | Restore, hardware, watch, rehearsal |
| Intermediate | Same + method choices | —                                   |
| Professional | Full method set       | Watch-only, hardware pairing        |

## Route map (preserved)

| Route                 | Role                           |
| --------------------- | ------------------------------ |
| `/wallets/onboarding` | Welcome + choose               |
| `/wallets/create`     | Full create journey            |
| `/wallets/import`     | Full import journey            |
| `/wallets/restore`    | Restore (legacy path retained) |
| `/wallets/hardware`   | Hardware (retained)            |
| `/wallets/watch`      | Watch-only (retained)          |
| `/wallets/recovery`   | Rehearsal (retained)           |
| `/wallets/new`        | Redirect → create              |

## Anxiety reducers

1. Reassure copy on every shell
2. Irreversible actions never silent
3. Skip paths for optional security/prefs
4. Plain language — no mempool jargon
5. Success celebrates calmly, then offers next steps
