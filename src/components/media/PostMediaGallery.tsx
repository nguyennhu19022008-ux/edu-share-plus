import { useEffect, useState } from 'react';
import type { SignedMedia } from '../../features/storage/mediaModel';

export interface PostMediaGalleryProps {
  media: readonly SignedMedia[];
  mediaError?: string;
  emptyMessage?: string;
}

export default function PostMediaGallery({
  media,
  mediaError = '',
  emptyMessage = 'Bài đăng chưa có ảnh khả dụng.',
}: PostMediaGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Keep active index in bounds if media changes
  const safeIndex = Math.min(Math.max(0, activeIndex), Math.max(0, media.length - 1));
  const activeMedia = media[safeIndex] as SignedMedia | undefined;

  useEffect(() => {
    if (!lightboxOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowRight' && media.length > 1) {
        setActiveIndex((prev) => (prev + 1) % media.length);
      } else if (e.key === 'ArrowLeft' && media.length > 1) {
        setActiveIndex((prev) => (prev - 1 + media.length) % media.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxOpen, media.length]);

  if (mediaError) {
    return <div className="state error" role="alert">{mediaError}</div>;
  }

  if (!media.length || !activeMedia) {
    return <div className="state">{emptyMessage}</div>;
  }

  return (
    <section className="detail-interactive-gallery" aria-label="Thư viện ảnh bài đăng">
      {/* Main Hero View */}
      <div
        className="detail-gallery-main"
        role="button"
        tabIndex={0}
        aria-label="Nhấn để phóng to ảnh toàn màn hình"
        onClick={() => setLightboxOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setLightboxOpen(true);
          }
        }}
      >
        <img
          src={activeMedia.signedUrl}
          alt={activeMedia.altText || `Ảnh bài đăng ${safeIndex + 1}`}
          loading="eager"
          decoding="async"
        />
        <div className="detail-gallery-zoom-hint" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" />
            <line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          Phóng to ({safeIndex + 1}/{media.length})
        </div>
      </div>

      {/* Thumbnails Row */}
      {media.length > 1 ? (
        <div className="detail-gallery-thumbs-row" role="tablist" aria-label="Danh sách ảnh thu nhỏ">
          {media.map((item, idx) => {
            const isSelected = idx === safeIndex;
            return (
              <button
                key={item.fileId}
                type="button"
                role="tab"
                aria-selected={isSelected}
                aria-label={`Xem ảnh số ${idx + 1}`}
                className={`detail-gallery-thumb-btn${isSelected ? ' active' : ''}`}
                onClick={() => setActiveIndex(idx)}
              >
                <img
                  src={item.signedUrl}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Lightbox Modal */}
      {lightboxOpen ? (
        <div
          className="media-lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Xem ảnh kích thước lớn"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="media-lightbox-header" onClick={(e) => e.stopPropagation()}>
            <span className="media-lightbox-counter">
              Ảnh {safeIndex + 1} / {media.length}
            </span>
            <button
              type="button"
              className="media-lightbox-close-btn"
              aria-label="Đóng xem ảnh (hoặc bấm phím ESC)"
              onClick={() => setLightboxOpen(false)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="media-lightbox-image-wrap" onClick={(e) => e.stopPropagation()}>
            <img
              src={activeMedia.signedUrl}
              alt={activeMedia.altText || `Ảnh bài đăng ${safeIndex + 1}`}
            />
          </div>

          {media.length > 1 ? (
            <div
              style={{
                position: 'absolute',
                bottom: 24,
                display: 'flex',
                gap: 12,
                zIndex: 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="media-lightbox-close-btn"
                aria-label="Ảnh trước (Mũi tên trái)"
                onClick={() => setActiveIndex((prev) => (prev - 1 + media.length) % media.length)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                className="media-lightbox-close-btn"
                aria-label="Ảnh tiếp theo (Mũi tên phải)"
                onClick={() => setActiveIndex((prev) => (prev + 1) % media.length)}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
