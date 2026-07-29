import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ConnectionsWorkersService } from '../../application/services/connections-workers.service';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';
import { successResponse } from '@auvora/nest-common';

@ApiTags('internal-connections')
@Controller('api/v1/internal/connections')
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
export class InternalConnectionsController {
  constructor(
    @Inject(ConnectionsWorkersService) private readonly workers: ConnectionsWorkersService,
  ) {}

  @Get('workers')
  workersStatus() {
    return successResponse(this.workers.status());
  }
}
