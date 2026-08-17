import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { createCredentialedCorsOriginDelegate } from '@auvora/security';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.schema';
import { createUnifiedGatewayProxyMiddleware } from './infrastructure/proxy/unified-gateway-proxy.middleware';
import { createRealtimeProxyMiddleware } from './infrastructure/proxy/realtime-proxy.middleware';
import { createAdminLiveSessionMiddleware } from './infrastructure/proxy/admin-live-session.middleware';
import { createNftGoneMiddleware } from './infrastructure/proxy/nft-gone.middleware';
import { createSecurityHeadersMiddleware } from './infrastructure/security/security-headers.middleware';
import { createInternalRouteDenyMiddleware } from './infrastructure/security/internal-route-deny.middleware';
import { createGatewayRateLimitMiddleware } from './infrastructure/security/rate-limit.middleware';
import { startOpenTelemetry } from './infrastructure/observability/otel';
import { applyDatabasePoolEnv } from '@auvora/database';
import { buildAuthProxyOpenApiPaths } from './presentation/swagger/auth-proxy.openapi';
import { buildWalletProxyOpenApiPaths } from './presentation/swagger/wallet-proxy.openapi';
import { buildBlockchainProxyOpenApiPaths } from './presentation/swagger/blockchain-proxy.openapi';
import { buildPaymentsProxyOpenApiPaths } from './presentation/swagger/payments-proxy.openapi';
import { buildComplianceProxyOpenApiPaths } from './presentation/swagger/compliance-proxy.openapi';
import { buildCustodyProxyOpenApiPaths } from './presentation/swagger/custody-proxy.openapi';
import { buildNotificationsProxyOpenApiPaths } from './presentation/swagger/notifications-proxy.openapi';
import { buildAnalyticsProxyOpenApiPaths } from './presentation/swagger/analytics-proxy.openapi';
import { buildAiProxyOpenApiPaths } from './presentation/swagger/ai-proxy.openapi';
import { buildObservabilityProxyOpenApiPaths } from './presentation/swagger/observability-proxy.openapi';

async function bootstrap(): Promise<void> {
  applyDatabasePoolEnv(process.env, { connectionLimit: 10, poolTimeout: 10 });
  const env = loadEnv();
  await startOpenTelemetry(env);
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Nest owns SIGINT/SIGTERM → app.close(). Do not also register process.on handlers
  // (that double-closes and races with OpenTelemetryLifecycle).
  app.enableShutdownHooks();
  // Railway / managed reverse proxies terminate TLS and forward X-Forwarded-*.
  // Trust one hop so Express derives client IP / proto correctly without open proxy risk.
  const gatewayHttp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  gatewayHttp.set?.('trust proxy', 1);

  // Explicit allowlist only — never `*` and never reflect arbitrary Origin (credentials: true).
  app.enableCors({
    origin: createCredentialedCorsOriginDelegate(env.CORS_ORIGINS),
    credentials: true,
  });

  for (const middleware of createSecurityHeadersMiddleware({
    enableHsts: env.NODE_ENV === 'production',
  })) {
    app.use(middleware);
  }
  app.use(createInternalRouteDenyMiddleware());
  app.use(
    createGatewayRateLimitMiddleware({
      limit: env.GATEWAY_RATE_LIMIT_MAX,
      windowSeconds: env.GATEWAY_RATE_LIMIT_WINDOW_SECONDS,
    }),
  );
  app.use(cookieParser());
  // NFT gone (410) before the unified reverse proxy.
  app.use(createNftGoneMiddleware());
  // Admin realtime SSE proxy BEFORE the unified proxy: it needs an untimed,
  // unbuffered long-lived stream that the timed unified proxy cannot provide.
  app.use(createRealtimeProxyMiddleware(env.AUTH_SERVICE_URL));
  app.use(createAdminLiveSessionMiddleware(env.AUTH_SERVICE_URL));
  // ONE http-proxy-middleware instance for all upstreams — avoids N server 'close' listeners.
  app.use(createUnifiedGatewayProxyMiddleware(env));

  if (env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Auvora Gateway')
      .setDescription(
        'Auvora Wallet API gateway — public entry point for clients. ' +
          'Routes under `/api/v1/auth`, `/api/v1/me`, `/api/v1/admin/users`, and `/api/v1/admin/audit` are reverse-proxied to the auth service; ' +
          'routes under `/api/v1/wallets` and `/api/v1/admin/wallets` are proxied to the wallet service; ' +
          'routes under `/api/v1/blockchain` and `/api/v1/admin/blockchain` are proxied to the blockchain service; ' +
          'routes under `/api/v1/payments` and `/api/v1/admin/payments` are proxied to the payments service; ' +
          'routes under `/api/v1/compliance` and `/api/v1/admin/compliance` are proxied to the compliance service; ' +
          'routes under `/api/v1/custody` and `/api/v1/admin/custody` are proxied to the custody service; ' +
          'routes under `/api/v1/notifications` and `/api/v1/admin/notifications` are proxied to the notifications service; ' +
          'routes under `/api/v1/analytics` and `/api/v1/admin/analytics` are proxied to the analytics service; ' +
          'routes under `/api/v1/ai` and `/api/v1/admin/ai` are proxied to the AI service; ' +
          'routes under `/api/v1/observability` and `/api/v1/admin/observability` are proxied to the observability service; ' +
          'routes under `/api/v1/market-data` and `/api/v1/admin/market-data` are proxied to the market-data service; ' +
          'routes under `/api/v1/swaps` and `/api/v1/admin/swaps` are proxied to the swap service; ' +
          'routes under `/api/v1/nfts` return 410 Gone (NFT product line removed); ' +
          'routes under `/api/v1/staking` and `/api/v1/admin/staking` are proxied to the staking service; ' +
          'routes under `/api/v1/connections` and `/api/v1/admin/connections` are proxied to the connections service. ' +
          'See tagged proxy endpoints below. Each downstream service owns request validation and business logic. ' +
          'For full OpenAPI documents, refer to the auth, wallet, blockchain, payments, compliance, custody, notifications, analytics, AI, observability, market-data, swap, staking, and connections services directly.',
      )
      .setVersion(env.SERVICE_VERSION)
      .addServer(`http://localhost:${env.PORT}`, 'Local gateway')
      .addTag('gateway-health', 'Gateway liveness and readiness probes')
      .addTag('auth-proxy', 'Authentication — proxied to auth service')
      .addTag('me-proxy', 'Current user — proxied to auth service')
      .addTag('admin-proxy', 'User administration — proxied to auth service')
      .addTag('wallet-proxy', 'Wallets — proxied to wallet service')
      .addTag('wallet-admin-proxy', 'Wallet administration — proxied to wallet service')
      .addTag('blockchain-proxy', 'Blockchain — proxied to blockchain service')
      .addTag('blockchain-admin-proxy', 'Blockchain administration — proxied to blockchain service')
      .addTag('payments-proxy', 'Payments — proxied to payments service')
      .addTag('payments-admin-proxy', 'Payment administration — proxied to payments service')
      .addTag('compliance-proxy', 'Compliance — proxied to compliance service')
      .addTag('compliance-admin-proxy', 'Compliance administration — proxied to compliance service')
      .addTag('custody-proxy', 'Custody — proxied to custody service')
      .addTag('custody-admin-proxy', 'Custody administration — proxied to custody service')
      .addTag('notifications-proxy', 'Notifications — proxied to notifications service')
      .addTag(
        'notifications-admin-proxy',
        'Notification administration — proxied to notifications service',
      )
      .addTag('analytics-proxy', 'Analytics — proxied to analytics service')
      .addTag('analytics-admin-proxy', 'Analytics administration — proxied to analytics service')
      .addTag('ai-proxy', 'AI platform — proxied to AI service')
      .addTag('ai-admin-proxy', 'AI platform administration — proxied to AI service')
      .addTag('observability-proxy', 'Observability — proxied to observability service')
      .addTag(
        'observability-admin-proxy',
        'Observability administration — proxied to observability service',
      )
      .addTag('market-data-proxy', 'Market data — proxied to market-data service')
      .addTag(
        'market-data-admin-proxy',
        'Market data administration — proxied to market-data service',
      )
      .addTag('swap-proxy', 'Swaps — proxied to swap service')
      .addTag('swap-admin-proxy', 'Swap administration — proxied to swap service')
      .addTag('staking-proxy', 'Staking — proxied to staking service')
      .addTag('staking-admin-proxy', 'Staking administration — proxied to staking service')
      .addTag('connections-proxy', 'Connections — proxied to connections service')
      .addTag(
        'connections-admin-proxy',
        'Connections administration — proxied to connections service',
      )
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    document.paths = {
      ...buildAuthProxyOpenApiPaths(),
      ...buildWalletProxyOpenApiPaths(),
      ...buildBlockchainProxyOpenApiPaths(),
      ...buildPaymentsProxyOpenApiPaths(),
      ...buildComplianceProxyOpenApiPaths(),
      ...buildCustodyProxyOpenApiPaths(),
      ...buildNotificationsProxyOpenApiPaths(),
      ...buildAnalyticsProxyOpenApiPaths(),
      ...buildAiProxyOpenApiPaths(),
      ...buildObservabilityProxyOpenApiPaths(),
      ...document.paths,
    };
    SwaggerModule.setup('api/docs', app, document);
  }

  // Leave host unset unless HOST is provided — Nest/Node dual-stack bind keeps
  // Railway private IPv6 mesh working. Do not hardcode 0.0.0.0 (IPv4-only).
  if (env.HOST) {
    await app.listen(env.PORT, env.HOST);
  } else {
    await app.listen(env.PORT);
  }
  const logger = app.get(Logger);
  const bind = env.HOST ? `${env.HOST}:${env.PORT}` : `*:${env.PORT}`;
  logger.log(`${env.SERVICE_NAME} listening on ${bind}`, 'Bootstrap');
  logger.log(
    `Upstreams auth=${env.AUTH_SERVICE_URL} wallet=${env.WALLET_SERVICE_URL} blockchain=${env.BLOCKCHAIN_SERVICE_URL} market-data=${env.MARKET_DATA_SERVICE_URL} connections=${env.CONNECTIONS_SERVICE_URL}`,
    'Bootstrap',
  );
}
bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
