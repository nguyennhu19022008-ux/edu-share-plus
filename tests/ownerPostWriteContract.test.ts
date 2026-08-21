import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = 'supabase/migrations/20260821104000_owner_post_write_backend.sql';

test('Phase 5E migration defines structured pricing and narrow trusted owner post RPCs', () => {
  assert.ok(existsSync(migrationPath), 'Phase 5E owner post migration must exist');
  const source = readFileSync(migrationPath, 'utf8');

  for (const column of [
    'preferred_contact_method',
    'original_purchase_price',
    'original_price_is_estimate',
    'purchase_date',
    'condition_grade',
    'brand',
    'model',
  ]) {
    assert.match(source, new RegExp(`\\b${column}\\b`), `migration must define posts.${column}`);
  }

  for (const fn of ['create_my_post', 'update_my_post', 'change_my_post_lifecycle']) {
    assert.match(source, new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}`, 'i'), `${fn} must be a public trusted RPC`);
  }

  assert.match(source, /security\s+definer/gi, 'owner write RPCs must use a trusted definer boundary');
  assert.match(source, /set\s+search_path\s*=\s*''/gi, 'trusted RPCs must fix search_path');
  assert.match(source, /revoke\s+(insert|update|delete)[\s\S]*public\.posts[\s\S]*authenticated/i, 'browser direct post writes must be revoked');
  assert.doesNotMatch(source, /grant\s+(insert|update|delete)[\s\S]*public\.posts[\s\S]*authenticated/i, 'migration must not grant direct post mutations to authenticated');
});
