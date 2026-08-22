import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('src/features/interactions/interactionService.ts', 'utf8');

test('interaction service uses the live favorites table and trusted 5G RPC boundary', () => {
  assert.match(source, /\.from\(['"]favorites['"]\)/);
  assert.match(source, /\.rpc\(['"]list_my_saved_posts['"]/);
  assert.match(source, /\.rpc\(['"]list_post_comments['"]/);
  assert.match(source, /\.rpc\(['"]create_my_comment['"]/);
  assert.match(source, /\.rpc\(['"]delete_my_comment['"]/);
  assert.match(source, /\.rpc\(['"]reveal_post_contact['"]/);
  assert.match(source, /\.rpc\(['"]list_my_post_contact_events['"]/);
});

test('interaction service derives favorite identity from Auth and never accesses private PII directly', () => {
  assert.match(source, /auth\.getUser\s*\(/);
  assert.match(source, /user_id\s*:\s*user\.id/);
  assert.match(source, /post_id\s*:\s*normalizedId/);
  assert.match(source, /error\.code\s*===\s*['"]23505['"]/);
  assert.doesNotMatch(source, /profile_private|service_role|localStorage|sessionStorage|getPublicUrl/);
});

test('interaction service parses every trusted response before returning it', () => {
  for (const parser of [
    'parseSavedPostListResponse',
    'parseCommentListResponse',
    'parseCommentMutationResponse',
    'parseCommentDeleteResponse',
    'parseContactRevealResponse',
    'parseOwnerContactHistoryResponse',
  ]) {
    assert.match(source, new RegExp(`${parser}\\s*\\(`));
  }
});

test('contact error mapping handles method-change cooldown without logging revealed values', () => {
  assert.match(source, /EDU_SHARE_CONTACT_METHOD_CHANGED_DURING_DEDUPE/);
  assert.doesNotMatch(source, /console\.(log|error|warn)|JSON\.stringify\s*\(\s*data/);
});
