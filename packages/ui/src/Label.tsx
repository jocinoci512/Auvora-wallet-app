import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentPropsWithoutRef, ElementRef, ReactElement } from 'react';
import { forwardRef } from 'react';

export type LabelProps = ComponentPropsWithoutRef<typeof LabelPrimitive.Root>;

export const Label = forwardRef<ElementRef<typeof LabelPrimitive.Root>, LabelProps>(function Label(
  { className, ...rest },
  ref,
): ReactElement {
  const classes = ['auvora-label', className].filter(Boolean).join(' ');
  return <LabelPrimitive.Root ref={ref} className={classes} {...rest} />;
});
