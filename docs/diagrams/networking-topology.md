# Networking Topology

```mermaid
flowchart TB
  Users[Clients / Admins]
  DNS[DNS / TLS certs]
  LB[Cloud Load Balancer]
  ING[Ingress Controller<br/>TLS termination + rate limits]

  subgraph NS[Namespace auvora-*]
    WEB[web :3000]
    ADM[admin :3001]
    GW[gateway :4000]

    subgraph Internal[ClusterIP services — NetworkPolicy gated]
      AUTH[auth :4001]
      WAL[wallet :3002]
      BC[blockchain :3003]
      PAY[payments :3004]
      CMP[compliance :3005]
      NTF[notifications :3006]
      AN[analytics :3007]
      AI[ai :3008]
      CUS[custody :3009]
      OBS[observability :3010]
    end

    PG[(postgres)]
    RD[(redis)]
  end

  Users --> DNS --> LB --> ING
  ING -->|/| WEB
  ING -->|/admin| ADM
  ING -->|/api| GW
  GW --> AUTH & WAL & BC & PAY & CMP & NTF & AN & AI & CUS & OBS
  Internal --> PG
  Internal --> RD
```

## Segmentation

- **Edge:** only `gateway`, `web`, `admin` accept Ingress traffic.
- **East-west:** domain services allow ingress from `gateway` pods only (NetworkPolicy).
- **Data plane:** Postgres/Redis are ClusterIP; no public exposure.
- **Rate limiting:** Ingress annotations (`limit-rps`, `limit-connections`).
- **TLS:** terminated at Ingress; optional mTLS via mesh in future without chart rewrite.
