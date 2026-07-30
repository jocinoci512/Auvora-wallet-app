# 07 — Security Review

## Trust failures (critical)

| Issue                               | Why it hurts trust                               | Fix                     |
| ----------------------------------- | ------------------------------------------------ | ----------------------- |
| One-click “Mark verified”           | Users believe recovery is done without rehearsal | Removed; rehearsal only |
| Offline signing → Approved          | Teaches Approve always works                     | Preview-only error      |
| Score “devices reviewed” if count>0 | Inflates safety when demo devices exist          | Requires live data      |
| Revoke / logout-all without confirm | Accidental lockouts                              | Confirm dialogs         |

## Security Center honesty

Checklist now explains why each factor matters. Score factors for devices/dApps do not claim “reviewed” offline.

## Residual risk

- Biometrics preference is still preference-only (no WebAuthn yet)
- Demo alerts dismissible locally
- `window.confirm` is acceptable short-term; replace with Aether ConfirmSheet
- Dual reminder prefs (backup + security) should consolidate

## Gate

Major honesty issues resolved. Do not claim launch-complete until live biometrics + real alert pipeline exist.
