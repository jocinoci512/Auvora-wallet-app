# Price Alerts

**Service:** `@auvora/market-data-service` → `PriceAlertService`  
**Phase:** 19

## Conditions

| Condition               | Trigger                        |
| ----------------------- | ------------------------------ |
| `ABOVE_PRICE`           | Price ≥ threshold              |
| `BELOW_PRICE`           | Price ≤ threshold              |
| `PERCENTAGE_MOVEMENT`   | \|24h change %\| ≥ threshold   |
| `DAILY_MOVEMENT`        | Same as percentage movement    |
| `LARGE_VOLUME_MOVEMENT` | Volume spike ratio ≥ threshold |

## API

| Method | Path                                        |
| ------ | ------------------------------------------- |
| GET    | `/api/v1/market-data/alerts`                |
| POST   | `/api/v1/market-data/alerts`                |
| DELETE | `/api/v1/market-data/alerts/:alertId`       |
| POST   | `/api/v1/admin/market-data/alerts/evaluate` |

## Notifications

On trigger, publishes `market.alert.triggered` to the Notification Platform (`NOTIFICATIONS_SERVICE_URL` + `INTERNAL_API_KEY`) with category `MARKET`. Failures are logged, never thrown.

## Worker

Alert evaluation runs on `MARKET_DATA_ALERT_INTERVAL_MS` when `MARKET_DATA_WORKERS_ENABLED=true`. Cooldown prevents alert storms (`cooldownSeconds`, default 3600).
