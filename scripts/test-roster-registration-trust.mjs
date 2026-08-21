import { spawnSync } from 'node:child_process';

const requiredEnvironment = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_DB_URL',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for the Phase 5B integration matrix`);
  }
}

const cases = [
  ['registration trust outcomes', 'tests/rosterRegistrationTrust.e2e.mjs'],
  ['school-scoped roster management', 'tests/rosterManagement.e2e.mjs'],
  ['membership-aware manual review', 'tests/membershipReview.e2e.mjs'],
  ['private roster/browser secret boundary', 'tests/rosterSecurityBoundary.e2e.mjs'],
];

for (const [label, file] of cases) {
  process.stdout.write(`\n[Phase 5B] ${label}\n`);
  const result = spawnSync(process.execPath, [file], {
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('\nPhase 5B full integration matrix PASS');
