-- LOCAL QA ONLY. Expire obsolete PENDING USER_TRANSFER reviews.
-- Keep the current intentional $10,000.01 QA review.
-- Do not delete rows or audit events.

UPDATE large_transfer_reviews
SET
  status = 'EXPIRED',
  decision_at = NOW(),
  decision_reason = 'Superseded by a later QA review. Audit history preserved.'
WHERE owner_user_id = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
  AND source_type = 'USER_TRANSFER'
  AND status = 'PENDING'
  AND id <> 'a4553c3b-a05c-40cd-84e6-cfce724214c3';

SELECT status, COUNT(*)
FROM large_transfer_reviews
WHERE owner_user_id = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
  AND source_type = 'USER_TRANSFER'
GROUP BY status
ORDER BY status;

SELECT id, status, amount_usd_cents, requested_at
FROM large_transfer_reviews
WHERE owner_user_id = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
  AND source_type = 'USER_TRANSFER'
  AND status = 'PENDING';
