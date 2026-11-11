/** Explicit extra loopback origins for local preview; production origins remain separately configured. */
export function devOrigins(extra = process.env.NOREN_DEV_ORIGINS ?? ''): Set<string> {
  const origins = new Set(['http://localhost:5190', 'http://127.0.0.1:5190']);
  for (const value of extra.split(',').map((s) => s.trim()).filter(Boolean)) {
    try {
      const url = new URL(value);
      if (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)
        && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) origins.add(url.origin);
    } catch { /* Invalid origins are never granted browser access. */ }
  }
  return origins;
}
