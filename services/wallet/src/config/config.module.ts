import { Global, Module } from '@nestjs/common';
import { ENV, loadEnv, type ServiceEnv } from './env.schema';

@Global()
@Module({
  providers: [
    {
      provide: ENV,
      useFactory: (): ServiceEnv => loadEnv(),
    },
  ],
  exports: [ENV],
})
export class ConfigModule {}
