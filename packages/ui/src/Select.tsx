'use client';

import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef, ReactElement, ReactNode } from 'react';
import { forwardRef } from 'react';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<
  ElementRef<typeof SelectPrimitive.Trigger>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { invalid?: boolean }
>(function SelectTrigger({ className, children, invalid, ...rest }, ref): ReactElement {
  const classes = ['auvora-select-trigger', className].filter(Boolean).join(' ');
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={classes}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
      <SelectPrimitive.Icon>
        <ChevronDown size={16} aria-hidden />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
});

export const SelectContent = forwardRef<
  ElementRef<typeof SelectPrimitive.Content>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(function SelectContent({ className, children, position = 'popper', ...rest }, ref): ReactElement {
  const classes = ['auvora-select-content', className].filter(Boolean).join(' ');
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content ref={ref} className={classes} position={position} {...rest}>
        <SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});

export const SelectItem = forwardRef<
  ElementRef<typeof SelectPrimitive.Item>,
  ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(function SelectItem({ className, children, ...rest }, ref): ReactElement {
  const classes = ['auvora-select-item', className].filter(Boolean).join(' ');
  return (
    <SelectPrimitive.Item ref={ref} className={classes} {...rest}>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator>
        <Check size={14} aria-hidden />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
});

export interface SelectFieldProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  options: Array<{ value: string; label: ReactNode; disabled?: boolean }>;
  invalid?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
}

/** Convenience composed select for common form use */
export function SelectField({
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Select…',
  options,
  invalid,
  disabled,
  name,
  id,
}: SelectFieldProps): ReactElement {
  return (
    <Select
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      name={name}
    >
      <SelectTrigger id={id} invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
