export type StorageTier = 'local' | 'session' | 'memory';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  cachedAt: number;
}

const memoryStore = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes default
const CACHE_PREFIX = 'edushare_cache_v3_';

function getStorage(tier: StorageTier): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    if (tier === 'local' && window.localStorage) return window.localStorage;
    if (tier === 'session' && window.sessionStorage) return window.sessionStorage;
  } catch {
    // Storage access restricted (e.g. private browsing mode)
  }
  return null;
}

function purgeExpiredFromStorage(storage: Storage): void {
  try {
    const keysToRemove: string[] = [];
    const now = Date.now();
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(CACHE_PREFIX)) {
        try {
          const item = JSON.parse(storage.getItem(k) || '{}') as CacheEntry<unknown>;
          if (item.expiresAt && item.expiresAt < now) {
            keysToRemove.push(k);
          }
        } catch {
          keysToRemove.push(k);
        }
      }
    }
    keysToRemove.forEach((k) => storage.removeItem(k));
  } catch {
    // Ignore purge errors
  }
}

export class ClientCache {
  /**
   * Retrieve cached data if present and not expired.
   */
  static get<T>(key: string, tier: StorageTier = 'session'): T | null {
    const memEntry = memoryStore.get(key) as CacheEntry<T> | undefined;
    if (memEntry && memEntry.expiresAt > Date.now()) {
      return memEntry.data;
    }

    const storage = getStorage(tier);
    if (storage) {
      try {
        const raw = storage.getItem(`${CACHE_PREFIX}${key}`);
        if (raw) {
          const parsed = JSON.parse(raw) as CacheEntry<T>;
          if (parsed.expiresAt > Date.now()) {
            memoryStore.set(key, parsed);
            return parsed.data;
          }
          storage.removeItem(`${CACHE_PREFIX}${key}`);
        }
      } catch {
        // Storage parsing error
      }
    }

    return null;
  }

  /**
   * Get raw entry including metadata, even if expired (used for SWR).
   */
  static getRaw<T>(key: string, tier: StorageTier = 'session'): CacheEntry<T> | null {
    const memEntry = memoryStore.get(key) as CacheEntry<T> | undefined;
    if (memEntry) return memEntry;

    const storage = getStorage(tier);
    if (storage) {
      try {
        const raw = storage.getItem(`${CACHE_PREFIX}${key}`);
        if (raw) {
          return JSON.parse(raw) as CacheEntry<T>;
        }
      } catch {
        // Ignore
      }
    }
    return null;
  }

  /**
   * Store data in cache with TTL and specific storage tier.
   */
  static set<T>(
    key: string,
    data: T,
    ttlMs: number = DEFAULT_TTL_MS,
    tier: StorageTier = 'session'
  ): void {
    const now = Date.now();
    const entry: CacheEntry<T> = {
      data,
      expiresAt: now + ttlMs,
      cachedAt: now,
    };

    memoryStore.set(key, entry);

    const storage = getStorage(tier);
    if (storage) {
      try {
        storage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
      } catch {
        // Quota full: purge expired items and retry once
        purgeExpiredFromStorage(storage);
        try {
          storage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(entry));
        } catch {
          // Still full, rely only on memoryStore
        }
      }
    }
  }

  /**
   * Remove cached item across memory and storage tiers.
   */
  static invalidate(key: string, tier?: StorageTier): void {
    memoryStore.delete(key);

    const tiers: StorageTier[] = tier ? [tier] : ['session', 'local'];
    tiers.forEach((t) => {
      const storage = getStorage(t);
      if (storage) {
        try {
          storage.removeItem(`${CACHE_PREFIX}${key}`);
        } catch {
          // Ignore
        }
      }
    });
  }

  /**
   * Invalidate all keys matching a prefix.
   */
  static invalidatePattern(prefix: string): void {
    const fullPrefix = `${CACHE_PREFIX}${prefix}`;

    for (const key of memoryStore.keys()) {
      if (key.startsWith(prefix)) {
        memoryStore.delete(key);
      }
    }

    ['session', 'local'].forEach((t) => {
      const storage = getStorage(t as StorageTier);
      if (storage) {
        try {
          const toRemove: string[] = [];
          for (let i = 0; i < storage.length; i++) {
            const k = storage.key(i);
            if (k && (k.startsWith(fullPrefix) || k.startsWith(`${CACHE_PREFIX}${prefix}`))) {
              toRemove.push(k);
            }
          }
          toRemove.forEach((k) => storage.removeItem(k));
        } catch {
          // Ignore
        }
      }
    });
  }

  /**
   * Retrieve from cache or execute async fetcher and cache result.
   */
  static async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number = DEFAULT_TTL_MS,
    tier: StorageTier = 'session'
  ): Promise<T> {
    const cached = ClientCache.get<T>(key, tier);
    if (cached !== null) {
      return cached;
    }

    const data = await fetcher();
    ClientCache.set<T>(key, data, ttlMs, tier);
    return data;
  }

  /**
   * Stale-While-Revalidate pattern:
   * Returns cached data immediately (even if expired up to maxStaleAgeMs) to keep UI 0ms responsive,
   * while revalidating from network in the background and notifying onRevalidate.
   */
  static async fetchWithSWR<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: {
      ttlMs?: number;
      maxStaleAgeMs?: number;
      tier?: StorageTier;
      onRevalidate?: (freshData: T) => void;
    }
  ): Promise<T> {
    const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
    const maxStaleAgeMs = options?.maxStaleAgeMs ?? 24 * 60 * 60 * 1000; // 24 hours stale window
    const tier = options?.tier ?? 'session';

    const raw = ClientCache.getRaw<T>(key, tier);
    const now = Date.now();

    if (raw) {
      const isFresh = raw.expiresAt > now;
      const isAcceptablyStale = now - raw.expiresAt < maxStaleAgeMs;

      if (isFresh) {
        return raw.data;
      }

      if (isAcceptablyStale) {
        // Trigger background revalidation
        fetcher()
          .then((fresh) => {
            ClientCache.set<T>(key, fresh, ttlMs, tier);
            options?.onRevalidate?.(fresh);
          })
          .catch((err) => {
            console.warn(`SWR revalidation failed for ${key}:`, err);
          });

        return raw.data;
      }
    }

    // No usable cache, fetch directly
    const data = await fetcher();
    ClientCache.set<T>(key, data, ttlMs, tier);
    return data;
  }
}
