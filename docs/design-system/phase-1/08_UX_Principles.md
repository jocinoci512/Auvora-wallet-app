# 08 — UX Principles

**Product:** Auvora Wallet  
**Applies to:** All user altitudes — Beginner · Intermediate · Professional

---

## North-star question

Before any screen ships:

> What does the user need **right now** — and what is the safest fastest path to it?

Everything else is secondary or removed.

---

## Mental model

Users think in **verbs and value**, not in product modules:

1. See what I have
2. Move value (send / receive / swap / bridge)
3. Connect & sign carefully
4. Review what happened
5. Adjust security & preferences

IA must mirror this model. Internal org charts (Compliance, Custody, Analytics) do not belong in the consumer primary nav.

---

## The three altitudes

### Beginner

| Need       | UX rule                                                       |
| ---------- | ------------------------------------------------------------- |
| Confidence | One recommended path; “Advanced” collapsed                    |
| Language   | No unexplained acronyms; network names spelled out            |
| Safety     | Fake-address warnings; paste detection; confirmation literacy |
| Onboarding | Create / Import / Hardware as three clear doors — not ten     |

### Intermediate

| Need    | UX rule                                                                       |
| ------- | ----------------------------------------------------------------------------- |
| Speed   | Recent recipients, favorite assets, sticky last network                       |
| Clarity | Fees visible before confirm; quotes don’t mysteriously flicker without reason |
| Control | Easy wallet switch; clear activity filters                                    |

### Professional

| Need    | UX rule                                                   |
| ------- | --------------------------------------------------------- |
| Density | Compact lists/tables; keyboard shortcuts on desktop       |
| Truth   | Exact fees, routes, nonces/simulations when available     |
| Scale   | Multi-account, address book, export, connected dapp audit |

**Adaptation mechanisms:** density toggle, “Show advanced”, progressive fields — not separate apps.

---

## Core flows (quality bar)

### Home

- Balance hero + three verbs (Send, Receive, Swap)
- Short activity
- Assets entry
- No twelve-card command center

### Send

1. Asset → 2. Recipient → 3. Amount → 4. Review → 5. Progress → 6. Done  
   Inline validation. Address book + paste. Fee before unlock/sign.

### Receive

Network-accurate QR + address + copy + warning about asset/network match. No clutter.

### Swap / Bridge / Stake

Quote → Review (ConfirmSheet) → Sign → Progress.  
Route details progressive. Failure states must propose a next step.

### Connect / Sign

Permission minimization. Origin clear. Message humanized when possible. Reject as easy as approve.

### Security

One Security Center. Backup, biometrics/PIN, sessions, connected apps — not split across `/security` and `/settings` forever.

---

## Feedback & trust loops

| Event        | UX                                         |
| ------------ | ------------------------------------------ |
| Pending      | Status + safe dismiss; keep context        |
| Success      | Short success state → Done                 |
| Failure      | Cause in plain language + Retry / Get help |
| Partial data | Show known truth; don’t blank the page     |

Never punish users with full-screen dead ends for a single failed widget.

---

## Navigation rules

1. **≤5** primary mobile destinations
2. Desktop sidebar groups by mental model, not by microservice
3. Deep links land with correct back stack
4. Settings is a hub, not a dumping ground for features that lacked a home
5. Lab / admin / design-system routes stay out of production consumer nav

---

## Content design

- Buttons are verbs with objects when money moves: “Send ETH”, not “Submit”
- Errors name the fix
- Empty states teach the next action
- Dates relative for recent (“2h ago”), absolute for archive

---

## Platform UX

| Platform                 | Priority patterns                                                    |
| ------------------------ | -------------------------------------------------------------------- |
| iOS/Android web-app feel | Bottom nav, sheets, large targets, safe areas                        |
| Desktop                  | Sidebar, tables, hover details, shortcuts (`/` search, `n` new send) |
| Tablet                   | Bottom or side adaptive; touch targets remain                        |

---

## Anti-patterns (explicitly banned going forward)

- Mega-menus of 20+ peer links
- Duplicate destinations for the same job
- Card grids as a substitute for hierarchy
- Icon-only primary money actions without labels on mobile
- Confirmations that hide fee or network
- Demo-looking empty charts that imply false activity

---

## UX quality checklist

- [ ] Job to be done is obvious in 3 seconds
- [ ] Primary action reachable in thumb zone (mobile)
- [ ] Irreversible path uses ConfirmSheet pattern
- [ ] Beginner can complete without opening docs
- [ ] Professional is not forced through tutorial chrome
- [ ] Error/empty/loading designed
- [ ] Nav depth ≤3 to core money verbs
