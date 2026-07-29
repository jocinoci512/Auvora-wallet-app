import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, PrismaService } from '@auvora/database';
import { SwapExpiredError, SwapNotFoundError, SwapValidationError } from '../../domain/errors';
import { SWAP_PROVIDER, type SwapProviderPort, type SwapQuoteRequest } from '../../domain';
import { SwapProviderRegistry } from '../../infrastructure/providers/provider-registry';
import { CLOCK, ID_GENERATOR, type ClockPort, type IdGeneratorPort } from '../ports/clock.port';

@Injectable()
export class SwapExecutionService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(SWAP_PROVIDER) private readonly providers: SwapProviderPort,
    @Inject(SwapProviderRegistry) private readonly registry: SwapProviderRegistry,
    @Inject(CLOCK) private readonly clock: ClockPort,
    @Inject(ID_GENERATOR) private readonly ids: IdGeneratorPort,
  ) {}

  async prepare(
    userId: string,
    input: SwapQuoteRequest & { quoteId: string; providerCode: string },
  ) {
    const quote = await this.requireQuote(input.quoteId, userId);
    if (new Date(quote.expiresAt).getTime() < this.clock.now().getTime()) {
      throw new SwapExpiredError();
    }
    if (!input.userAddress) {
      throw new SwapValidationError('userAddress is required before transaction preparation');
    }
    const prepared = await this.registry.buildTransaction({
      ...input,
      providerQuoteId: quote.providerQuoteId,
      providerCode: input.providerCode,
    });

    if (!prepared.simulationOk) {
      throw new SwapValidationError('Transaction simulation failed', {
        detail: prepared.simulationDetail,
      });
    }

    const execution = await this.prisma.swapExecution.create({
      data: {
        id: this.ids.uuid(),
        userId,
        quoteId: quote.id,
        network: quote.network,
        providerCode: prepared.providerCode,
        providerRef: prepared.providerQuoteId,
        status: 'AWAITING_SIGNATURE',
        sellToken: quote.sellToken,
        buyToken: quote.buyToken,
        sellAmount: quote.sellAmount,
        expectedAmountOut: quote.amountOut,
        minAmountOut: quote.minAmountOut,
        preparedTx: prepared as unknown as Prisma.InputJsonValue,
        userAddress: input.userAddress,
      },
    });

    return { executionId: execution.id, prepared, requiresUserConfirmation: true };
  }

  async execute(
    userId: string,
    input: { executionId: string; confirmed: boolean; signedTxHash?: string },
  ) {
    if (!input.confirmed) {
      throw new SwapValidationError('User confirmation required before swap execution');
    }
    const execution = await this.prisma.swapExecution.findFirst({
      where: { id: input.executionId, userId },
    });
    if (!execution) throw new SwapNotFoundError('Swap execution not found');

    const txHash = input.signedTxHash ?? `pending-${execution.id}`;
    return this.prisma.swapExecution.update({
      where: { id: execution.id },
      data: {
        status: 'SUBMITTED',
        txHash,
        submittedAt: this.clock.now(),
      },
    });
  }

  async monitor(executionId: string) {
    const execution = await this.prisma.swapExecution.findUnique({ where: { id: executionId } });
    if (!execution) throw new SwapNotFoundError('Swap execution not found');
    const status = await this.providers.getExecutionStatus(execution.providerRef);
    const nextStatus =
      status.status === 'COMPLETED'
        ? 'COMPLETED'
        : status.status === 'FAILED'
          ? 'FAILED'
          : status.status === 'CONFIRMING'
            ? 'CONFIRMING'
            : 'SUBMITTED';

    const updated = await this.prisma.swapExecution.update({
      where: { id: execution.id },
      data: {
        status: nextStatus,
        txHash: status.txHash ?? execution.txHash,
        confirmations: status.confirmations ?? execution.confirmations,
        errorMessage: status.errorMessage,
        completedAt:
          nextStatus === 'COMPLETED' || nextStatus === 'FAILED' ? this.clock.now() : null,
        actualAmountOut: status.amountOutActual ?? execution.actualAmountOut,
      },
    });

    if (nextStatus === 'COMPLETED') {
      await this.prisma.swapReceipt.upsert({
        where: { executionId: execution.id },
        create: {
          id: this.ids.uuid(),
          executionId: execution.id,
          userId: execution.userId,
          network: execution.network,
          txHash: updated.txHash ?? '',
          sellToken: execution.sellToken,
          buyToken: execution.buyToken,
          sellAmount: execution.sellAmount,
          amountOut: updated.actualAmountOut ?? execution.expectedAmountOut,
          providerCode: execution.providerCode,
          feePaid: execution.feePaid,
          metadata: { confirmations: updated.confirmations } as Prisma.InputJsonValue,
        },
        update: {
          txHash: updated.txHash ?? '',
          amountOut: updated.actualAmountOut ?? execution.expectedAmountOut,
        },
      });
    }

    return updated;
  }

  private async requireQuote(quoteId: string, userId: string) {
    const quote = await this.prisma.swapQuoteRecord.findFirst({ where: { id: quoteId, userId } });
    if (!quote) throw new SwapNotFoundError('Swap quote not found');
    return quote;
  }
}
