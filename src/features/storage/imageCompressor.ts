export interface ImageCompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

const DEFAULT_MAX_WIDTH = 1440;
const DEFAULT_MAX_HEIGHT = 1440;
const DEFAULT_QUALITY = 0.82;

/**
 * Compresses an image file on the client before upload using HTML5 Canvas.
 * Automatically downscales oversized photos and converts to WebP/JPEG to save bandwidth and storage.
 * If compression fails or produces a larger file, returns the original file safely.
 */
export async function compressImageFile(
  file: File,
  options: ImageCompressOptions = {}
): Promise<File> {
  // If not an image or SVG/GIF, return as-is
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return file;
  }

  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
  const maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT;
  const quality = options.quality ?? DEFAULT_QUALITY;
  const targetMime = options.mimeType || (supportsWebp() ? 'image/webp' : 'image/jpeg');

  try {
    const bitmap = await createImageBitmapSafely(file);
    if (!bitmap) return file;

    const origWidth = 'width' in bitmap ? bitmap.width : (bitmap as HTMLImageElement).naturalWidth;
    const origHeight = 'height' in bitmap ? bitmap.height : (bitmap as HTMLImageElement).naturalHeight;

    // Calculate scaled dimensions while preserving aspect ratio
    let targetWidth = origWidth;
    let targetHeight = origHeight;

    if (targetWidth > maxWidth || targetHeight > maxHeight) {
      const ratio = Math.min(maxWidth / targetWidth, maxHeight / targetHeight);
      targetWidth = Math.round(targetWidth * ratio);
      targetHeight = Math.round(targetHeight * ratio);
    }

    // If dimensions did not change and file is already tiny (< 200KB), return original
    if (targetWidth === origWidth && targetHeight === origHeight && file.size < 200 * 1024) {
      if (typeof (bitmap as any).close === 'function') (bitmap as any).close();
      return file;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d', { alpha: targetMime === 'image/webp' });
    if (!ctx) {
      if (typeof (bitmap as any).close === 'function') (bitmap as any).close();
      return file;
    }

    ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetWidth, targetHeight);
    if (typeof (bitmap as any).close === 'function') (bitmap as any).close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), targetMime, quality);
    });

    if (!blob || blob.size === 0) {
      return file;
    }

    // Only use compressed result if it is actually smaller than the original
    if (blob.size >= file.size) {
      return file;
    }

    const extension = targetMime === 'image/webp' ? '.webp' : '.jpg';
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const newFileName = `${baseName}${extension}`;

    return new File([blob], newFileName, {
      type: targetMime,
      lastModified: Date.now(),
    });
  } catch {
    // Graceful fallback to original file if canvas/bitmap fails
    return file;
  }
}

function supportsWebp(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    return false;
  }
}

async function createImageBitmapSafely(file: File): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
    try {
      return await window.createImageBitmap(file);
    } catch {
      // Fallback to Image element
    }
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
