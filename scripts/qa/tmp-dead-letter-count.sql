SELECT q.status, m.channel, COUNT(*)::int AS count
FROM notification_queue_items q
JOIN notification_messages m ON m.id = q."messageId"
GROUP BY q.status, m.channel
ORDER BY m.channel, q.status;
