import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AVATAR_MAX_BYTES,
  POST_MEDIA_MAX_BYTES,
  extensionForMime,
  validateAvatarFile,
  validatePostMediaFiles,
} from '../src/features/storage/mediaModel';

type TestFile = { name:string; type:string; size:number };
const file = (name:string, type:string, size:number):TestFile => ({ name, type, size });

test('post media accepts JPEG/PNG/WebP up to five files and 5 MiB each', () => {
  const files = [
    file('one.jpg', 'image/jpeg', POST_MEDIA_MAX_BYTES),
    file('two.png', 'image/png', 1024),
    file('three.webp', 'image/webp', 2048),
  ];
  assert.equal(validatePostMediaFiles(files), null);
  assert.equal(validatePostMediaFiles([file('exact.webp', 'image/webp', 5 * 1024 * 1024)]), null);
});

test('post media rejects sixth image, oversized file and unsupported/HEIC input', () => {
  const six = Array.from({ length:6 }, (_, index) => file(`${index}.jpg`, 'image/jpeg', 32));
  assert.match(validatePostMediaFiles(six) ?? '', /5 ảnh/i);
  assert.match(validatePostMediaFiles([file('large.png', 'image/png', POST_MEDIA_MAX_BYTES + 1)]) ?? '', /5 MiB/i);
  assert.match(validatePostMediaFiles([file('phone.heic', 'image/heic', 1024)]) ?? '', /JPEG.*PNG.*WebP/i);
  assert.match(validatePostMediaFiles([file('vector.svg', 'image/svg+xml', 1024)]) ?? '', /JPEG.*PNG.*WebP/i);
});

test('existing post media count participates in the five-image limit', () => {
  const twoNew = [file('a.jpg', 'image/jpeg', 100), file('b.jpg', 'image/jpeg', 100)];
  assert.equal(validatePostMediaFiles(twoNew, 3), null);
  assert.match(validatePostMediaFiles(twoNew, 4) ?? '', /5 ảnh/i);
});

test('avatar accepts exact 3 MiB supported image and rejects larger/unsupported input', () => {
  assert.equal(validateAvatarFile(file('avatar.png', 'image/png', AVATAR_MAX_BYTES)), null);
  assert.match(validateAvatarFile(file('avatar.png', 'image/png', AVATAR_MAX_BYTES + 1)) ?? '', /3 MiB/i);
  assert.match(validateAvatarFile(file('avatar.gif', 'image/gif', 1024)) ?? '', /JPEG.*PNG.*WebP/i);
});

test('stored extension is derived only from the accepted MIME type', () => {
  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('image/png'), 'png');
  assert.equal(extensionForMime('image/webp'), 'webp');
  assert.throws(() => extensionForMime('image/heic'), /MEDIA_MIME_UNSUPPORTED/);
});
