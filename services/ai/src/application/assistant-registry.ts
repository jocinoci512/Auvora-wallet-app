import type { AiAssistantType } from '@auvora/database';

export const ALL_ASSISTANT_TYPES: AiAssistantType[] = [
  'CUSTOMER_SUPPORT',
  'WALLET',
  'PAYMENT',
  'COMPLIANCE',
  'FRAUD_ANALYST',
  'OPERATIONS',
  'ADMIN',
  'DEVELOPER',
  'DOCUMENTATION',
];

/** Maps each assistant type to the `ai_prompt_templates.code` that seeds/administers its system prompt. */
const ASSISTANT_PROMPT_CODES: Record<AiAssistantType, string> = {
  CUSTOMER_SUPPORT: 'assistant.customer_support',
  WALLET: 'assistant.wallet',
  PAYMENT: 'assistant.payment',
  COMPLIANCE: 'assistant.compliance',
  FRAUD_ANALYST: 'assistant.fraud_analyst',
  OPERATIONS: 'assistant.operations',
  ADMIN: 'assistant.admin',
  DEVELOPER: 'assistant.developer',
  DOCUMENTATION: 'assistant.documentation',
};

/** Fallback system prompt used when no prompt template row exists yet for an assistant type. */
const ASSISTANT_DEFAULT_SYSTEM_PROMPTS: Record<AiAssistantType, string> = {
  CUSTOMER_SUPPORT:
    'You are the Auvora Wallet customer support assistant. Be concise, accurate, and never invent balances or transactions.',
  WALLET: 'You help users understand wallets, transfers, and balances in Auvora Wallet.',
  PAYMENT: 'You explain payment statuses, refunds, and settlements for Auvora Wallet.',
  COMPLIANCE: 'You assist with KYC/AML explanations using only provided context. Do not invent screening results.',
  FRAUD_ANALYST: 'You are a fraud analysis assistant. Summarize risk signals precisely and flag uncertainty.',
  OPERATIONS: 'You assist Auvora operations staff with platform health, incidents, and runbooks.',
  ADMIN: 'You assist Auvora administrators with platform configuration and governance questions.',
  DEVELOPER: 'You are a developer assistant for the Auvora Wallet platform. Provide precise technical answers.',
  DOCUMENTATION: 'You help users find and understand Auvora Wallet product documentation.',
};

export function getAssistantPromptCode(assistantType: AiAssistantType): string {
  return ASSISTANT_PROMPT_CODES[assistantType];
}

export function getAssistantDefaultSystemPrompt(assistantType: AiAssistantType): string {
  return ASSISTANT_DEFAULT_SYSTEM_PROMPTS[assistantType];
}

export interface AssistantDescriptor {
  type: AiAssistantType;
  promptCode: string;
  defaultSystemPrompt: string;
}

export function listAssistants(): AssistantDescriptor[] {
  return ALL_ASSISTANT_TYPES.map((type) => ({
    type,
    promptCode: getAssistantPromptCode(type),
    defaultSystemPrompt: getAssistantDefaultSystemPrompt(type),
  }));
}
