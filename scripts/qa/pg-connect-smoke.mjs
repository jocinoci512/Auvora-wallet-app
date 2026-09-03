import pg from 'pg';

const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL });
try {
  await c.connect();
  const r = await c.query('select 1 as ok');
  console.log('PG_OK', r.rows);
} catch (e) {
  console.log('PG_FAIL', e instanceof Error ? e.message : String(e));
  process.exitCode = 1;
} finally {
  await c.end().catch(() => undefined);
}
