#!/usr/bin/env node
/** Host Redis RESP PONG check for QA lab. */
import net from 'node:net';

const s = net.createConnection({ host: '127.0.0.1', port: 6379 });
let buf = '';
s.setTimeout(2000);
s.on('connect', () => {
  s.write(Buffer.from('*1\r\n$4\r\nPING\r\n'));
});
s.on('data', (c) => {
  buf += c.toString('utf8');
  if (buf.includes('PONG')) {
    process.stdout.write('PONG');
    s.end();
  }
});
s.on('timeout', () => {
  process.stdout.write('TIMEOUT');
  s.destroy();
  process.exitCode = 1;
});
s.on('error', () => {
  process.stdout.write('ERR');
  process.exitCode = 1;
});
s.on('close', () => {
  if (!buf.includes('PONG')) {
    process.stdout.write(buf ? `FAIL:${JSON.stringify(buf.slice(0, 40))}` : 'FAIL');
    process.exitCode = 1;
  }
});
