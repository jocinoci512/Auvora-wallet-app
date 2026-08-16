import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '@auvora/database';
import { ConfigModule } from '../config/config.module';
import { ENV, type ServiceEnv } from '../config/env.schema';
import { AUDIT_REPOSITORY } from '../application/ports/audit-repository.port';
import { CLOCK, ID_GENERATOR } from '../application/ports/clock.port';
import { DEVICE_REPOSITORY } from '../application/ports/device-repository.port';
import { LOGIN_HISTORY_REPOSITORY } from '../application/ports/login-history-repository.port';
import { MAIL_PORT } from '../application/ports/mail.port';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port';
import { RATE_LIMITER } from '../application/ports/rate-limiter.port';
import { REFRESH_TOKEN_REPOSITORY } from '../application/ports/refresh-token-repository.port';
import { SESSION_REPOSITORY } from '../application/ports/session-repository.port';
import { TOKEN_SERVICE } from '../application/ports/token-service.port';
import { USER_REPOSITORY } from '../application/ports/user-repository.port';
import { Argon2PasswordHasherAdapter } from './crypto/argon2-password-hasher.adapter';
import { JwtTokenAdapter } from './crypto/jwt-token.adapter';
import { LoggerInfrastructureModule } from './logging/logger.module';
import { ConsoleMailAdapter } from './mail/console-mail.adapter';
import { SmtpMailAdapter } from './mail/smtp-mail.adapter';
import { NotificationsMailAdapter } from './mail/notifications-mail.adapter';
import {
  AnalyticsPublisherAdapter,
  ANALYTICS_PUBLISHER,
} from './analytics/analytics-publisher.adapter';
import {
  OBSERVABILITY_PUBLISHER,
  ObservabilityPublisherAdapter,
} from './observability/observability-publisher.adapter';
import { PrismaAuditRepository } from './persistence/prisma-audit.repository';
import { PrismaDeviceRepository } from './persistence/prisma-device.repository';
import { PrismaLoginHistoryRepository } from './persistence/prisma-login-history.repository';
import { PrismaRefreshTokenRepository } from './persistence/prisma-refresh-token.repository';
import { PrismaSessionRepository } from './persistence/prisma-session.repository';
import { PrismaUserRepository } from './persistence/prisma-user.repository';
import { REDIS_PORT } from './redis/redis.port';
import { RedisAdapter } from './redis/redis.adapter';
import { ADMIN_EVENT_PUBLISHER } from '../application/ports/admin-event-publisher.port';
import { RedisAdminEventPublisher } from './realtime/redis-admin-event-publisher.adapter';
import { SystemClockAdapter, UuidIdGeneratorAdapter } from './system/system.adapters';

@Module({
  imports: [ConfigModule, PrismaModule, LoggerInfrastructureModule, JwtModule.register({})],
  providers: [
    RedisAdapter,
    Argon2PasswordHasherAdapter,
    JwtTokenAdapter,
    SystemClockAdapter,
    UuidIdGeneratorAdapter,
    PrismaUserRepository,
    PrismaSessionRepository,
    PrismaDeviceRepository,
    PrismaRefreshTokenRepository,
    PrismaLoginHistoryRepository,
    PrismaAuditRepository,
    {
      provide: REDIS_PORT,
      useExisting: RedisAdapter,
    },
    {
      provide: RATE_LIMITER,
      useExisting: RedisAdapter,
    },
    {
      provide: PASSWORD_HASHER,
      useExisting: Argon2PasswordHasherAdapter,
    },
    {
      provide: TOKEN_SERVICE,
      useExisting: JwtTokenAdapter,
    },
    {
      provide: CLOCK,
      useExisting: SystemClockAdapter,
    },
    {
      provide: ID_GENERATOR,
      useExisting: UuidIdGeneratorAdapter,
    },
    {
      provide: USER_REPOSITORY,
      useExisting: PrismaUserRepository,
    },
    {
      provide: SESSION_REPOSITORY,
      useExisting: PrismaSessionRepository,
    },
    {
      provide: DEVICE_REPOSITORY,
      useExisting: PrismaDeviceRepository,
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useExisting: PrismaRefreshTokenRepository,
    },
    {
      provide: LOGIN_HISTORY_REPOSITORY,
      useExisting: PrismaLoginHistoryRepository,
    },
    {
      provide: AUDIT_REPOSITORY,
      useExisting: PrismaAuditRepository,
    },
    {
      provide: MAIL_PORT,
      useFactory: (
        env: ServiceEnv,
        consoleMail: ConsoleMailAdapter,
        notificationsMail: NotificationsMailAdapter,
      ) => {
        if (env.MAIL_DRIVER === 'notifications') {
          return notificationsMail;
        }
        if (env.MAIL_DRIVER === 'smtp') {
          return new SmtpMailAdapter(env);
        }
        if (env.NODE_ENV === 'production') {
          throw new Error(
            'MAIL_DRIVER=console is forbidden in production - set MAIL_DRIVER=smtp or notifications',
          );
        }
        return consoleMail;
      },
      inject: [ENV, ConsoleMailAdapter, NotificationsMailAdapter],
    },
    ConsoleMailAdapter,
    NotificationsMailAdapter,
    AnalyticsPublisherAdapter,
    ObservabilityPublisherAdapter,
    {
      provide: ANALYTICS_PUBLISHER,
      useExisting: AnalyticsPublisherAdapter,
    },
    {
      provide: OBSERVABILITY_PUBLISHER,
      useExisting: ObservabilityPublisherAdapter,
    },
    RedisAdminEventPublisher,
    {
      provide: ADMIN_EVENT_PUBLISHER,
      useExisting: RedisAdminEventPublisher,
    },
  ],
  exports: [
    REDIS_PORT,
    RATE_LIMITER,
    PASSWORD_HASHER,
    TOKEN_SERVICE,
    CLOCK,
    ID_GENERATOR,
    USER_REPOSITORY,
    SESSION_REPOSITORY,
    DEVICE_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    LOGIN_HISTORY_REPOSITORY,
    AUDIT_REPOSITORY,
    MAIL_PORT,
    ANALYTICS_PUBLISHER,
    OBSERVABILITY_PUBLISHER,
    ADMIN_EVENT_PUBLISHER,
    LoggerInfrastructureModule,
    PrismaModule,
  ],
})
export class InfrastructureModule {}
