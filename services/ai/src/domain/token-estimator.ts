/** Rough token estimate using the common ~4 characters-per-token heuristic (no tokenizer dependency). */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 4));
}

export function estimateTokensForMessages(messages: Array<{ content: string }>): number {
  return messages.reduce((total, message) => total + estimateTokens(message.content), 0);
}
