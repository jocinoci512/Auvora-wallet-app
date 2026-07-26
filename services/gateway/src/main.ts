import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.schema';
import { createAuthProxyMiddleware } from './infrastructure/proxy/auth-proxy.middleware';
import { createWalletProxyMiddleware } from './infrastructure/proxy/wallet-proxy.middleware';
import { createBlockchainProxyMiddleware } from './infrastructure/proxy/blockchain-proxy.middleware';
import { createPaymentsProxyMiddleware } from './infrastructure/proxy/payments-proxy.middleware';
import { createComplianceProxyMiddleware } from './infrastructure/proxy/compliance-proxy.middleware';
import { createCustodyProxyMiddleware } from './infrastructure/proxy/custody-proxy.middleware';
import { createNotificationsProxyMiddleware } from './infrastructure/proxy/notifications-proxy.middleware';
import { createAnalyticsProxyMiddleware } from './infrastructure/proxy/analytics-proxy.middleware';
import { createAiProxyMiddleware } from './infrastructure/proxy/ai-proxy.middleware';
import { createObservabilityProxyMiddleware } from './infrastructure/proxy/observability-proxy.middleware';
import { createSecurityHeadersMiddleware } from './infrastructure/security/security-headers.middleware';
import { createInternalRouteDenyMiddleware } from './infrastructure/security/internal-route-deny.middleware';
import { createGatewayRateLimitMiddleware } from './infrastructure/security/rate-limit.middleware';
import { shutdownOpenTelemetry, startOpenTelemetry } from './infrastructure/observability/otel';
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
  app.enableShutdownHooks();

  app.enableCors({
    origin: env.CORS_ORIGINS,
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
  app.use(createAuthProxyMiddleware(env.AUTH_SERVICE_URL));
  app.use(createWalletProxyMiddleware(env.WALLET_SERVICE_URL));
  app.use(createBlockchainProxyMiddleware(env.BLOCKCHAIN_SERVICE_URL));
  app.use(createPaymentsProxyMiddleware(env.PAYMENTS_SERVICE_URL));
  app.use(createComplianceProxyMiddleware(env.COMPLIANCE_SERVICE_URL));
  app.use(createCustodyProxyMiddleware(env.CUSTODY_SERVICE_URL));
  app.use(createNotificationsProxyMiddleware(env.NOTIFICATIONS_SERVICE_URL));
  app.use(createAnalyticsProxyMiddleware(env.ANALYTICS_SERVICE_URL));
  app.use(createAiProxyMiddleware(env.AI_SERVICE_URL));
  app.use(createObservabilityProxyMiddleware(env.OBSERVABILITY_SERVICE_URL));

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
        'routes under `/api/v1/observability` and `/api/v1/admin/observability` are proxied to the observability service. ' +
        'See tagged proxy endpoints below. Each downstream service owns request validation and business logic. ' +
        'For full OpenAPI documents, refer to the auth, wallet, blockchain, payments, compliance, custody, notifications, analytics, AI, and observability services directly.',
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
    .addTag('notifications-admin-proxy', 'Notification administration — proxied to notifications service')
    .addTag('analytics-proxy', 'Analytics — proxied to analytics service')
    .addTag('analytics-admin-proxy', 'Analytics administration — proxied to analytics service')
    .addTag('ai-proxy', 'AI platform — proxied to AI service')
    .addTag('ai-admin-proxy', 'AI platform administration — proxied to AI service')
    .addTag('observability-proxy', 'Observability — proxied to observability service')
    .addTag('observability-admin-proxy', 'Observability administration — proxied to observability service')
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

  await app.listen(env.PORT);
  const logger = app.get(Logger);
  logger.log(`${env.SERVICE_NAME} listening on port ${env.PORT}`, 'Bootstrap');
  const shutdown = async (signal: string): Promise<void> => {
    logger.log(`Received ${signal}, shutting down`, 'Bootstrap');
    await app.close();
    await shutdownOpenTelemetry();
    process.exit(0);
  };
  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}
bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
