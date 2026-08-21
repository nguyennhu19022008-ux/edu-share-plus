import assert from 'node:assert/strict';
import test from 'node:test';
import { readSafeReturnTarget } from '../src/features/auth/session/routeAccessCore';

const knownPages = new Set(['landing', 'profile', 'index']);
const protectedPages = new Set(['profile', 'index']);

function parse(search: string, pathname = '/') {
  return readSafeReturnTarget({
    search,
    origin: 'https://app.example',
    pathname,
    isKnownPage: (page) => knownPages.has(page),
    isProtectedPage: (page) => protectedPages.has(page),
  });
}

test('accepts a same-origin protected target', () => {
  assert.equal(
    parse('?page=loginStudent&next=%2F%3Fpage%3Dprofile'),
    '/?page=profile',
  );
});

test('rejects an external-origin target', () => {
  assert.equal(
    parse(
      '?page=loginStudent&next=https%3A%2F%2Fevil.example%2F%3Fpage%3Dprofile',
    ),
    null,
  );
});

test('rejects a known but unprotected target', () => {
  assert.equal(parse('?page=loginStudent&next=%2F%3Fpage%3Dlanding'), null);
});

test('rejects a different-path target', () => {
  assert.equal(parse('?next=%2Fother%3Fpage%3Dprofile'), null);
});
