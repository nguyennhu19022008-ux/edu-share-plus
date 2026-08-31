import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

test('PWA manifest.webmanifest exists and is valid', () => {
  const manifestPath = path.resolve('public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist in public folder');

  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);

  assert.equal(manifest.short_name, 'EduShare+');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, '/');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'manifest must have at least 2 icon definitions');
});

test('PWA ServiceWorker sw.js exists in public folder', () => {
  const swPath = path.resolve('public/sw.js');
  assert.ok(fs.existsSync(swPath), 'public/sw.js must exist');

  const content = fs.readFileSync(swPath, 'utf8');
  assert.ok(content.includes('CACHE_NAME'), 'sw.js must define cache name');
  assert.ok(content.includes('install'), 'sw.js must handle install event');
  assert.ok(content.includes('fetch'), 'sw.js must handle fetch event');
});
