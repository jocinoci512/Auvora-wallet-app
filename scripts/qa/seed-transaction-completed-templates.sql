-- LOCAL QA — ensure transaction.completed templates exist for device-local EVM completion events.
INSERT INTO notification_templates (id, code, name, category, channel, subject, body, created_at, updated_at)
SELECT gen_random_uuid(), 'transaction.completed', 'Transfer completed', 'TRANSACTION', 'EMAIL',
       'Your transfer is complete',
       'Hello {{name}}, your {{amount}} {{assetCode}} transfer on {{network}} is complete. Reference: {{txHash}}.',
       NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates WHERE code = 'transaction.completed' AND channel = 'EMAIL'
);

INSERT INTO notification_templates (id, code, name, category, channel, subject, body, created_at, updated_at)
SELECT gen_random_uuid(), 'transaction.completed', 'Transfer completed', 'TRANSACTION', 'IN_APP',
       'Transaction completed',
       'Your transaction has been confirmed.',
       NOW(), NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates WHERE code = 'transaction.completed' AND channel = 'IN_APP'
);
