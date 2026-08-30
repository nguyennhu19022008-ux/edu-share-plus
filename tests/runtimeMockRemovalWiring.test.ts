import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const mainSource = readFileSync('src/main.tsx', 'utf8');
const marketSource = readFileSync('src/pages/MarketplacePage.tsx', 'utf8');
const adminSource = readFileSync('src/pages/AdminPage.tsx', 'utf8');
const profileSource = readFileSync('src/pages/ProfilePage.tsx', 'utf8');
const detailSource = readFileSync('src/pages/DetailPage.tsx', 'utf8');
const addPostSource = readFileSync('src/pages/AddPostPage.tsx', 'utf8');
const editPostSource = readFileSync('src/pages/EditPostPage.tsx', 'utf8');
const myPostsSource = readFileSync('src/pages/MyPostsPage.tsx', 'utf8');
const myDetailSource = readFileSync('src/pages/MyDetailPage.tsx', 'utf8');

test('main.tsx no longer mounts mock repositories or DataAccessProvider', () => {
  assert.doesNotMatch(mainSource, /createMockRepositories/, 'main.tsx must not call createMockRepositories()');
  assert.doesNotMatch(mainSource, /DataAccessProvider/, 'main.tsx must not mount DataAccessProvider');
});

test('core pages do not import or use useDataAccess or mock repositories', () => {
  const pages = [
    { name: 'MarketplacePage', src: marketSource },
    { name: 'AdminPage', src: adminSource },
    { name: 'ProfilePage', src: profileSource },
    { name: 'DetailPage', src: detailSource },
    { name: 'AddPostPage', src: addPostSource },
    { name: 'EditPostPage', src: editPostSource },
    { name: 'MyPostsPage', src: myPostsSource },
    { name: 'MyDetailPage', src: myDetailSource },
  ];

  for (const { name, src } of pages) {
    assert.doesNotMatch(src, /useDataAccess/, `${name} must not import or use useDataAccess`);
    assert.doesNotMatch(src, /LOCAL_UI_SAMPLE/, `${name} must not consume LOCAL_UI_SAMPLE`);
  }
});
