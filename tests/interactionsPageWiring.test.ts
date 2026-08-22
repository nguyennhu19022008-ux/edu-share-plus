import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const detail = readFileSync('src/pages/DetailPage.tsx', 'utf8');
const profile = readFileSync('src/pages/ProfilePage.tsx', 'utf8');
const myDetail = readFileSync('src/pages/MyDetailPage.tsx', 'utf8');
const interactionModel = readFileSync('src/features/interactions/interactionModel.ts', 'utf8');
const interactionService = readFileSync('src/features/interactions/interactionService.ts', 'utf8');
const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

test('Phase 5G pages contain no favorite, comment, or contact simulation leftovers', () => {
  assert.doesNotMatch(detail, /LOCAL_UI_COMMENTS|mô phỏng local.*liên hệ|profile\.setPostSaved/si);
  assert.doesNotMatch(profile, /Danh sách yêu thích chưa được hiển thị ở đây/);
  assert.doesNotMatch(myDetail, /yêu cầu liên hệ.*Phase 5G/i);
  assert.match(detail, /Báo cáo[\s\S]*Phase 5H|Phase 5H[\s\S]*Báo cáo/si, 'reports must remain explicitly deferred to Phase 5H');
});

test('browser interaction source contains no privileged secret, browser persistence, or private-profile read', () => {
  const source = `${interactionModel}\n${interactionService}`;
  for (const forbidden of [
    /service_role/i,
    /SUPABASE_SERVICE_ROLE/i,
    /localStorage/,
    /sessionStorage/,
    /profile_private/i,
  ]) {
    assert.doesNotMatch(source, forbidden, `interaction browser source must not contain ${forbidden}`);
  }
});

test('self-hosted CI runs the Phase 5G backend suites as one explicit interaction matrix', () => {
  assert.match(workflow, /name:\s*Phase 5G interactions\/contact matrix/);
  assert.match(workflow, /node tests\/favoritesBackend\.e2e\.mjs/);
  assert.match(workflow, /node tests\/commentsBackend\.e2e\.mjs/);
  assert.match(workflow, /node tests\/contactBackend\.e2e\.mjs/);
  assert.doesNotMatch(workflow, /name:\s*Phase 5G favorites matrix/);
  assert.doesNotMatch(workflow, /name:\s*Phase 5G comments matrix/);
  assert.doesNotMatch(workflow, /name:\s*Phase 5G contact matrix/);
  assert.match(workflow, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/, 'same-repository PR safety guard must remain');
  assert.match(workflow, /npx supabase stop --no-backup/, 'local Supabase cleanup must remain');
});
