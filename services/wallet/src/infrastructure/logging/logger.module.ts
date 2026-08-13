import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { loadEnv } from '../../config/env.schema';

const env = loadEnv();

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        level: env.LOG_LEVEL,
        transport:
          env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-internal-api-key"]',
            'req.headers["x-csrf-token"]',
            'req.body.password',
            'req.body.refreshToken',
            'req.body.accessToken',
            'req.body.privateKey',
            'req.body.mnemonic',
            'req.body.seedPhrase',
            'req.body.seed_phrase',
            'req.body.secretKey',
          ],
          remove: true,
        },
      },
    }),
  ],
})
export class LoggerInfrastructureModule {}
