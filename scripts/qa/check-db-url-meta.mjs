const u = new URL(process.env.DATABASE_URL);
console.log({
  user: u.username,
  passIsDockerDefault: u.password === 'auvora',
  passLen: u.password.length,
  search: u.search,
  protocol: u.protocol,
  hasAtInPass: u.password.includes('@'),
  hasHashInPass: u.password.includes('#'),
});
