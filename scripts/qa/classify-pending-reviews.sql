SELECT
  id,
  status,
  source_type,
  amount::text AS amount,
  amount_usd_cents,
  requested_at,
  LEFT(COALESCE(metadata::text, ''), 240) AS meta
FROM large_transfer_reviews
WHERE owner_user_id = 'df1db712-5e50-42c1-92fc-2c7236244cf8'
  AND source_type = 'USER_TRANSFER'
ORDER BY requested_at DESC;
