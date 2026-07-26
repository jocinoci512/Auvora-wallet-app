import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { ConfigModule } from '../../config/config.module';
import { ENV, type ServiceEnv } from '../../config/env.schema';

@Module({
  imports: [
    ConfigModule,
    PinoLoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: ServiceEnv) => ({
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
            ],
            remove: true,
          },
        },
      }),
    }),
  ],
})
export class LoggerInfrastructureModule {}
