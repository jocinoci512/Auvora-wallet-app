export type TemplateFormatCode = 'HTML' | 'TEXT' | 'MARKDOWN' | 'RICH';

export type TemplateVariables = Record<string, unknown>;

const CONDITIONAL_PATTERN = /\{\{#if\s+([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function readPath(variables: TemplateVariables, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, variables);
}

/** Extracts every distinct `{{variable}}` / `{{#if variable}}` token referenced by a template. */
export function extractVariableNames(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(CONDITIONAL_PATTERN)) {
    const name = match[1];
    if (name) names.add(name);
  }
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return Array.from(names);
}

/**
 * Renders a template string, resolving `{{#if x}}...{{/if}}` conditional blocks and
 * `{{name}}` variable interpolation. Conditionals are evaluated non-nested (single pass);
 * variable output is HTML-escaped when format is HTML to prevent injection.
 */
export function renderTemplate(
  template: string,
  variables: TemplateVariables,
  format: TemplateFormatCode = 'TEXT',
): string {
  const withConditionals = template.replace(CONDITIONAL_PATTERN, (_match, condition: string, inner: string) => {
    const value = readPath(variables, condition);
    return isTruthy(value) ? inner : '';
  });

  return withConditionals.replace(VARIABLE_PATTERN, (_match, name: string) => {
    const value = readPath(variables, name);
    const stringValue = value === undefined || value === null ? '' : String(value);
    return format === 'HTML' ? escapeHtml(stringValue) : stringValue;
  });
}

export interface RenderedTemplate {
  subject?: string;
  body: string;
}

export function renderTemplateParts(
  input: { subject?: string; body: string },
  variables: TemplateVariables,
  format: TemplateFormatCode = 'TEXT',
): RenderedTemplate {
  return {
    subject: input.subject ? renderTemplate(input.subject, variables, format) : undefined,
    body: renderTemplate(input.body, variables, format),
  };
}
