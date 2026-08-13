import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { loadEnv } from './config/env.schema';
import { loadRootEnvFile } from './config/load-root-env';
import { startOpenTelemetry } from './infrastructure/observability/otel';

async function bootstrap(): Promise<void> {
  loadRootEnvFile(process.cwd());
  const env = loadEnv();
  await startOpenTelemetry(env);

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.use(helmet());
  app.use(cookieParser(env.CSRF_SECRET));
  if (env.APP_PUBLIC_URL) {
    app.enableCors({
      origin: env.APP_PUBLIC_URL,
      credentials: true,
    });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  if (env.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Auvora Blockchain Integration Service')
      .setDescription('Blockchain integration platform API')
      .setVersion(env.SERVICE_VERSION)
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Nest + OpenTelemetryLifecycle handle SIGINT/SIGTERM — do not also process.on().
  app.enableShutdownHooks();
  await app.listen(env.PORT);

  const logger = app.get(Logger);
  logger.log(`${env.SERVICE_NAME} listening on port ${env.PORT}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(message);
  process.exit(1);
});
