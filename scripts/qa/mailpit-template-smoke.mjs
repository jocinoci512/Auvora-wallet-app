/**
 * LOCAL QA ONLY — enqueue a few Notifications EMAIL+IN_APP events via Gateway/internal
 * where possible, else direct notifications health + Mailpit bridge verification.
 *
 * Does not expose secrets. Does not touch production.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

async function mailpitCount() {
  const res = await fetch('http://127.0.0.1:8025/api/v1/messages');
  if (!res.ok) throw new Error(`mailpit ${res.status}`);
  const json = await res.json();
  return json.total ?? 0;
}

async function bridgeSend(subject, body) {
  const res = await fetch('http://127.0.0.1:3099/send', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      recipient: 'qa@auvora.local',
      subject,
      body,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(JSON.stringify(json));
  return json;
}

const cases = [
  ['Auvora QA · Verification approved', 'Your identity verification was approved. LOCAL QA ONLY.'],
  [
    'Auvora QA · Verification not approved',
    'Verification was not approved. Reason: Please resubmit a clearer document.',
  ],
  ['Auvora QA · Transaction pending review', 'Your transaction is pending review. LOCAL QA ONLY.'],
  ['Auvora QA · Transaction approved', 'Your transaction has been approved. LOCAL QA ONLY.'],
  [
    'Auvora QA · Transaction declined',
    'Your transaction was declined. Reason: Additional information is required.',
  ],
];

const before = await mailpitCount();
for (const [subject, body] of cases) {
  await bridgeSend(subject, body);
}
// small wait for Mailpit index
await new Promise((r) => setTimeout(r, 500));
const after = await mailpitCount();
console.log(
  JSON.stringify(
    { before, after, sent: cases.length, ok: after >= before + cases.length },
    null,
    2,
  ),
);
