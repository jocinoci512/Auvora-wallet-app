# Production Readiness — Observability & SRE (Operational Verification)

Last verified: **2026-07-26**

See also: [`docs/diagrams/runtime-service-dependency-graph.md`](./diagrams/runtime-service-dependency-graph.md), ADR [`0008`](./adr/0008-centralized-observability.md).

## Checklist

| Requirement                                        | Result   | Evidence                                                                                                                                                                                  |
| -------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Structured logs + correlation IDs on every service | **PASS** | nestjs-pino + `RequestContextMiddleware` on gateway/auth/wallet and all other Nest services (`x-correlation-id` / `x-request-id`)                                                         |
| Metrics emission (latency / error rate)            | **PASS** | `ObservabilityMetricsInterceptor` → `reportMetric(http_latency_ms, error_rate)` on auth/wallet/blockchain/payments/compliance/custody/notifications/AI/analytics                          |
| Distributed tracing across inter-service requests  | **PASS** | Per-service OTel bootstrap; gateway propagates `traceparent`/`tracestate`/`x-correlation-id` via `hardenProxyRequest`                                                                     |
| Health: app, DB, cache, workers                    | **PASS** | `/health` + `/ready` (db+redis); worker checks for analytics aggregation, notifications queue, observability alert worker; admin provider health endpoints remain for payments/blockchain |
| Configurable alert rules (enable/disable/modify)   | **PASS** | `PATCH /api/v1/admin/observability/alert-rules/:code` (`isEnabled`, thresholds, severity, …)                                                                                              |
| Incident ack / escalate / resolve                  | **PASS** | Admin incident APIs + unit tests covering create/ack/escalate/resolve                                                                                                                     |
| Latency, error rate, uptime vs SLOs                | **PASS** | `GET /api/v1/admin/observability/slos/compliance`                                                                                                                                         |
| Service dependency graph                           | **PASS** | Seeded edges + admin API + [`runtime-service-dependency-graph.md`](./diagrams/runtime-service-dependency-graph.md)                                                                        |

## Ports

- Observability: `http://localhost:3010` · Swagger `/api/docs`
- Gateway proxy: `/api/v1/observability*` · `/api/v1/admin/observability*`
