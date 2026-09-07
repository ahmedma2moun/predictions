/** Validate before migrations, Prisma access, or truncation; never echo credentials. */
export function assertLocalTestDatabase(env: NodeJS.ProcessEnv = process.env): void {
  const urls = ['DATABASE_URL', 'DIRECT_URL'].map(key => {
    let url: URL;
    try { url = new URL(env[key] ?? ''); } catch { throw new Error(`${key} must point to an isolated local test database`); }
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !/^\/[a-zA-Z0-9_]+_test$/.test(url.pathname) || !['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error(`${key} must point to localhost and a database ending in _test`);
    return url;
  });
  if (urls[0].host !== urls[1].host || urls[0].pathname !== urls[1].pathname) throw new Error('Test pooled and direct URLs must select the same database');
}
