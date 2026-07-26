import { Controller, Get, Inject, NotFoundException, Param, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import { WalletService } from '../../application/services/wallet.service';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';
import { successResponse } from '../common/api-response';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

const SYSTEM_REQUESTER: JwtAccessClaims = {
  sub: '00000000-0000-4000-8000-000000000001',
  email: 'payments-internal@auvora.local',
  sessionId: '00000000-0000-4000-8000-000000000002',
  roles: ['admin'],
  permissions: [PERMISSION_WALLETS_ADMIN as PermissionCode],
};

/**
 * Service-to-service wallet lookup for Payment Orchestration.
 * Authenticated solely via `x-internal-api-key` — never expose via gateway.
 */
@ApiTags('internal-wallets')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/wallets')
export class InternalWalletController {
  constructor(@Inject(WalletService) private readonly walletService: WalletService) {}

  @Get(':walletId')
  async getOwner(@Param('walletId') walletId: string) {
    try {
      const wallet = await this.walletService.getWallet(walletId, SYSTEM_REQUESTER);
      return successResponse({ id: wallet.id, ownerUserId: wallet.ownerUserId });
    } catch {
      throw new NotFoundException('Wallet not found');
    }
  }
}
