import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react';
import type { SignedMedia } from '../../features/storage/mediaModel';

export interface ImageUploadFieldProps {
  id: string;
  selectedFiles: File[];
  onFilesChanged: (files: File[]) => void;
  existingMedia?: SignedMedia[];
  onRemoveExistingMedia?: (item: SignedMedia) => void;
  removingFileId?: string;
  maxFiles?: number;
  disabled?: boolean;
  mediaError?: string;
  onClearError?: () => void;
  onError?: (msg: string) => void;
}

export default function ImageUploadField({
  id,
  selectedFiles,
  onFilesChanged,
  existingMedia = [],
  onRemoveExistingMedia,
  removingFileId = '',
  maxFiles = 5,
  disabled = false,
  mediaError = '',
  onClearError,
  onError,
}: ImageUploadFieldProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalCount = existingMedia.length + selectedFiles.length;
  const isFull = totalCount >= maxFiles;

  useEffect(() => {
    const urls = selectedFiles.map((f) => URL.createObjectURL(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  const addFiles = (incoming: File[]) => {
    if (!incoming.length) return;
    const combined = [...selectedFiles, ...incoming];
    const total = existingMedia.length + combined.length;
    if (total > maxFiles) {
      const msg = `Mỗi bài đăng được gắn tối đa ${maxFiles} ảnh. Bạn đã chọn tổng cộng ${total} ảnh.`;
      if (onError) onError(msg);
      return;
    }
    if (onClearError) onClearError();
    onFilesChanged(combined);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    addFiles(files);
    event.currentTarget.value = '';
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    if (!disabled && !isFull) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || isFull) return;
    const files = Array.from(e.dataTransfer.files ?? []);
    addFiles(files);
  };

  const removeSelected = (index: number) => {
    const next = selectedFiles.filter((_, idx) => idx !== index);
    if (onClearError) onClearError();
    onFilesChanged(next);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="field" aria-label="Khu vực tải ảnh minh họa">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <label htmlFor={id} style={{ margin: 0 }}>
          <b>Ảnh minh họa món đồ</b>
        </label>
        <span className={`upload-count-pill${isFull ? ' full' : ''}`}>
          {totalCount}/{maxFiles} ảnh
        </span>
      </div>

      {/* Existing Media Items (if any) */}
      {existingMedia.length > 0 ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>
            Ảnh hiện có trên bài đăng:
          </div>
          <div className="upload-thumbs-grid" aria-label="Danh sách ảnh đã lưu">
            {existingMedia.map((item, index) => (
              <div className="upload-thumb-card" key={item.fileId}>
                <div className="upload-thumb-media">
                  <img
                    src={item.signedUrl}
                    alt={item.altText ?? `Ảnh bài đăng ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                  {index === 0 ? (
                    <span className="upload-thumb-cover-tag">Ảnh bìa</span>
                  ) : null}
                  {onRemoveExistingMedia ? (
                    <button
                      className="upload-thumb-remove-btn"
                      type="button"
                      title="Gỡ ảnh này khỏi bài đăng"
                      aria-label={`Gỡ ảnh số ${index + 1}`}
                      disabled={removingFileId === item.fileId || disabled}
                      onClick={() => onRemoveExistingMedia(item)}
                    >
                      {removingFileId === item.fileId ? (
                        <span style={{ fontSize: 10 }}>…</span>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      )}
                    </button>
                  ) : null}
                </div>
                <div className="upload-thumb-footer">
                  <span className="upload-thumb-name">Ảnh {item.sortOrder + 1}</span>
                  <span className="upload-thumb-size" style={{ color: '#16a34a' }}>Đã lưu</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Dropzone & Picker Button */}
      {!isFull ? (
        <div
          className={`upload-zone-modern${isDragOver ? ' dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            id={id}
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={disabled || isFull}
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />

          <div className="upload-dropzone-inner">
            <div className="upload-icon-circle" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <button
                type="button"
                className="upload-action-btn"
                disabled={disabled || isFull}
                onClick={() => fileInputRef.current?.click()}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                {existingMedia.length > 0 ? 'Chọn thêm ảnh từ thiết bị' : 'Chọn ảnh từ thiết bị'}
              </button>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
              Kéo thả hoặc nhấn để chọn • Tối đa {maxFiles - totalCount} ảnh nữa (JPEG, PNG, WebP tối đa 5 MiB/ảnh).
              {existingMedia.length === 0 && selectedFiles.length === 0 ? ' Ảnh đầu tiên sẽ làm ảnh bìa.' : ''}
            </p>
          </div>
        </div>
      ) : null}

      {/* Newly Selected Images Preview Grid */}
      {selectedFiles.length > 0 ? (
        <div style={{ marginTop: existingMedia.length > 0 ? 14 : 16 }}>
          {existingMedia.length > 0 ? (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>
              Ảnh mới chọn (sẽ tải lên khi gửi/lưu):
            </div>
          ) : null}
          <div className="upload-thumbs-grid" aria-label="Danh sách ảnh mới chọn">
            {selectedFiles.map((file, index) => (
              <div className="upload-thumb-card" key={`${file.name}-${index}`}>
                <div className="upload-thumb-media">
                  <img
                    src={previewUrls[index]}
                    alt={`Xem trước ảnh ${index + 1}`}
                    loading="lazy"
                  />
                  {existingMedia.length === 0 && index === 0 ? (
                    <span className="upload-thumb-cover-tag">Ảnh bìa</span>
                  ) : existingMedia.length > 0 ? (
                    <span className="upload-thumb-cover-tag" style={{ background: '#059669' }}>Mới</span>
                  ) : null}
                  <button
                    type="button"
                    className="upload-thumb-remove-btn"
                    title="Gỡ ảnh này"
                    aria-label={`Gỡ ảnh ${file.name}`}
                    disabled={disabled}
                    onClick={() => removeSelected(index)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
                <div className="upload-thumb-footer">
                  <span className="upload-thumb-name" title={file.name}>{file.name}</span>
                  <span className="upload-thumb-size">{(file.size / 1024 / 1024).toFixed(2)} MiB</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {mediaError ? (
        <div className="state error" role="alert" style={{ marginTop: 10 }}>
          {mediaError}
        </div>
      ) : null}
    </div>
  );
}
