'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ReactElement, ReactNode } from 'react';
import { cn } from './utils/cn';

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export function Tabs({ className, orientation = 'horizontal', ...props }: TabsProps): ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn('auvora-tabs', `auvora-tabs--${orientation}`, className)}
      orientation={orientation}
      {...props}
    />
  );
}

export function TabsList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <TabsPrimitive.List className={cn('auvora-tabs__list', className)}>
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  disabled,
}: {
  value: string;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}): ReactElement {
  return (
    <TabsPrimitive.Trigger
      value={value}
      disabled={disabled}
      className={cn('auvora-tabs__trigger', className)}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({
  value,
  children,
  className,
}: {
  value: string;
  children: ReactNode;
  className?: string;
}): ReactElement {
  return (
    <TabsPrimitive.Content value={value} className={cn('auvora-tabs__content', className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
