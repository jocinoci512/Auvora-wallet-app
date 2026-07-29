// eslint-disable-next-line no-control-regex -- intentional strip of C0 controls from untrusted metadata
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;
const SCRIPT_OR_HANDLER =
  /<script\b[^>]*>[\s\S]*?(?:<\/script>|$)|<\/script\s*>|javascript:|on\w+\s*=|data:text\/html/gi;

export type SanitizedTrait = { traitType: string; value: string; displayType?: string };

function stripDangerous(input: string): string {
  return input.replace(SCRIPT_OR_HANDLER, '').replace(/[<>]/g, '');
}

function containsDangerous(input: string): boolean {
  return /<script\b|javascript:|on\w+\s*=|data:text\/html/i.test(input);
}

export function sanitizeText(input: string, max = 2_000): string {
  const trimmed = input.replace(CONTROL_CHARS, '').trim().slice(0, max);
  return stripDangerous(trimmed);
}

export function sanitizeUrl(input: string | null | undefined): string | null {
  if (!input) return null;
  const value = input.trim();
  if (!/^https?:\/\//i.test(value) && !/^ipfs:\/\//i.test(value)) {
    return null;
  }
  if (containsDangerous(value)) return null;
  return value.slice(0, 2_048);
}

export function parseTraits(raw: unknown): SanitizedTrait[] {
  if (!Array.isArray(raw)) return [];
  const traits: SanitizedTrait[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const traitType = sanitizeText(String(row.trait_type ?? row.traitType ?? 'trait'), 64);
    const value = sanitizeText(String(row.value ?? ''), 256);
    const displayTypeRaw = row.display_type ?? row.displayType;
    const displayType = displayTypeRaw ? sanitizeText(String(displayTypeRaw), 32) : undefined;
    if (!traitType || !value) continue;
    traits.push(displayType ? { traitType, value, displayType } : { traitType, value });
    if (traits.length >= 64) break;
  }
  return traits;
}
