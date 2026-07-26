import { extractVariableNames, renderTemplate, renderTemplateParts } from './template-engine';

describe('template-engine', () => {
  it('interpolates simple variables', () => {
    expect(renderTemplate('Hello {{name}}!', { name: 'Ada' })).toBe('Hello Ada!');
  });

  it('renders nested dot-path variables', () => {
    expect(renderTemplate('Hi {{user.firstName}}', { user: { firstName: 'Grace' } })).toBe('Hi Grace');
  });

  it('replaces missing variables with an empty string', () => {
    expect(renderTemplate('Value: {{missing}}', {})).toBe('Value: ');
  });

  it('renders the conditional block when the condition is truthy', () => {
    const template = '{{#if isVip}}VIP member{{/if}} thanks for joining';
    expect(renderTemplate(template, { isVip: true })).toBe('VIP member thanks for joining');
  });

  it('omits the conditional block when the condition is falsy', () => {
    const template = '{{#if isVip}}VIP member{{/if}}thanks for joining';
    expect(renderTemplate(template, { isVip: false })).toBe('thanks for joining');
  });

  it('escapes HTML-unsafe characters only for the HTML format', () => {
    const template = 'Hello {{name}}';
    expect(renderTemplate(template, { name: '<b>Ada</b>' }, 'HTML')).toBe('Hello &lt;b&gt;Ada&lt;/b&gt;');
    expect(renderTemplate(template, { name: '<b>Ada</b>' }, 'TEXT')).toBe('Hello <b>Ada</b>');
  });

  it('extracts distinct variable names referenced by a template', () => {
    const names = extractVariableNames('{{#if a}}{{b}}{{/if}} {{c}} {{b}}');
    expect(names.sort()).toEqual(['a', 'b', 'c']);
  });

  it('renders subject and body together', () => {
    const result = renderTemplateParts({ subject: 'Welcome {{name}}', body: 'Hi {{name}}, enjoy!' }, { name: 'Sam' });
    expect(result).toEqual({ subject: 'Welcome Sam', body: 'Hi Sam, enjoy!' });
  });
});
