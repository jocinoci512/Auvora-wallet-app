'use client';

import { useState, type FormEvent, type ReactElement } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Field,
  Textarea,
} from '@auvora/ui';

export function ConfirmReasonDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  pending = false,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => Promise<void> | void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ready = reason.trim().length >= 8;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!ready) {
      setError('Enter a reason of at least 8 characters.');
      return;
    }
    setError(null);
    await onConfirm(reason.trim());
    setReason('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby="confirm-reason-copy">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription id="confirm-reason-copy">{description}</DialogDescription>
        <form className="admin-confirm-form" onSubmit={(event) => void submit(event)}>
          <Field label="Reason" hint="Recorded in the audit log. Minimum 8 characters.">
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={8}
              rows={4}
              autoFocus
            />
          </Field>
          {error ? (
            <p className="admin-inline-error" role="alert">
              {error}
            </p>
          ) : null}
          <DialogActions>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ready || pending}>
              {pending ? 'Working…' : confirmLabel}
            </Button>
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
