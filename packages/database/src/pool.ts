/**
 * Append Prisma/Postgres pool parameters for production concurrency.
 * Existing query params are preserved; pool keys are only set when missing.
 */
export type DatabasePoolOptions = {
  connectionLimit?: number;
  poolTimeout?: number;
  connectTimeout?: number;
  statementCacheSize?: number;
};

export function withDatabaseUrlPool(
  databaseUrl: string,
  options: DatabasePoolOptions = {},
): string {
  const url = new URL(databaseUrl);
  const connectionLimit = options.connectionLimit ?? 10;
  const poolTimeout = options.poolTimeout ?? 10;
  const connectTimeout = options.connectTimeout ?? 5;
  const statementCacheSize = options.statementCacheSize ?? 100;

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', String(connectionLimit));
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', String(poolTimeout));
  }
  if (!url.searchParams.has('connect_timeout')) {
    url.searchParams.set('connect_timeout', String(connectTimeout));
  }
  if (!url.searchParams.has('statement_cache_size')) {
    url.searchParams.set('statement_cache_size', String(statementCacheSize));
  }
  return url.toString();
}

export function applyDatabasePoolEnv(
  env: NodeJS.ProcessEnv = process.env,
  options?: DatabasePoolOptions,
): string | undefined {
  const current = env['DATABASE_URL'];
  if (!current) {
    return undefined;
  }
  const next = withDatabaseUrlPool(current, options);
  env['DATABASE_URL'] = next;
  return next;
}
