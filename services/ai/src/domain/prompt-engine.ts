export type PromptVariables = Record<string, unknown>;

const VARIABLE_PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

function readPath(variables: PromptVariables, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, segment) => {
    if (acc && typeof acc === 'object' && segment in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[segment];
    }
    return undefined;
  }, variables);
}

/** Extracts every distinct `{{variable}}` token referenced by a prompt template. */
export function extractVariableNames(template: string): string[] {
  const names = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) {
    const name = match[1];
    if (name) names.add(name);
  }
  return Array.from(names);
}

/** Renders a prompt template string, interpolating `{{name}}` / `{{path.to.value}}` variables. */
export function renderPrompt(template: string, variables: PromptVariables): string {
  return template.replace(VARIABLE_PATTERN, (_match, name: string) => {
    const value = readPath(variables, name);
    return value === undefined || value === null ? '' : String(value);
  });
}

export interface RenderedPrompt {
  systemPrompt?: string;
  userPrompt: string;
}

export function renderPromptParts(
  input: { systemPrompt?: string | null; userPrompt: string },
  variables: PromptVariables,
): RenderedPrompt {
  return {
    systemPrompt: input.systemPrompt ? renderPrompt(input.systemPrompt, variables) : undefined,
    userPrompt: renderPrompt(input.userPrompt, variables),
  };
}
