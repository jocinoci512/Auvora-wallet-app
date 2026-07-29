# 02 — Authentication Architecture

## Principle

One **unified authentication surface** — many methods, one calm layout. Never a cluttered matrix of competing forms.

## Methods presented (UI)

| Method         | UX                       | Backend today                            |
| -------------- | ------------------------ | ---------------------------------------- |
| Email          | Email field + continue   | Session preference; gateway JWT separate |
| Google / Apple | Method selection         | Provider wiring future                   |
| Passkeys       | Recommended chip         | Future WebAuthn                          |
| Biometrics     | Face ID / Touch ID label | Prefs flag `biometricEnabled`            |
| PIN / Password | Local field              | `hashPin` → `security-prefs`             |
| Magic link     | Email path variant       | Future                                   |
| Skip           | Continue without linking | Allowed                                  |

## Session vs custody

- **Onboarding auth state** → `sessionStorage` via `setOnboardingAuth` (`user-prefs.ts`)
- **API authorization** → JWT in `localStorage` (`ACCESS_TOKEN_KEY`) via existing `AccessTokenPanel` / `createApiClient`
- **Wallet creation** → still calls `client.createWallet` — **unchanged contract**

## Design rules

1. Methods appear as a single selectable list (not 8 separate pages)
2. Conditional fields only for the active method
3. “Continue without account linking” always available
4. Errors are human: “Sign-in required…” not raw stack traces
5. Never ask for recovery phrase on the auth step

## Future wiring (non-breaking)

Passkeys, OAuth, and magic links plug into the same method IDs without redesigning the shell.
