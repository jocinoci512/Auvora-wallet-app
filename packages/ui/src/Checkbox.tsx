'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef, ReactElement, ReactNode } from 'react';
import { forwardRef } from 'react';

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {
  label?: ReactNode;
}

export const Checkbox = forwardRef<ElementRef<typeof CheckboxPrimitive.Root>, CheckboxProps>(
  function Checkbox({ className, label, id, ...rest }, ref): ReactElement {
    const control = (
      <CheckboxPrimitive.Root
        ref={ref}
        id={id}
        className={['auvora-checkbox', className].filter(Boolean).join(' ')}
        {...rest}
      >
        <CheckboxPrimitive.Indicator className="auvora-checkbox__indicator">
          <Check size={12} strokeWidth={3} />
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
    );

    if (!label) return control;

    return (
      <label
        className="auvora-control-label"
        htmlFor={id}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
      >
        {control}
        <span>{label}</span>
      </label>
    );
  },
);
