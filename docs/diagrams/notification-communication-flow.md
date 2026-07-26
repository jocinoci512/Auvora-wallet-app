# Notification Communication Flow

This document illustrates how domain services (Auth, Wallet, Blockchain, Payments,
Compliance, Custody) publish events into the Notification Platform, and how the
platform fans those events out to channels, webhooks, the delivery queue, and the
dead-letter queue (DLQ).

## Cross-service event flow (sequence)

```mermaid
sequenceDiagram
    autonumber
    participant Auth as Auth Service
    participant Wallet as Wallet Service
    participant Payments as Payments Service
    participant Compliance as Compliance Service
    participant Custody as Custody Service
    participant Blockchain as Blockchain Service
    participant GW as Gateway
    participant Notif as Notification Platform (Internal API)
    participant Queue as Delivery Queue / Worker
    participant Chan as Channel Providers (Email/SMS/Push/Slack/Teams/In-App)
    participant WH as Webhook Dispatcher
    participant DLQ as Dead Letter Queue

    Note over Auth,Blockchain: Each service holds a thin NotificationsPublisherAdapter.<br/>Fire-and-forget: publish failures are logged, never block the business flow.

    Auth->>Notif: POST /api/v1/internal/send (mail via NotificationsMailAdapter)<br/>correlationId, sourceEventType=auth.mail.send
    Wallet->>Notif: POST /api/v1/internal/notifications/events<br/>eventType=wallet.transfer.completed
    Payments->>Notif: POST /api/v1/internal/notifications/events<br/>eventType=payment.completed
    Compliance->>Notif: POST /api/v1/internal/notifications/events<br/>eventType=compliance.kyc.approved
    Custody->>Notif: POST /api/v1/internal/notifications/events<br/>eventType=custody.signing.completed
    Blockchain->>Notif: POST /api/v1/internal/notifications/events<br/>eventType=blockchain.transaction.confirmed

    Note over GW,Notif: External/browser clients reach the same API via the Gateway proxy (auth required).
    GW->>Notif: Proxied REST calls (dashboard, preferences, webhooks, inbox)

    Notif->>Notif: NotificationService.send()<br/>correlationId = input.correlationId ?? randomUUID()<br/>store sourceEventType/sourceEventId
    Notif->>Queue: Enqueue NotificationMessage (per channel)

    Queue->>Notif: ChannelProviderRegistry.resolve(channel)
    Notif->>Notif: 1) env kill-switch check (NOTIFICATIONS_CHANNEL_*_ENABLED)<br/>2) DB lookup (notification_channel_providers, isEnabled, priority)
    alt channel enabled (env + DB)
        Notif->>Chan: Deliver via Simulator / HttpChannelProvider / LocalInAppProvider
        Chan-->>Queue: success/failure result
    else channel disabled or unavailable
        Notif->>Notif: throw ProviderUnavailableError
    end

    alt delivery failed (transient)
        Queue->>Queue: retry with backoff (attempt++, nextAttemptAt)
        Queue->>DLQ: move to DLQ after max attempts
    end

    Notif->>WH: On matching event, fan out to registered WebhookEndpoint(s)
    WH->>WH: buildEnvelope({apiVersion, eventType, deliveredAt, data})<br/>sign(HMAC) + POST
    alt webhook delivery failed
        WH->>WH: mark RETRYING, set nextAttemptAt
        Note over WH: WebhookRetryWorkerService polls processNextRetry(workerId)<br/>on NOTIFICATIONS_QUEUE_POLL_INTERVAL_MS
        WH->>WH: retry dispatch when nextAttemptAt <= now
    end
```

## High-level component flow

```mermaid
flowchart LR
    subgraph Producers
        A[Auth]
        W[Wallet]
        P[Payments]
        C[Compliance]
        CU[Custody]
        B[Blockchain]
    end

    GW[Gateway / Internal API]

    subgraph NotifPlatform [Notification Platform]
        direction TB
        API[Internal + Admin API]
        NS[NotificationService<br/>correlationId + sourceEvent linkage]
        PREF[PreferenceService<br/>quiet hours, toggles, frequency limits]
        REG[ChannelProviderRegistry<br/>env kill-switch + DB isEnabled]
        Q[Queue Worker<br/>retry + backoff]
        DLQ[(Dead Letter Queue)]
        WHS[WebhookService<br/>versioned envelope + HMAC]
        WHRW[WebhookRetryWorker]
    end

    subgraph Channels
        EMAIL[Email]
        SMS[SMS]
        PUSH[Push]
        SLACK[Slack]
        TEAMS[Teams]
        INAPP[In-App / Browser]
    end

    WHURL[(Registered Webhook Endpoints)]

    A -->|events + mail| GW
    W --> GW
    P --> GW
    C --> GW
    CU --> GW
    B --> GW
    GW --> API
    API --> NS
    NS --> PREF
    PREF -->|allowed| Q
    PREF -->|suppressed| NS
    Q --> REG
    REG --> EMAIL
    REG --> SMS
    REG --> PUSH
    REG --> SLACK
    REG --> TEAMS
    REG --> INAPP
    Q -.retry exhausted.-> DLQ
    NS --> WHS
    WHS --> WHURL
    WHS -.failed.-> WHRW
    WHRW -.retries.-> WHS
```

## Key production-readiness properties

- **Channel enable/disable without code changes**: an operator can flip
  `notification_channel_providers.isEnabled` via the admin API
  (`POST /providers/:id/enable|disable`), or hard-disable a channel with an
  `NOTIFICATIONS_CHANNEL_*_ENABLED=false` env flag (checked first).
- **Traceability**: every `NotificationMessage` has a `correlationId` (generated if not
  supplied by the caller) and optional `sourceEventType`/`sourceEventId`, indexed for
  fast lookup and cross-service tracing.
- **Resilience**: notification delivery and webhook delivery both have independent
  retry-with-backoff loops and DLQ semantics; a downstream outage never blocks the
  originating business transaction because publishers are fire-and-forget.
- **Webhook versioning**: payloads are wrapped in a versioned envelope
  (`{apiVersion, eventType, deliveredAt, data}`) before signing, so consumers can
  evolve independently of the platform's internal payload shape.
