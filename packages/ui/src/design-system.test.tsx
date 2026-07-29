import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Button } from './Button';
import { Badge } from './Badge';
import { OfflineState } from './FeedbackStates';
import { tokens, cssVar, colorLight, colorDark } from './tokens';
import { cn } from './utils/cn';

describe('@auvora/ui design system', () => {
  it('exposes semantic tokens and cssVar helper', () => {
    expect(tokens.color.primary).toMatch(/^#/);
    expect(colorLight.primary).toBe('#0f6e56');
    expect(colorDark.primary).toMatch(/^#/);
    expect(cssVar('color-primary')).toBe('var(--auvora-color-primary)');
    expect(cssVar('color-primary', '#0f6e56')).toContain('#0f6e56');
  });

  it('renders Button with variant classes', () => {
    const html = renderToStaticMarkup(
      createElement(Button, { variant: 'primary', size: 'sm' }, 'Save'),
    );
    expect(html).toContain('auvora-btn');
    expect(html).toContain('auvora-btn--primary');
    expect(html).toContain('Save');
  });

  it('renders Badge tones', () => {
    const html = renderToStaticMarkup(createElement(Badge, { tone: 'success' }, 'OK'));
    expect(html).toContain('auvora-badge--success');
  });

  it('renders OfflineState defaults', () => {
    const html = renderToStaticMarkup(createElement(OfflineState));
    expect(html).toContain('You are offline');
    expect(html).toContain('auvora-empty--offline');
  });

  it('cn joins truthy class names', () => {
    expect(cn('a', false, undefined, 'b')).toBe('a b');
  });
});
