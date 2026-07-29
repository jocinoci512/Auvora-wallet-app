import { extractVariableNames, renderPrompt, renderPromptParts } from './prompt-engine';

describe('prompt-engine', () => {
  it('interpolates simple variables', () => {
    expect(renderPrompt('Hello {{name}}!', { name: 'Ada' })).toBe('Hello Ada!');
  });

  it('renders nested dot-path variables', () => {
    expect(renderPrompt('Hi {{user.firstName}}', { user: { firstName: 'Grace' } })).toBe(
      'Hi Grace',
    );
  });

  it('replaces missing variables with an empty string', () => {
    expect(renderPrompt('Value: {{missing}}', {})).toBe('Value: ');
  });

  it('extracts distinct variable names referenced by a template', () => {
    const names = extractVariableNames('{{a}} {{b}} {{c}} {{b}}');
    expect(names.sort()).toEqual(['a', 'b', 'c']);
  });

  it('renders system and user prompt together', () => {
    const result = renderPromptParts(
      { systemPrompt: 'You are {{role}}', userPrompt: 'Hi {{name}}' },
      { role: 'a helper', name: 'Sam' },
    );
    expect(result).toEqual({ systemPrompt: 'You are a helper', userPrompt: 'Hi Sam' });
  });

  it('omits systemPrompt when the template does not define one', () => {
    const result = renderPromptParts({ userPrompt: 'Hi {{name}}' }, { name: 'Sam' });
    expect(result).toEqual({ systemPrompt: undefined, userPrompt: 'Hi Sam' });
  });
});
