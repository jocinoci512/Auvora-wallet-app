import { Inject, Injectable } from '@nestjs/common';
import type { AiAssistantType } from '@auvora/database';
import { renderPrompt } from '../../domain';
import { ChatService } from './chat.service';
import { PromptService } from './prompt.service';

export interface AutomationResult {
  text: string;
  conversationId: string;
  requestId: string;
}

/** Backs internal/admin automation helpers by rendering an automation prompt and running it through the normal chat pipeline. */
@Injectable()
export class AutomationService {
  constructor(
    @Inject(PromptService) private readonly prompts: PromptService,
    @Inject(ChatService) private readonly chat: ChatService,
  ) {}

  private async run(
    ownerUserId: string,
    assistantType: AiAssistantType,
    promptCode: string,
    fallbackTemplate: string,
    variables: Record<string, unknown>,
    correlationId?: string,
  ): Promise<AutomationResult> {
    let rendered: string;
    try {
      const { version } = await this.prompts.getActiveVersionByCode(promptCode);
      rendered = renderPrompt(version.userPrompt, variables);
    } catch {
      rendered = renderPrompt(fallbackTemplate, variables);
    }

    const result = await this.chat.chat({ ownerUserId, assistantType, message: rendered, correlationId });
    return {
      text: result.assistantMessage.content,
      conversationId: result.conversation.id,
      requestId: result.request.id,
    };
  }

  async summarizeCase(ownerUserId: string, caseText: string, correlationId?: string): Promise<AutomationResult> {
    return this.run(
      ownerUserId,
      'COMPLIANCE',
      'automation.case_summary',
      'Summarize this case:\n{{case}}',
      { case: caseText },
      correlationId,
    );
  }

  async explainTransaction(ownerUserId: string, transactionText: string, correlationId?: string): Promise<AutomationResult> {
    return this.run(
      ownerUserId,
      'WALLET',
      'automation.transaction_explain',
      'Explain this transaction:\n{{transaction}}',
      { transaction: transactionText },
      correlationId,
    );
  }

  async draftSupportTicket(ownerUserId: string, summary: string, correlationId?: string): Promise<AutomationResult> {
    return this.run(
      ownerUserId,
      'CUSTOMER_SUPPORT',
      'automation.support_ticket_draft',
      'Draft a customer support ticket summarizing the following issue:\n{{summary}}',
      { summary },
      correlationId,
    );
  }

  async riskInsight(ownerUserId: string, riskContext: string, correlationId?: string): Promise<AutomationResult> {
    return this.run(
      ownerUserId,
      'FRAUD_ANALYST',
      'automation.risk_insight',
      'Provide a concise risk insight based on the following signals:\n{{context}}',
      { context: riskContext },
      correlationId,
    );
  }
}
