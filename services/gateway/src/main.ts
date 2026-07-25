import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.schema';
import { createAuthProxyMiddleware } from './infrastructure/proxy/auth-proxy.middleware';
import { createWalletProxyMiddleware } from './infrastructure/proxy/wallet-proxy.middleware';
import { createSecurityHeadersMiddleware } from './infrastructure/security/security-headers.middleware';
import { shutdownOpenTelemetry, startOpenTelemetry } from './infrastructure/observability/otel';
import { buildAuthProxyOpenApiPaths } from './presentation/swagger/auth-proxy.openapi';
import { buildWalletProxyOpenApiPaths } from './presentation/swagger/wallet-proxy.openapi';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  await startOpenTelemetry(env);
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  for (const middleware of createSecurityHeadersMiddleware()) {
    app.use(middleware);
  }
  app.use(cookieParser());
  app.use(createAuthProxyMiddleware(env.AUTH_SERVICE_URL));
  app.use(createWalletProxyMiddleware(env.WALLET_SERVICE_URL));

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Auvora Gateway')
    .setDescription(
      'Auvora Wallet API gateway — public entry point for clients. ' +
        'Routes under `/api/v1/auth`, `/api/v1/me`, `/api/v1/admin/users`, and `/api/v1/admin/audit` are reverse-proxied to the auth service; ' +
        'routes under `/api/v1/wallets` and `/api/v1/admin/wallets` are proxied to the wallet service. ' +
        'See tagged proxy endpoints below. Each downstream service owns request validation and business logic. ' +
        'For full OpenAPI documents, refer to the auth and wallet services directly.',
    )
    .setVersion(env.SERVICE_VERSION)
    .addServer(`http://localhost:${env.PORT}`, 'Local gateway')
    .addTag('gateway-health', 'Gateway liveness and readiness probes')
    .addTag('auth-proxy', 'Authentication — proxied to auth service')
    .addTag('me-proxy', 'Current user — proxied to auth service')
    .addTag('admin-proxy', 'User administration — proxied to auth service')
    .addTag('wallet-proxy', 'Wallets — proxied to wallet service')
    .addTag('wallet-admin-proxy', 'Wallet administration — proxied to wallet service')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.paths = {
    ...buildAuthProxyOpenApiPaths(),
    ...buildWalletProxyOpenApiPaths(),
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
