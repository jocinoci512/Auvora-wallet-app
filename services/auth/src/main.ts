import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { createCredentialedCorsOriginDelegate } from '@auvora/security';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.schema';
import { shutdownOpenTelemetry, startOpenTelemetry } from './infrastructure/observability/otel';

async function bootstrap(): Promise<void> {
  const env = loadEnv();
  await startOpenTelemetry(env);

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  // Trust one proxy hop (gateway / platform edge) for req.ip behind private networking.
  const authHttp = app.getHttpAdapter().getInstance() as {
    set?: (key: string, value: unknown) => void;
  };
  authHttp.set?.('trust proxy', 1);
  app.use(helmet());
  app.use(cookieParser(env.CSRF_SECRET));
  // Explicit allowlist (APP_PUBLIC_URL + CORS_ORIGINS). Never `*` / never reflect arbitrary Origin.
  app.enableCors({
    origin: createCredentialedCorsOriginDelegate(env.corsOrigins),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Auvora Auth Service')
      .setDescription('Authentication and identity API')
      .setVersion(env.SERVICE_VERSION)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();
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
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
