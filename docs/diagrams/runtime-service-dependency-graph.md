# Runtime Service Dependency Graph

Operational dependency map for the Auvora Wallet platform (Phase 11 Observability). Edges mirror seeded `ObsServiceDependency` rows and gateway proxy routes. Source of truth at runtime: `GET /api/v1/admin/observability/dependencies`.

```mermaid
flowchart LR
  WEB[Web :3000]
  ADM[Admin :3001]
  GW[Gateway :4000]

  AUTH[Auth :4001]
  WALLET[Wallet :3002]
  BC[Blockchain :3003]
  PAY[Payments :3004]
  COMP[Compliance :3005]
  NOTIF[Notifications :3006]
  ANALYTICS[Analytics :3007]
  AI[AI :3008]
  CUSTODY[Custody :3009]
  OBS[Observability :3010]

  DB[(Postgres)]
  REDIS[(Redis)]

  WEB --> GW
  ADM --> GW

  GW --> AUTH
  GW --> WALLET
  GW --> BC
  GW --> PAY
  GW --> COMP
  GW --> CUSTODY
  GW --> NOTIF
  GW --> ANALYTICS
  GW --> AI
  GW --> OBS

  WALLET --> BC
  PAY --> WALLET
  PAY --> COMP
  BC --> CUSTODY
  AUTH -.-> NOTIF
  AUTH & WALLET & BC & PAY & COMP & CUSTODY & NOTIF & AI & ANALYTICS -->|health + http_latency_ms / error_rate| OBS

  AUTH & WALLET & BC & PAY & COMP & CUSTODY & NOTIF & ANALYTICS & AI & OBS --> DB
  AUTH & WALLET & BC & PAY & COMP & CUSTODY & NOTIF & ANALYTICS & AI & OBS --> REDIS
```

## Trace / correlation propagation

Gateway `hardenProxyRequest` forwards `traceparent`, `tracestate`, `x-correlation-id`, and `x-request-id` on every proxied hop. Each Nest service applies `RequestContextMiddleware` so structured logs and metric samples carry the same correlation ID.
