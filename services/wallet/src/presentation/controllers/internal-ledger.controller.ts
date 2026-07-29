import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController, ApiTags } from '@nestjs/swagger';
import type { JwtAccessClaims, PermissionCode } from '@auvora/types';
import { WalletService } from '../../application/services/wallet.service';
import { ForbiddenError } from '../../domain';
import { PERMISSION_WALLETS_ADMIN } from '../../domain/permission-codes';
import { successResponse } from '@auvora/nest-common';
import { Public, SkipCsrf } from '../decorators/auth.decorators';
import { InternalCreditDebitDto, InternalTransferDto } from '../dto/internal-ledger.dto';
import { InternalApiKeyGuard } from '../guards/internal-api-key.guard';

// Keep DTO value imports for ValidationPipe metadata (do not convert to `import type`).
const _internalLedgerDtoRuntime = { InternalCreditDebitDto, InternalTransferDto };
void _internalLedgerDtoRuntime;

const SYSTEM_REQUESTER: JwtAccessClaims = {
  sub: '00000000-0000-4000-8000-000000000001',
  email: 'payments-internal@auvora.local',
  sessionId: '00000000-0000-4000-8000-000000000002',
  roles: ['admin'],
  permissions: [PERMISSION_WALLETS_ADMIN as PermissionCode],
};

/**
 * Service-to-service ledger mutations for Payment Orchestration.
 * Authenticated solely via `x-internal-api-key` — never expose via gateway.
 * Every mutation requires `expectedOwnerUserId` to prevent cross-tenant IDOR.
 */
@ApiTags('internal-ledger')
@ApiExcludeController()
@Public()
@SkipCsrf()
@UseGuards(InternalApiKeyGuard)
@Controller('api/v1/internal/ledger')
export class InternalLedgerController {
  constructor(@Inject(WalletService) private readonly walletService: WalletService) {}

  @Post('credit')
  async credit(@Body() dto: InternalCreditDebitDto) {
    await this.assertWalletOwner(dto.walletId, dto.expectedOwnerUserId);
    const result = await this.walletService.creditWallet(
      {
        walletId: dto.walletId,
        amount: dto.amount,
        description: dto.description,
        metadata: dto.metadata,
        transactionType: dto.transactionType,
      },
      SYSTEM_REQUESTER,
    );
    return successResponse({ transactionId: result.transaction.id });
  }

  @Post('debit')
  async debit(@Body() dto: InternalCreditDebitDto) {
    await this.assertWalletOwner(dto.walletId, dto.expectedOwnerUserId);
    const result = await this.walletService.debitWallet(
      {
        walletId: dto.walletId,
        amount: dto.amount,
        description: dto.description,
        metadata: dto.metadata,
        transactionType: dto.transactionType,
      },
      SYSTEM_REQUESTER,
    );
    return successResponse({ transactionId: result.transaction.id });
  }

  @Post('transfer')
  async transfer(@Body() dto: InternalTransferDto) {
    await this.assertWalletOwner(dto.fromWalletId, dto.expectedOwnerUserId);
    const result = await this.walletService.createInternalTransfer(
      {
        fromWalletId: dto.fromWalletId,
        toWalletId: dto.toWalletId,
        amount: dto.amount,
        description: dto.description,
        metadata: dto.metadata,
      },
      SYSTEM_REQUESTER,
    );
    return successResponse({ transactionId: result.transaction.id });
  }

  private async assertWalletOwner(walletId: string, expectedOwnerUserId: string): Promise<void> {
    const wallet = await this.walletService.getWallet(walletId, {
      ...SYSTEM_REQUESTER,
      // Admin path: getWallet allows wallets:admin without ownership match.
    });
    if (wallet.ownerUserId !== expectedOwnerUserId) {
      throw new ForbiddenError('Wallet does not belong to the expected owner');
    }
  }
}
