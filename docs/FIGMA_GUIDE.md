# Figma Guide — Auvora Design System

## Source of truth

**Code is the source of truth** (`packages/ui` tokens + components). Figma is a publish target for design review and Code Connect — not the upstream for implementation.

## Sync status

| Item                    | Status                                                                                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Figma Sync Status       | **Partial** — file + light color variables published; dark mode vars blocked by Starter (1 mode); component frames + Code Connect still pending |
| Authenticated MCP user  | _(connect your own Figma account / MCP session)_                                                                                                |
| Master library file URL | _(set after publishing your design-system file)_                                                                                                |
| Wallet Experience page  | Added for Task 029 (onboarding / send / receive / activity / security contract)                                                                 |
| Trading Experience page | Added for Task 030 (swap / bridge / buy / sell / staking contract)                                                                              |
| NFT Experience frame    | Task 031 frame on Trading Experience page (Starter plan max 3 pages)                                                                            |
| Web3 Hub frame          | Task 032 frame on Trading Experience page (hub / browser / permissions / signing)                                                               |
| Security Center frame   | Task 033 — add frame on Trading Experience when Figma MCP Editor available (Starter max 3 pages)                                                |
| Mobile / offline polish | Task 034 — code-owned responsive + offline + a11y; no new Figma pages (Starter limit)                                                           |
| RC1 release engineering | Task 035 — no new UX frames; security/ops docs only                                                                                             |

> **Canonical file:** publish one design-system file for your org, then paste its URL above. Prefer a single library file; archive duplicates.

### Done in Figma

- Created file **Auvora Design System**
- Collection `Auvora Color` with Light mode variables: primary, background, surface, text, border, success, warning, error, info
- Foundations page swatch frame documenting light tokens
- `Button` component set with Primary / Secondary / Ghost / Danger variants

### Remaining / blockers

- Starter plan rejects a second variable mode (`Limited to 1 modes only`) — upgrade plan or seat for Light/Dark modes in Figma
- Component variant sets + Code Connect not yet published
- Full library build needs Editor-capable workflow + plan that supports multiple modes

## Remediation steps

1. Upgrade Figma plan/seat so collections can have Light + Dark modes and component editing is unrestricted.
2. Confirm MCP `whoami` shows Editor (or higher) on a plan with multi-mode variables.
3. Complete the sync workflow below (remaining components → Code Connect).
4. Flip Sync Status to **Complete** when dark modes + core frames + Code Connect are published.

## Sync workflow (when Editor is available)

1. Load skills: `figma-generate-library` + `figma-use` (+ `figma-code-connect` for mappings).
2. `create_new_file` → **Auvora Design System** (`editorType: design`).
3. Publish variables from `packages/ui/src/tokens.ts` / `styles.css`:
   - Color (light + dark modes)
   - Spacing, radius, typography
4. Build core component frames: Button, Input, Select, Dialog, Tabs, Switch, Alert, Card, Table.
5. Code Connect map key primitives to `@auvora/ui` exports.
6. Document the file URL here.

## Code Connect targets (priority)

- `Button`, `Input`, `SelectField`, `Dialog`, `Tabs`, `Switch`, `Alert`, `Card`

## Local verification without Figma

Use the live gallery:

- http://localhost:3000/design-system
- http://localhost:3001/design-system
