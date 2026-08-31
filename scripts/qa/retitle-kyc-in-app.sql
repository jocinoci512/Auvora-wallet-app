UPDATE notification_messages
SET subject = 'Identity verification approved',
    body = 'Your identity verification has been approved.'
WHERE owner_user_id = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
  AND channel = 'IN_APP'
  AND subject = 'Verification approved';

SELECT channel, subject, COUNT(*)
FROM notification_messages
WHERE owner_user_id = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
  AND (subject ILIKE '%verification approved%')
GROUP BY channel, subject;
