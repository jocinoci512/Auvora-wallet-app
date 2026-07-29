'use client';

import * as SwitchPrimitive from '@radix-ui/react-switch';
import type { ComponentPropsWithoutRef, ElementRef, ReactElement, ReactNode } from 'react';
import { forwardRef } from 'react';

export interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {
  label?: ReactNode;
}

export const Switch = forwardRef<ElementRef<typeof SwitchPrimitive.Root>, SwitchProps>(
  function Switch({ className, label, id, ...rest }, ref): ReactElement {
    const control = (
      <SwitchPrimitive.Root
        ref={ref}
        id={id}
        className={['auvora-switch', className].filter(Boolean).join(' ')}
        {...rest}
      >
        <SwitchPrimitive.Thumb className="auvora-switch__thumb" />
      </SwitchPrimitive.Root>
    );

    if (!label) return control;

    return (
      <label className="auvora-radio" htmlFor={id}>
        {control}
        <span>{label}</span>
      </label>
    );
  },
);
