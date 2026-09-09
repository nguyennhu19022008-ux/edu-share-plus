/**
 * Helper to safely create and revoke object URLs for local client-side image previews
 * without polluting page component source files.
 */
export function createPreviewUrl(file: File): string {
  if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }
  return '';
}

export function revokePreviewUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}
