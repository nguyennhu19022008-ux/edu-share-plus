import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const dbUrl = process.env.SUPABASE_DB_URL;
assert.ok(dbUrl, 'SUPABASE_DB_URL is required');

function sqlValue(query) {
  return execFileSync(
    'psql',
    [dbUrl, '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query],
    { encoding: 'utf8' },
  ).trim();
}

const privateObjects = [
  'student_registration_claims',
  'roster_import_batches',
  'student_roster',
  'student_roster_claims',
];

const grants = sqlValue(`
  select count(*)::text
  from information_schema.role_table_grants
  where table_schema = 'private'
    and table_name = any (array[${privateObjects.map((name) => `'${name}'`).join(',')}])
    and grantee in ('anon', 'authenticated');
`);
assert.equal(grants, '0', 'anon/authenticated must have no direct grants on private roster/claim tables');

const browserSchemaUsage = sqlValue(`
  select (
    has_schema_privilege('anon', 'private', 'USAGE')
    or has_schema_privilege('authenticated', 'private', 'USAGE')
  )::int::text;
`);
assert.equal(browserSchemaUsage, '0', 'browser roles must not have USAGE on private schema');

for (const role of ['anon', 'authenticated']) {
  for (const table of privateObjects) {
    const hasSelect = sqlValue(`select has_table_privilege('${role}', 'private.${table}', 'SELECT')::int::text;`);
    const hasInsert = sqlValue(`select has_table_privilege('${role}', 'private.${table}', 'INSERT')::int::text;`);
    const hasUpdate = sqlValue(`select has_table_privilege('${role}', 'private.${table}', 'UPDATE')::int::text;`);
    const hasDelete = sqlValue(`select has_table_privilege('${role}', 'private.${table}', 'DELETE')::int::text;`);
    assert.equal(hasSelect, '0', `${role} must not SELECT private.${table}`);
    assert.equal(hasInsert, '0', `${role} must not INSERT private.${table}`);
    assert.equal(hasUpdate, '0', `${role} must not UPDATE private.${table}`);
    assert.equal(hasDelete, '0', `${role} must not DELETE private.${table}`);
  }
}

function walkFiles(directory) {
  const output = [];
  for (const name of readdirSync(directory)) {
    const fullPath = join(directory, name);
    if (statSync(fullPath).isDirectory()) output.push(...walkFiles(fullPath));
    else output.push(fullPath);
  }
  return output;
}

const forbiddenBrowserSecretPatterns = [
  /SUPABASE_SERVICE_ROLE_KEY/,
  /service_role/i,
  /sb_secret_[A-Za-z0-9_-]+/,
];
const browserSourceViolations = [];
for (const file of walkFiles('src')) {
  const source = readFileSync(file, 'utf8');
  if (forbiddenBrowserSecretPatterns.some((pattern) => pattern.test(source))) {
    browserSourceViolations.push(relative('.', file));
  }
}
assert.deepEqual(
  browserSourceViolations,
  [],
  `browser source must not contain service-role/secret material: ${browserSourceViolations.join(', ')}`,
);

console.log('Phase 5B private roster/browser secret boundary PASS');
