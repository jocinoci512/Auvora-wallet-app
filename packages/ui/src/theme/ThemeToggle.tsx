'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import type { ReactElement } from 'react';
import { Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { useTheme } from './ThemeProvider';

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps): ReactElement {
  const { theme, cycleTheme, resolvedTheme } = useTheme();
  const Glyph = theme === 'system' ? Monitor : theme === 'dark' ? Moon : Sun;
  const label =
    theme === 'light'
      ? 'Theme: light (click for dark)'
      : theme === 'dark'
        ? 'Theme: dark (click for system)'
        : `Theme: system → ${resolvedTheme} (click for light)`;

  return (
    <IconButton label={label} className={className} onClick={cycleTheme} type="button">
      <Icon icon={Glyph} size="sm" aria-hidden />
    </IconButton>
  );
}
