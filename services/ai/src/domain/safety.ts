export const DEFAULT_MAX_INPUT_LENGTH = 8_000;

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_PATTERN = /\+?\d[\d\s().-]{7,}\d/g;

export interface InputValidationResult {
  valid: boolean;
  reason?: string;
}

/** Rejects inputs that are empty or exceed the configured maximum length. */
export function validateInputLength(input: string, maxLength = DEFAULT_MAX_INPUT_LENGTH): InputValidationResult {
  if (!input || input.trim().length === 0) {
    return { valid: false, reason: 'Input must not be empty' };
  }
  if (input.length > maxLength) {
    return { valid: false, reason: `Input exceeds maximum length of ${maxLength} characters` };
  }
  return { valid: true };
}

/** Basic PII redaction hook — replaces emails and phone-number-looking substrings with placeholders. */
export function redactPii(input: string): string {
  return input.replace(EMAIL_PATTERN, '[REDACTED_EMAIL]').replace(PHONE_PATTERN, '[REDACTED_PHONE]');
}

export function containsPii(input: string): boolean {
  return EMAIL_PATTERN.test(input) || PHONE_PATTERN.test(input);
}

/** Output sanitization stub — strips control characters and collapses excess whitespace/newlines. */
export function sanitizeOutput(output: string): string {
  return output
    // eslint-disable-next-line no-control-regex -- intentionally matching non-printable control characters
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason?: string;
  redactedInput: string;
}

export function runSafetyChecks(input: string, maxLength = DEFAULT_MAX_INPUT_LENGTH): SafetyCheckResult {
  const validation = validateInputLength(input, maxLength);
  if (!validation.valid) {
    return { allowed: false, reason: validation.reason, redactedInput: input };
  }
  return { allowed: true, redactedInput: redactPii(input) };
}
