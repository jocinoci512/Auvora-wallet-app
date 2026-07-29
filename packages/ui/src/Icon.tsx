import type { LucideIcon, LucideProps } from 'lucide-react';
import type { ReactElement } from 'react';
import { iconSize } from './tokens';

export type IconSizeToken = keyof typeof iconSize;

export interface IconProps extends Omit<LucideProps, 'size' | 'ref'> {
  icon: LucideIcon;
  size?: IconSizeToken | number;
}

export function Icon({ icon: Lucide, size = 'md', className, ...rest }: IconProps): ReactElement {
  const px = typeof size === 'number' ? size : iconSize[size];
  const classes = ['auvora-icon', className].filter(Boolean).join(' ');
  return (
    <Lucide
      className={classes}
      size={px}
      aria-hidden={rest['aria-label'] ? undefined : true}
      {...rest}
    />
  );
}
