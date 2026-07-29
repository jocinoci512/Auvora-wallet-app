'use client';

import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import type { ComponentPropsWithoutRef, ElementRef, ReactElement, ReactNode } from 'react';
import { forwardRef } from 'react';

export type RadioGroupProps = ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>;

export const RadioGroup = forwardRef<ElementRef<typeof RadioGroupPrimitive.Root>, RadioGroupProps>(
  function RadioGroup({ className, ...rest }, ref): ReactElement {
    const classes = ['auvora-radio-group', className].filter(Boolean).join(' ');
    return <RadioGroupPrimitive.Root ref={ref} className={classes} {...rest} />;
  },
);

export interface RadioProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> {
  label?: ReactNode;
}

export const Radio = forwardRef<ElementRef<typeof RadioGroupPrimitive.Item>, RadioProps>(
  function Radio({ className, label, id, value, ...rest }, ref): ReactElement {
    const control = (
      <RadioGroupPrimitive.Item
        ref={ref}
        id={id}
        value={value}
        className={['auvora-radio__item', className].filter(Boolean).join(' ')}
        {...rest}
      >
        <RadioGroupPrimitive.Indicator className="auvora-radio__indicator" />
      </RadioGroupPrimitive.Item>
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
