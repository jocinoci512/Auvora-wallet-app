# Analytics Data Flow

How platform modules publish into the Analytics pipeline and how data reaches dashboards and reports.

```mermaid
flowchart LR
  subgraph Producers
    A[Auth]
    W[Wallet]
    P[Payments]
    C[Compliance]
    CU[Custody]
    B[Blockchain]
    N[Notifications]
    AI[AI Platform]
  end

  subgraph AnalyticsGateway [Analytics Platform :3007]
    IN[Internal Event Ingest<br/>domain + metrics + correlationId]
    EVT[(AnalyticsEvent)]
    AGG[Aggregation Worker]
    MV[(MetricValue buckets)]
    KPI[KPI Evaluator]
    DASH[Dashboard Engine]
    RPT[Report / Schedule Engine]
    PERF[Performance metrics<br/>dashboard_load_ms / report_generate_ms / aggregation_duration_ms]
  end

  subgraph Consumers
    WEB[Web /analytics]
    ADM[Admin /analytics]
    GW[Gateway JWT + RBAC]
  end

  A & W & P & C & CU & B & N & AI -->|AnalyticsPublisherAdapter<br/>POST /internal/analytics/events| IN
  IN --> EVT
  EVT --> AGG
  AGG --> MV
  MV --> KPI
  MV --> DASH
  MV --> RPT
  DASH --> PERF
  RPT --> PERF
  AGG --> PERF

  WEB & ADM -->|/api/v1/analytics*<br/>/api/v1/admin/analytics*| GW --> DASH
  GW --> RPT
  GW --> KPI
```

## Contract

Every producer must send:

| Field | Required | Notes |
|-------|----------|-------|
| `eventType` | yes | e.g. `wallet.transfer.completed` |
| `domain` | yes | `AUTH`, `WALLET`, `PAYMENTS`, … |
| `payload` | yes | opaque JSON |
| `metrics` | optional | map of `MetricDefinition.code` → numeric delta |
| `sourceService` | recommended | defaults per adapter |
| `correlationId` | recommended | tracing |

## Scheduled reports

Failures stay `ACTIVE` with exponential backoff (`nextAttemptAt`) until `maxAttempts`, then `FAILED`. Success resets attempts and advances `nextRunAt`.
