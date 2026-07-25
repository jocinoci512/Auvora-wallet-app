import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
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
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});