import {
  containsPii,
  redactPii,
  runSafetyChecks,
  sanitizeOutput,
  validateInputLength,
} from './safety';

describe('safety', () => {
  describe('validateInputLength', () => {
    it('rejects empty input', () => {
      expect(validateInputLength('').valid).toBe(false);
      expect(validateInputLength('   ').valid).toBe(false);
    });

    it('rejects input exceeding the max length', () => {
      const result = validateInputLength('a'.repeat(10), 5);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/exceeds maximum length/);
    });

    it('accepts valid input within bounds', () => {
      expect(validateInputLength('hello', 10).valid).toBe(true);
    });
  });

  describe('redactPii / containsPii', () => {
    it('redacts emails', () => {
      expect(redactPii('contact me at ada@example.com please')).toBe(
        'contact me at [REDACTED_EMAIL] please',
      );
    });

    it('redacts phone numbers', () => {
      const redacted = redactPii('call +1 (555) 123-4567 now');
      expect(redacted).toContain('[REDACTED_PHONE]');
      expect(redacted).not.toContain('555');
    });

    it('detects PII presence', () => {
      expect(containsPii('email me at a@b.com')).toBe(true);
      expect(containsPii('no pii here')).toBe(false);
    });
  });

  describe('sanitizeOutput', () => {
    it('strips control characters', () => {
      expect(sanitizeOutput('hello\u0000world')).toBe('helloworld');
    });

    it('collapses excessive newlines', () => {
      expect(sanitizeOutput('a\n\n\n\n\n\nb')).toBe('a\n\n\nb');
    });

    it('trims surrounding whitespace', () => {
      expect(sanitizeOutput('  hi  ')).toBe('hi');
    });
  });

  describe('runSafetyChecks', () => {
    it('disallows overly long input', () => {
      const result = runSafetyChecks('a'.repeat(20), 10);
      expect(result.allowed).toBe(false);
    });

    it('redacts PII in allowed input', () => {
      const result = runSafetyChecks('email ada@example.com', 1000);
      expect(result.allowed).toBe(true);
      expect(result.redactedInput).toBe('email [REDACTED_EMAIL]');
    });
  });
});
