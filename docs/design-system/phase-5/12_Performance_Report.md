# 12 — Performance Report

## Targets

Lighthouse 95+ on warm transaction routes · 60 FPS motion · minimal shared CSS · no heavy animation libs.

## Techniques

- Single `core-experience.css` for all Phase 5 money verbs + Activity
- CSS-first motion; reduced-motion gated
- Quote polling only on Swap / Bridge form screens
- QR library lazy-imported inside `QrPanel`
- Charts confined to Staking
- `useDeferredValue` on Activity search

## Bundle notes

TransactionShell is lightweight. Activity no longer pulls separate wallet-experience CSS for that route.

## Follow-ups

Route-level split if trading pages grow; measure LCP with real token icons; CI Lighthouse on `/send` + `/swap`.

## Gate: Performance Review — Pass (targets; measure in CI next)
