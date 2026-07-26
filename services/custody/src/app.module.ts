import { Module } from '@nestjs/common';
import { ApplicationModule } from './application/application.module';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PresentationModule } from './presentation/presentation.module';

@Module({
  imports: [ConfigModule, InfrastructureModule, ApplicationModule, PresentationModule],
})
export class AppModule {}
