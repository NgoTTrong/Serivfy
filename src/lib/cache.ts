/**
 * In-memory TTL cache — per Fluid Compute instance. Not distributed.
 *
 * Used for read-heavy, rarely-mutated queries (menu, restaurant info) where
 * trading 10-30s of staleness for 2-5x fewer DB hits is a clear win. Hot
 * mutation paths (cart, order) do NOT use this cache.
 *
 * Pair with pulse counters for targeted invalidation: bump pulse on write
 * and invalidate the matching cache key in the same handler so the next
 * read refetches instead of serving stale data.
 */

type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();
const MAX_ENTRIES = 500;

function evictIfFull() {
  if (store.size < MAX_ENTRIES) return;
  const cutoff = Math.floor(MAX_ENTRIES * 0.1);
  let i = 0;
  for (const k of store.keys()) {
    store.delete(k);
    if (++i >= cutoff) break;
  }
}

export function cacheGet<T>(key: string): T | null {
  const hit = store.get(key) as Entry<T> | undefined;
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number) {
  evictIfFull();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string) {
  store.delete(key);
}

export function cacheDeleteByPrefix(prefix: string) {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/**
 * Read-through helper: return cached value or compute + cache.
 * Concurrent callers with the same key dedupe via the in-flight promise map.
 */
const inflight = new Map<string, Promise<unknown>>();

export async function cacheOrCompute<T>(
  key: string,
  ttlMs: number,
  compute: () => Promise<T>,
): Promise<T> {
  const cached = cacheGet<T>(key);
  if (cached !== null) return cached;

  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = compute()
    .then((value) => {
      cacheSet(key, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}
