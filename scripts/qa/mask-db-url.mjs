import fs from 'node:fs';
const t = fs.readFileSync('D:/auvora-wallet/.env', 'utf8');
const m = t.match(/^DATABASE_URL=(.*)$/m);
if (!m) {
  console.log('DATABASE_URL=MISSING');
  process.exit(0);
}
let u = m[1].trim().replace(/^['"]|['"]$/g, '');
try {
  const x = new URL(u);
  console.log(`DATABASE_URL=${x.protocol}//${x.hostname}:${x.port || '(default)'}${x.pathname}`);
} catch {
  console.log('DATABASE_URL=PARSE_FAIL');
}
const r = t.match(/^REDIS_URL=(.*)$/m);
if (r) {
  let ru = r[1].trim().replace(/^['"]|['"]$/g, '');
  try {
    const x = new URL(ru);
    console.log(`REDIS_URL=${x.protocol}//${x.hostname}:${x.port || '(default)'}`);
  } catch {
    console.log('REDIS_URL=PARSE_FAIL');
  }
}
