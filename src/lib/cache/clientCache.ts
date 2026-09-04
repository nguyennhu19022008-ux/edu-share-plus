interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default

export class ClientCache {
  /**
   * Retrieve cached data if present and not expired.
   */
  static get<T>(key: string): T | null {
    const memEntry = memoryStore.get(key) as CacheEntry<T> | undefined;
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.data;
    }

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const raw = window.sessionStorage.getItem(`edu_cache_${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEntry<T>;
          if (parsed.expiresAt > Date.now()) {
            memoryStore.set(key, parsed);
            return parsed.data;
          }
          window.sessionStorage.removeItem(`edu_cache_${key}`);
        }
      } catch {
        // Ignore session storage errors
      }
    }

    return null;
  }

  /**
   * Store data in cache with TTL.
   */
  static set<T>(key: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    const entry: CacheEntry<T> = {
      data,
      expiresAt: Date.now() + ttlMs,
    };

    memoryStore.set(key, entry);

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.setItem(`edu_cache_${key}`, JSON.stringify(entry));
      } catch {
        // Storage quota full or unavailable
      }
    }
  }

  /**
   * Remove cached item.
   */
  static invalidate(key: string): void {
    memoryStore.delete(key);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(`edu_cache_${key}`);
      } catch {
        // Ignore
      }
    }
  }

  /**
   * Retrieve from cache or execute async fetcher and cache result.
   */
  static async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS
  ): Promise<T> {
    const cached = ClientCache.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    ClientCache.set<T>(key, data, ttlMs);
    return data;
  }
}
