UPDATE notification_templates
SET subject = 'Identity verification approved',
    body = 'Your identity verification has been approved.',
    updated_at = NOW()
WHERE code = 'kyc.approved' AND channel = 'IN_APP';

UPDATE notification_templates
SET subject = 'Transaction pending review',
    body = 'Your transaction is pending review.',
    updated_at = NOW()
WHERE code = 'transaction.review_pending' AND channel = 'IN_APP';

UPDATE notification_templates
SET subject = 'Transaction approved',
    body = 'Your transaction has been approved.',
    updated_at = NOW()
WHERE code = 'transaction.review_approved' AND channel = 'IN_APP';

UPDATE notification_templates
SET subject = 'Transaction declined',
    body = 'Your transaction was declined. Reason: {{reason}}.',
    updated_at = NOW()
WHERE code = 'transaction.review_rejected' AND channel = 'IN_APP';

SELECT code, channel, subject
FROM notification_templates
WHERE code IN (
  'kyc.approved',
  'transaction.review_pending',
  'transaction.review_approved',
  'transaction.review_rejected'
)
ORDER BY code, channel;
