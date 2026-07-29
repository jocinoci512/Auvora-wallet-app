import { Controller, Get, Headers, Inject, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ENV, type ServiceEnv } from '../../config/env.schema';
import { BridgeWorkersService } from '../../application/services/bridge-workers.service';
import { BridgeProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { Public } from '../decorators/auth.decorators';
import { successResponse } from '@auvora/nest-common';

@ApiTags('internal-bridge')
@Controller('api/v1/internal/bridge')
export class InternalBridgeController {
  constructor(
    @Inject(ENV) private readonly env: ServiceEnv,
    @Inject(BridgeProviderRegistry) private readonly registry: BridgeProviderRegistry,
    @Inject(BridgeWorkersService) private readonly workers: BridgeWorkersService,
  ) {}

  private assertKey(key?: string) {
    if (!key || key !== this.env.INTERNAL_API_KEY) {
      throw new UnauthorizedException('Invalid internal API key');
    }
  }

  @Public()
  @Get('health')
  async health(@Headers('x-internal-api-key') key?: string) {
    this.assertKey(key);
    return successResponse({
      registry: await this.registry.healthCheck(),
      workers: this.workers.status(),
    });
  }
}
