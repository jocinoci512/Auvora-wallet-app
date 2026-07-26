# AI Platform — System Interaction Diagram

How Wallet, Payments, Compliance, Notifications, and the AI Platform communicate through well-defined HTTP interfaces (no in-process cross-service imports).

## Sequence (domain events → AI)

```mermaid
sequenceDiagram
    autonumber
    participant Wallet as Wallet Service
    participant Payments as Payments Service
    participant Compliance as Compliance Service
    participant Notifications as Notifications Service
    participant Custody as Custody Service
    participant Blockchain as Blockchain Service
    participant AI as AI Platform :3008
    participant GW as Gateway :4000
    participant Web as Web / Admin

    Note over Wallet,Blockchain: Each producer holds AiPublisherAdapter.<br/>Fire-and-forget POST /api/v1/internal/ai/events<br/>with x-internal-api-key (never proxied by gateway).

    Wallet->>AI: wallet.transfer.completed
    Payments->>AI: payment.completed
    Compliance->>AI: compliance.kyc.approved
    Custody->>AI: custody.signing.completed
    Blockchain->>AI: blockchain.transaction.confirmed
    Notifications->>AI: notification.sent

    AI->>AI: AiEventLog + optional automation hooks<br/>(summarize / complete via internal API)

    Web->>GW: JWT + CSRF /api/v1/ai/* or /api/v1/admin/ai/*
    GW->>AI: Proxied user/admin routes only
    Note over GW: /api/v1/internal/** is denied at the gateway.
```

## Component interfaces

```mermaid
flowchart LR
  subgraph Producers
    W[Wallet]
    P[Payments]
    C[Compliance]
    N[Notifications]
    CU[Custody]
    B[Blockchain]
  end

  subgraph Edge
    WEB[Web App]
    ADM[Admin App]
    GW[API Gateway]
  end

  subgraph AIPlatform [AI Platform]
    API[User + Admin Controllers]
    INT[Internal Controllers]
    CHAT[Chat / Model Router]
    RAG[Knowledge / Vector Search]
    PROMPT[Prompt Manager]
    AUDIT[Audit + Usage + Cost]
    PROV[Provider Adapters]
  end

  W & P & C & N & CU & B -->|internal events / summarize| INT
  WEB & ADM -->|JWT RBAC| GW
  GW -->|/api/v1/ai /admin/ai| API
  API --> CHAT
  API --> RAG
  API --> PROMPT
  API --> AUDIT
  INT --> CHAT
  CHAT --> PROV
  CHAT --> RAG
  CHAT --> AUDIT
  PROMPT --> AUDIT
```

## Interface contracts

| From | To | Contract |
|------|----|----------|
| Web/Admin | Gateway → AI | REST `/api/v1/ai/*`, `/api/v1/admin/ai/*` + JWT + permission codes `ai:*` |
| Domain services | AI | REST `/api/v1/internal/ai/events\|complete\|summarize` + `x-internal-api-key` |
| AI | LLM vendors | Provider ports (OpenAI/Anthropic/Gemini/Azure/Local/Simulator) via env credentials |
| AI | Postgres/Redis | Prisma models + Redis response cache |

No service imports another service's Nest modules or domain packages across boundaries.
