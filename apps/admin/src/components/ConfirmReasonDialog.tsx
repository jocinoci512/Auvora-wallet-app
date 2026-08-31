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
  showInternalNote = false,
  customerReasonLabel = 'Reason',
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  showInternalNote?: boolean;
  customerReasonLabel?: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string, internalNote?: string) => Promise<void> | void;
}): ReactElement {
  const [reason, setReason] = useState('');
  const [internalNote, setInternalNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const ready = reason.trim().length >= 8;

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!ready) {
      setError('Enter a reason of at least 8 characters.');
      return;
    }
    setError(null);
    await onConfirm(reason.trim(), internalNote.trim() || undefined);
    setReason('');
    setInternalNote('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason('');
          setInternalNote('');
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent aria-describedby="confirm-reason-copy">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription id="confirm-reason-copy">{description}</DialogDescription>
        <form className="admin-confirm-form" onSubmit={(event) => void submit(event)}>
          <Field
            label={customerReasonLabel}
            hint="Shown to the customer. Minimum 8 characters. Never include internal notes here."
          >
            <Textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={8}
              rows={4}
              autoFocus
            />
          </Field>
          {showInternalNote ? (
            <Field
              label="Internal Admin note (optional)"
              hint="Visible only to operators. Never sent in customer email or in-app notifications."
            >
              <Textarea
                value={internalNote}
                onChange={(event) => setInternalNote(event.target.value)}
                rows={3}
              />
            </Field>
          ) : null}
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
