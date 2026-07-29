'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ComponentPropsWithoutRef, ElementRef, ReactElement, ReactNode } from 'react';
import { forwardRef } from 'react';
import { IconButton } from './IconButton';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { showClose?: boolean }
>(function DialogContent({ className, children, showClose = true, ...rest }, ref): ReactElement {
  const classes = ['auvora-dialog-content', className].filter(Boolean).join(' ');
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="auvora-dialog-overlay" />
      <DialogPrimitive.Content ref={ref} className={classes} {...rest}>
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton
              label="Close"
              className="auvora-dialog-close"
              style={{ position: 'absolute', top: '0.75rem', right: '0.75rem' }}
            >
              <X size={16} />
            </IconButton>
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
});

export function DialogTitle({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Title>): ReactElement {
  const classes = ['auvora-dialog-title', className].filter(Boolean).join(' ');
  return <DialogPrimitive.Title className={classes} {...rest} />;
}

export function DialogDescription({
  className,
  ...rest
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Description>): ReactElement {
  const classes = ['auvora-dialog-description', className].filter(Boolean).join(' ');
  return <DialogPrimitive.Description className={classes} {...rest} />;
}

export function DialogActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}): ReactElement {
  const classes = ['auvora-dialog-actions', className].filter(Boolean).join(' ');
  return <div className={classes}>{children}</div>;
}

/** Drawer uses Dialog primitives with side panel styling */
export function DrawerContent({
  className,
  children,
  showClose = true,
  ...rest
}: ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showClose?: boolean;
}): ReactElement {
  const classes = ['auvora-drawer-content', className].filter(Boolean).join(' ');
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="auvora-drawer-overlay" />
      <DialogPrimitive.Content className={classes} {...rest}>
        {showClose ? (
          <DialogPrimitive.Close asChild>
            <IconButton label="Close" style={{ float: 'right' }}>
              <X size={16} />
            </IconButton>
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export const Drawer = Dialog;
export const DrawerTrigger = DialogTrigger;
export const DrawerClose = DialogClose;
export const DrawerTitle = DialogTitle;
export const DrawerDescription = DialogDescription;
