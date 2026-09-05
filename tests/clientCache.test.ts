import assert from 'node:assert/strict';
import test from 'node:test';
import { ClientCache } from '../src/lib/cache/clientCache';

test('ClientCache: set and get returns cached value before expiration', () => {
  ClientCache.set('test_key_1', { hello: 'world' }, 5000, 'memory');
  const cached = ClientCache.get<{ hello: string }>('test_key_1', 'memory');
  assert.deepEqual(cached, { hello: 'world' });
});

test('ClientCache: get returns null after TTL expiration', async () => {
  ClientCache.set('test_key_expire', { val: 123 }, 50, 'memory');
  assert.deepEqual(ClientCache.get('test_key_expire', 'memory'), { val: 123 });

  await new Promise((resolve) => setTimeout(resolve, 70));
  assert.equal(ClientCache.get('test_key_expire', 'memory'), null);

  // getRaw should still retrieve the expired entry with metadata
  const raw = ClientCache.getRaw<{ val: number }>('test_key_expire', 'memory');
  assert.ok(raw !== null);
  assert.equal(raw?.data.val, 123);
});

test('ClientCache: invalidate removes key', () => {
  ClientCache.set('test_key_inv', 'alpha', 5000, 'memory');
  assert.equal(ClientCache.get('test_key_inv', 'memory'), 'alpha');

  ClientCache.invalidate('test_key_inv', 'memory');
  assert.equal(ClientCache.get('test_key_inv', 'memory'), null);
});

test('ClientCache: invalidatePattern removes all keys matching prefix', () => {
  ClientCache.set('prefix_item_1', 'one', 5000, 'memory');
  ClientCache.set('prefix_item_2', 'two', 5000, 'memory');
  ClientCache.set('other_item_3', 'three', 5000, 'memory');

  ClientCache.invalidatePattern('prefix_item_');
  assert.equal(ClientCache.get('prefix_item_1', 'memory'), null);
  assert.equal(ClientCache.get('prefix_item_2', 'memory'), null);
  assert.equal(ClientCache.get('other_item_3', 'memory'), 'three');
});

test('ClientCache: fetchWithCache reuses cached data without re-invoking fetcher', async () => {
  let callCount = 0;
  const fetcher = async () => {
    callCount++;
    return { count: callCount };
  };

  const res1 = await ClientCache.fetchWithCache('test_fetcher_key', fetcher, 5000, 'memory');
  assert.deepEqual(res1, { count: 1 });
  assert.equal(callCount, 1);

  const res2 = await ClientCache.fetchWithCache('test_fetcher_key', fetcher, 5000, 'memory');
  assert.deepEqual(res2, { count: 1 });
  assert.equal(callCount, 1);
});

test('ClientCache: fetchWithSWR returns stale data immediately and revalidates in background', async () => {
  let fetchCount = 0;
  const fetcher = async () => {
    fetchCount++;
    return 'payload-v' + fetchCount;
  };

  // Initial fetch
  const initial = await ClientCache.fetchWithSWR('test_swr_key', fetcher, {
    ttlMs: 40,
    maxStaleAgeMs: 5000,
    tier: 'memory',
  });
  assert.equal(initial, 'payload-v1');
  assert.equal(fetchCount, 1);

  // Wait for it to become stale
  await new Promise((resolve) => setTimeout(resolve, 60));

  let revalidatedValue: string | null = null;
  const stale = await ClientCache.fetchWithSWR('test_swr_key', fetcher, {
    ttlMs: 5000,
    maxStaleAgeMs: 5000,
    tier: 'memory',
    onRevalidate: (fresh) => {
      revalidatedValue = fresh;
    },
  });

  // Stale value is returned immediately (0ms)
  assert.equal(stale, 'payload-v1');

  // Background fetch should have fired
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(revalidatedValue, 'payload-v2');
  assert.equal(fetchCount, 2);

  // Next get should reflect the freshly cached value
  const latest = ClientCache.get<string>('test_swr_key', 'memory');
  assert.equal(latest, 'payload-v2');
});
