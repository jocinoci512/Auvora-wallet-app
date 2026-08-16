'use client';

import type { ReactElement } from 'react';
import type { ToastTone } from '../../lib/settings/use-timed-toast';
import '../../app/consumer.css';

export function FeedbackToast({
  message,
  tone = 'info',
}: {
  message: string;
  tone?: ToastTone;
}): ReactElement {
  return (
    <div className={`as-toast as-toast--${tone === 'warn' ? 'warn' : tone}`} role="status">
      {message}
    </div>
  );
}
