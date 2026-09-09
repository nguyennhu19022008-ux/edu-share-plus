import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  POST_MEDIA_MAX_BYTES,
  POST_MEDIA_MAX_FILES,
  extensionForMime,
  isSupportedImageMime,
  normalizeImageMime,
  validatePostMediaFiles,
  type MediaFileLike,
} from '../src/features/storage/mediaModel';

const file = (name: string, type: string, size: number): MediaFileLike => ({ name, type, size });

test('1. Mobile camera MIME and extension normalization', () => {
  assert.equal(normalizeImageMime('image/jpg', 'photo.jpg'), 'image/jpeg');
  assert.equal(normalizeImageMime('image/pjpeg', 'photo.jpg'), 'image/jpeg');
  assert.equal(normalizeImageMime('IMAGE/JPEG', 'photo.JPG'), 'image/jpeg');
  assert.equal(normalizeImageMime('image/PNG', 'photo.PNG'), 'image/png');
  assert.equal(normalizeImageMime('IMAGE/WEBP', 'photo.WEBP'), 'image/webp');

  assert.equal(normalizeImageMime('', 'camera_shot.jpg'), 'image/jpeg');
  assert.equal(normalizeImageMime('', 'camera_shot.jpeg'), 'image/jpeg');
  assert.equal(normalizeImageMime('', 'screenshot.png'), 'image/png');
  assert.equal(normalizeImageMime('', 'converted.webp'), 'image/webp');
  assert.equal(normalizeImageMime('application/octet-stream', 'img.JPG'), 'image/jpeg');

  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('image/jpg'), 'jpg');
  assert.equal(extensionForMime('image/png'), 'png');
  assert.equal(extensionForMime('image/webp'), 'webp');
  assert.equal(extensionForMime('', 'picture.JPG'), 'jpg');
  assert.equal(extensionForMime('', 'snapshot.PNG'), 'png');
});

test('2. Post media validation: limits, sizes, counts, and HEIC feedback', () => {
  const validBatch = [
    file('math_book_cover.jpg', 'image/jpeg', 1500000),
    file('math_book_page1.png', 'image/png', 2100000),
    file('math_book_back.webp', 'image/webp', 800000),
  ];
  assert.equal(validatePostMediaFiles(validBatch), null);

  const exactFive = Array.from({ length: 5 }, (_, i) =>
    file(`img_${i}.jpg`, 'image/jpeg', 500 * 1024)
  );
  assert.equal(validatePostMediaFiles(exactFive), null);

  const sixFiles = [...exactFive, file('img_6.jpg', 'image/jpeg', 100 * 1024)];
  assert.match(validatePostMediaFiles(sixFiles) ?? '', /tối đa 5 ảnh/i);

  assert.equal(validatePostMediaFiles(validBatch, 2), null);
  assert.match(validatePostMediaFiles(validBatch, 3) ?? '', /tối đa 5 ảnh/i);

  const oversized = [file('huge_poster.png', 'image/png', 5 * 1024 * 1024 + 1)];
  assert.match(validatePostMediaFiles(oversized) ?? '', /5 MiB/i);

  const heicFile = [file('IMG_0412.HEIC', 'image/heic', 2 * 1024 * 1024)];
  assert.match(validatePostMediaFiles(heicFile) ?? '', /HEIC\/HEIF/i);

  const zeroByte = [file('empty.jpg', 'image/jpeg', 0)];
  assert.match(validatePostMediaFiles(zeroByte) ?? '', /bằng 0/i);
});

test('3. AddPostPage wiring: component renders visual preview grid, cover photo badge and calls uploadPostMedia', () => {
  const addSource = readFileSync('src/pages/AddPostPage.tsx', 'utf8');

  assert.match(addSource, /createPreviewUrl/);
  assert.match(addSource, /validatePostMediaFiles/);
  assert.match(addSource, /uploadPostMedia/);
  assert.match(addSource, /createMyPost/);
  assert.match(addSource, /upload-thumbs-grid/);
  assert.match(addSource, /upload-thumb-cover-tag/);
  assert.match(addSource, /upload-thumb-remove-btn/);
  assert.match(addSource, /uploadPostMedia\s*\(\s*result\.id\s*,\s*selectedFiles\s*\)/);
  assert.match(addSource, /navigateLegacy\(['"]myDetail['"],\s*\{\s*id\s*:\s*result\.id\s*\}\)/);
});

test('4. EditPostPage wiring: displays existing media, allows upload of additional media up to 5', () => {
  const editSource = readFileSync('src/pages/EditPostPage.tsx', 'utf8');

  assert.match(editSource, /listPostMedia/);
  assert.match(editSource, /uploadPostMedia/);
  assert.match(editSource, /removeMyPostMedia/);
  assert.match(editSource, /createPreviewUrl/);
  assert.match(editSource, /upload-thumbs-grid/);
});

test('5. DetailPage and MyDetailPage: embed interactive PostMediaGallery with lightbox', () => {
  const detailSource = readFileSync('src/pages/DetailPage.tsx', 'utf8');
  const myDetailSource = readFileSync('src/pages/MyDetailPage.tsx', 'utf8');
  const gallerySource = readFileSync('src/components/media/PostMediaGallery.tsx', 'utf8');

  assert.match(detailSource, /PostMediaGallery/);
  assert.match(myDetailSource, /PostMediaGallery/);

  assert.match(gallerySource, /media-lightbox-overlay/);
  assert.match(gallerySource, /Escape/);
  assert.match(gallerySource, /ArrowLeft/);
  assert.match(gallerySource, /ArrowRight/);
  assert.match(gallerySource, /media-lightbox-image-wrap/);
});

test('6. CSS integrity: bug .upload-preview { display: none } is permanently removed', () => {
  const baseCss = readFileSync('src/styles/legacy-base.css', 'utf8');
  const ecomCss = readFileSync('src/styles/legacy-ecommerce.css', 'utf8');

  assert.doesNotMatch(baseCss, /\.upload-preview\s*\{\s*display:\s*none;?\s*\}/, 'display:none bug must be banished');
  assert.match(ecomCss, /\.upload-zone-modern/);
  assert.match(ecomCss, /\.upload-thumbs-grid/);
  assert.match(ecomCss, /\.upload-thumb-card/);
  assert.match(ecomCss, /\.upload-thumb-cover-tag/);
  assert.match(ecomCss, /\.upload-thumb-remove-btn/);
  assert.match(ecomCss, /\.detail-interactive-gallery/);
  assert.match(ecomCss, /\.media-lightbox-overlay/);
});
