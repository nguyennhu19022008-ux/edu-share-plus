import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import type {
  OwnerConditionGrade,
  OwnerContactMethod,
  OwnerPostDetail,
  OwnerTradeType,
  OwnerVisibilityScope,
} from '../features/my-posts/ownerPostModel';
import {
  getMyPost,
  loadOwnerPostReferenceOptions,
  updateMyPost,
  type OwnerPostReferenceOptions,
} from '../features/my-posts/ownerPostService';
import { POST_MEDIA_MAX_FILES, validatePostMediaFiles, type SignedMedia } from '../features/storage/mediaModel';
import {
  listPostMedia,
  removeMyPostMedia,
  uploadPostMedia,
} from '../features/storage/mediaService';
import { createPreviewUrl, revokePreviewUrl } from '../components/media/previewHelper';


const TRADE_OPTIONS:Array<{ value:OwnerTradeType; label:string }> = [
  { value:'lend', label:'Cho mượn' },
  { value:'give', label:'Cho tặng' },
  { value:'exchange', label:'Trao đổi' },
  { value:'low_price_sale', label:'Bán giá rẻ' },
];

const CONDITION_OPTIONS:Array<{ value:OwnerConditionGrade; label:string }> = [
  { value:'like_new', label:'Như mới' },
  { value:'good', label:'Tốt' },
  { value:'fair', label:'Khá' },
  { value:'well_used', label:'Đã sử dụng nhiều' },
];

const VISIBILITY_LABELS:Record<OwnerVisibilityScope, string> = {
  inherit:'Theo chính sách của trường',
  school:'Chỉ trong trường',
  network:'Toàn mạng EDU SHARE+',
};

const CONTACT_LABELS:Record<OwnerContactMethod, string> = {
  email:'Email trong hồ sơ',
  phone:'Số điện thoại trong hồ sơ',
};

function getPostId():string {
  return new URLSearchParams(window.location.search).get('id')?.trim() || '';
}

function positiveMoney(value:FormDataEntryValue | null):number | null {
  const raw = String(value ?? '').trim();
  if (!/^\d+$/.test(raw)) return null;
  const amount = Number(raw);
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export default function EditPostPage() {
  const postId = getPostId();
  const [detail, setDetail] = useState<OwnerPostDetail | null>(null);
  const [options, setOptions] = useState<OwnerPostReferenceOptions | null>(null);
  const [media, setMedia] = useState<SignedMedia[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [removingFileId, setRemovingFileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [tradeType, setTradeType] = useState<OwnerTradeType>('lend');
  const [visibilityScope, setVisibilityScope] = useState<OwnerVisibilityScope>('inherit');
  const [preferredContactMethod, setPreferredContactMethod] = useState<OwnerContactMethod>('email');
  const [conditionGrade, setConditionGrade] = useState<OwnerConditionGrade | ''>('');
  const [originalPriceIsEstimate, setOriginalPriceIsEstimate] = useState(false);
  const [message, setMessage] = useState<{ tone:'idle' | 'ok' | 'error'; text:string }>({ tone:'idle', text:'' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    setMediaError('');

    if (!postId) {
      setDetail(null);
      setOptions(null);
      setMedia([]);
      setLoading(false);
      return () => { cancelled = true; };
    }

    void Promise.all([
      getMyPost(postId),
      loadOwnerPostReferenceOptions(),
      listPostMedia(postId),
    ])
      .then(([nextDetail, nextOptions, nextMedia]) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setOptions(nextOptions);
        setMedia(nextMedia);
        setSelectedFiles([]);
        if (!nextDetail) return;

        const post = nextDetail.post;
        setTradeType(post.tradeType);
        setVisibilityScope(
          nextOptions.visibilityScopes.includes(post.visibilityScope)
            ? post.visibilityScope
            : nextOptions.visibilityScopes[0] ?? 'inherit',
        );
        setPreferredContactMethod(
          nextOptions.contactMethods.includes(post.preferredContactMethod)
            ? post.preferredContactMethod
            : nextOptions.contactMethods[0] ?? 'email',
        );
        setConditionGrade(post.conditionGrade ?? '');
        setOriginalPriceIsEstimate(post.originalPriceIsEstimate ?? false);
      })
      .catch((error:unknown) => {
        if (cancelled) return;
        setDetail(null);
        setOptions(null);
        setMedia([]);
        setLoadError(error instanceof Error ? error.message : 'Không thể tải bài đăng.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadVersion, postId]);

  if (loading) {
    return (
      <>
        <StudentHeader activePage="editPost" />
        <main className="container narrow ecom-page"><div className="state">Đang tải bài đăng và ảnh private…</div></main>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <StudentHeader activePage="editPost" />
        <main className="container narrow ecom-page">
          <div className="state error">{loadError}</div>
          <div className="btn-row">
            <button className="btn gray" type="button" onClick={() => setLoadVersion((value) => value + 1)}>Thử lại</button>
            <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button>
          </div>
        </main>
      </>
    );
  }

  if (!detail || !options) {
    return (
      <>
        <StudentHeader activePage="editPost" />
        <main className="container narrow ecom-page">
          <section className="ecom-page-title"><div><span className="eyebrow">CHỈNH SỬA BÀI</span><h1>Chỉnh sửa bài đăng</h1></div></section>
          <div className="state error">Không tìm thấy bài đăng thuộc tài khoản hiện tại.</div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button>
        </main>
      </>
    );
  }

  const post = detail.post;
  const canEdit = post.lifecycleStatus === 'active';
  const isSale = tradeType === 'low_price_sale';

  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const urls = selectedFiles.map((f) => createPreviewUrl(f));
    setPreviewUrls(urls);
    return () => {
      urls.forEach((url) => revokePreviewUrl(url));
    };
  }, [selectedFiles]);


  const handleFilesAdded = (incomingFiles: File[]) => {
    if (!incomingFiles.length) return;
    const combined = [...selectedFiles, ...incomingFiles];
    const totalCount = media.length + combined.length;
    if (totalCount > POST_MEDIA_MAX_FILES) {
      setMediaError(`Mỗi bài đăng được gắn tối đa 5 ảnh. Bài hiện có ${media.length} ảnh và bạn đã chọn thêm ${combined.length} ảnh.`);
      return;
    }
    const validationError = validatePostMediaFiles(combined, media.length);
    if (validationError) {
      setMediaError(validationError);
      return;
    }
    setSelectedFiles(combined);
    setMediaError('');
  };

  const onMediaChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    handleFilesAdded(files);
    event.currentTarget.value = '';
  };

  const removeSelectedFile = (indexToRemove: number) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    setMediaError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const onRemoveMedia = async (item:SignedMedia) => {
    if (!canEdit || removingFileId || submitting) return;
    if (!window.confirm('Gỡ ảnh này khỏi bài đăng? Tệp private sẽ được dọn sau khi unbind thành công.')) return;

    setRemovingFileId(item.fileId);
    setMediaError('');
    try {
      await removeMyPostMedia(post.id, item);
      const refreshedMedia = await listPostMedia(post.id);
      setMedia(refreshedMedia);
      const selectionError = validatePostMediaFiles(selectedFiles, refreshedMedia.length);
      if (selectionError) {
        setSelectedFiles([]);
        setMediaError(selectionError);
      }
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : 'Không thể gỡ ảnh lúc này.');
    } finally {
      setRemovingFileId('');
    }
  };

  const onSubmit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || submitting) return;

    const mediaValidationError = validatePostMediaFiles(selectedFiles, media.length);
    if (mediaValidationError) {
      setMediaError(mediaValidationError);
      return;
    }

    const data = new FormData(event.currentTarget);
    const categoryId = String(data.get('categoryId') ?? '').trim();
    const title = String(data.get('title') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const salePrice = isSale ? positiveMoney(data.get('salePrice')) : null;
    const originalPurchasePrice = isSale ? positiveMoney(data.get('originalPurchasePrice')) : null;
    const purchaseDate = isSale ? String(data.get('purchaseDate') ?? '').trim() || null : null;
    const brand = isSale ? String(data.get('brand') ?? '').trim() || null : null;
    const model = isSale ? String(data.get('model') ?? '').trim() || null : null;

    if (!categoryId || title.length < 5 || description.length < 10) {
      setMessage({ tone:'error', text:'Vui lòng nhập danh mục, tiêu đề và mô tả hợp lệ.' });
      return;
    }
    if (isSale && !salePrice) {
      setMessage({ tone:'error', text:'Bán giá rẻ cần nhập giá bán mong muốn.' });
      return;
    }

    setSubmitting(true);
    setMessage({ tone:'idle', text:'' });
    setMediaError('');

    let result;
    try {
      result = await updateMyPost(post.id, {
        categoryId,
        title,
        description,
        tradeType,
        salePrice,
        visibilityScope,
        preferredContactMethod,
        originalPurchasePrice,
        originalPriceIsEstimate:isSale ? originalPriceIsEstimate : null,
        purchaseDate,
        conditionGrade:isSale ? conditionGrade || null : null,
        brand,
        model,
      });
    } catch (error) {
      setMessage({ tone:'error', text:error instanceof Error ? error.message : 'Không thể cập nhật bài đăng.' });
      setSubmitting(false);
      return;
    }

    if (selectedFiles.length) {
      try {
        const mediaResult = await uploadPostMedia(post.id, selectedFiles);
        if (mediaResult.failed.length) {
          window.alert(`Nội dung bài đã được lưu, nhưng ${mediaResult.failed.length} ảnh mới chưa gắn được. Bạn có thể thử lại.`);
        }
      } catch {
        window.alert('Nội dung bài đã được lưu, nhưng ảnh mới chưa thể tải lên. Bạn có thể thử lại sau.');
      }
    }

    setMessage({ tone:'ok', text:'Đã lưu. Bài đã chuyển về trạng thái chờ giáo viên duyệt lại.' });
    navigateLegacy('myDetail', { id:result.id });
  };

  return (
    <>
      <StudentHeader activePage="editPost" />
      <main className="container narrow ecom-page edit-post-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">CHỈNH SỬA BÀI</span>
            <h1>Chỉnh sửa bài đăng</h1>
            <p>Mọi chỉnh sửa nội dung của bài active sẽ đưa moderation về pending để giáo viên duyệt lại.</p>
          </div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('myDetail', { id:post.id })}>Hủy</button>
        </section>

        {post.moderationStatus === 'approved' ? (
          <div className="state">Bài đang ở trạng thái approved. Sau khi lưu, bài tạm rời Marketplace và chuyển về chờ giáo viên duyệt lại.</div>
        ) : null}
        {detail.rejectionReason ? <div className="reason-box"><b>Lý do từ chối gần nhất: </b>{detail.rejectionReason}</div> : null}

        {!canEdit ? (
          <section className="card ecom-form-card">
            <div className="state error">Bài đã hoàn tất hoặc thu hồi nên chỉ có thể xem, không thể chỉnh sửa lại trong Core V2.</div>
            <button className="btn gray" type="button" onClick={() => navigateLegacy('myDetail', { id:post.id })}>Xem chi tiết</button>
          </section>
        ) : (
          <form className="card ecom-form-card" onSubmit={onSubmit}>
            <div className="grid-2">
              <div className="field"><label className="req" htmlFor="edit-title">Tiêu đề</label><input id="edit-title" name="title" required minLength={5} maxLength={160} defaultValue={post.title} /></div>
              <div className="field">
                <label className="req" htmlFor="edit-trade">Loại bài đăng</label>
                <select id="edit-trade" name="tradeType" value={tradeType} onChange={(event) => setTradeType(event.target.value as OwnerTradeType)}>
                  {TRADE_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="req" htmlFor="edit-category">Danh mục</label>
                <select id="edit-category" name="categoryId" required defaultValue={post.categoryId}>
                  {options.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label className="req" htmlFor="edit-visibility">Phạm vi hiển thị</label>
                <select id="edit-visibility" name="visibilityScope" value={visibilityScope} onChange={(event) => setVisibilityScope(event.target.value as OwnerVisibilityScope)}>
                  {options.visibilityScopes.map((scope) => <option value={scope} key={scope}>{VISIBILITY_LABELS[scope]}</option>)}
                </select>
              </div>
            </div>

            <div className="field"><label className="req" htmlFor="edit-description">Mô tả tình trạng món đồ</label><textarea id="edit-description" name="description" required minLength={10} maxLength={5000} defaultValue={post.description} /></div>

            <div className="grid-2">
              <div className="field"><label htmlFor="edit-class">Lớp hiện tại</label><input id="edit-class" readOnly value={options.currentClassName ?? 'Toàn trường / chưa có lớp hiện tại'} /></div>
              <div className="field">
                <label className="req" htmlFor="edit-contact-method">Kênh liên hệ</label>
                {options.contactMethods.length ? (
                  <select id="edit-contact-method" name="preferredContactMethod" value={preferredContactMethod} onChange={(event) => setPreferredContactMethod(event.target.value as OwnerContactMethod)}>
                    {options.contactMethods.map((method) => <option value={method} key={method}>{CONTACT_LABELS[method]}</option>)}
                  </select>
                ) : <div className="state error">Hồ sơ hiện không có kênh liên hệ hợp lệ.</div>}
              </div>
            </div>

            {isSale ? (
              <section className="card ecom-form-card">
                <h2>Thông tin bán giá rẻ</h2>
                <div className="grid-2">
                  <div className="field"><label className="req" htmlFor="edit-sale-price">Giá bán (VNĐ)</label><input id="edit-sale-price" name="salePrice" inputMode="numeric" required defaultValue={post.salePrice ?? ''} /></div>
                  <div className="field"><label htmlFor="edit-original-price">Giá mua ban đầu (Giá gốc - Tùy chọn)</label><input id="edit-original-price" name="originalPurchasePrice" inputMode="numeric" defaultValue={post.originalPurchasePrice ?? ''} placeholder="Tùy chọn" /></div>
                  <div className="field">
                    <label htmlFor="edit-condition">Tình trạng</label>
                    <select id="edit-condition" name="conditionGrade" value={conditionGrade} onChange={(event) => setConditionGrade(event.target.value as OwnerConditionGrade)}>
                      <option value="">Chọn tình trạng (tùy chọn)</option>
                      {CONDITION_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="field"><label htmlFor="edit-purchase-date">Ngày mua gần đúng</label><input id="edit-purchase-date" name="purchaseDate" type="date" max={new Date().toISOString().slice(0, 10)} defaultValue={post.purchaseDate ?? ''} /></div>
                  <div className="field"><label htmlFor="edit-brand">Thương hiệu</label><input id="edit-brand" name="brand" maxLength={120} defaultValue={post.brand ?? ''} /></div>
                  <div className="field"><label htmlFor="edit-model">Mẫu / model</label><input id="edit-model" name="model" maxLength={120} defaultValue={post.model ?? ''} /></div>
                </div>
                <label className="field" htmlFor="edit-estimate">
                  <span>Giá mua ban đầu là số ước tính</span>
                  <input id="edit-estimate" name="originalPriceIsEstimate" type="checkbox" checked={originalPriceIsEstimate} onChange={(event) => setOriginalPriceIsEstimate(event.target.checked)} />
                </label>
              </section>
            ) : null}

            <div className="field">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label htmlFor="edit-media" style={{ margin: 0 }}>
                  <b>Ảnh minh họa bài đăng</b>
                </label>
                <span className={`upload-count-pill${media.length + selectedFiles.length >= POST_MEDIA_MAX_FILES ? ' full' : ''}`}>
                  {media.length + selectedFiles.length}/{POST_MEDIA_MAX_FILES} ảnh
                </span>
              </div>

              {media.length ? (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 8 }}>Ảnh hiện có trên bài đăng:</div>
                  <div className="upload-thumbs-grid">
                    {media.map((item, index) => (
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
                          <button
                            className="upload-thumb-remove-btn"
                            type="button"
                            title="Gỡ ảnh này khỏi bài đăng"
                            aria-label="Gỡ ảnh này"
                            disabled={removingFileId === item.fileId || submitting || !canEdit}
                            onClick={() => void onRemoveMedia(item)}
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
                        </div>
                        <div className="upload-thumb-footer">
                          <span className="upload-thumb-name">Ảnh {item.sortOrder + 1}</span>
                          <span className="upload-thumb-size" style={{ color: '#16a34a' }}>Đã lưu</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="form-note" style={{ marginBottom: 12 }}>Bài đăng hiện chưa có ảnh nào.</div>
              )}

              {media.length + selectedFiles.length < POST_MEDIA_MAX_FILES ? (
                <div
                  className={`upload-zone-modern${isDragOver ? ' dragover' : ''}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const files = Array.from(e.dataTransfer.files || []);
                    handleFilesAdded(files);
                  }}
                >
                  <input
                    id="edit-media"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    disabled={media.length + selectedFiles.length >= POST_MEDIA_MAX_FILES || submitting || !canEdit}
                    onChange={onMediaChange}
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
                        disabled={submitting || !canEdit}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Chọn thêm ảnh từ thiết bị
                      </button>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                      Có thể thêm tối đa {POST_MEDIA_MAX_FILES - (media.length + selectedFiles.length)} ảnh nữa (JPEG, PNG, WebP tối đa 5 MiB/ảnh).
                    </p>
                  </div>
                </div>
              ) : null}

              {selectedFiles.length > 0 ? (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#2563eb', marginBottom: 8 }}>Ảnh mới chọn (sẽ tải lên khi lưu):</div>
                  <div className="upload-thumbs-grid" aria-label="Danh sách ảnh mới chọn">
                    {selectedFiles.map((file, index) => (
                      <div className="upload-thumb-card" key={`${file.name}-${index}`}>
                        <div className="upload-thumb-media">
                          {previewUrls[index] ? (
                            <img
                              src={previewUrls[index]}
                              alt={`Xem trước ảnh mới ${index + 1}`}
                              loading="lazy"
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', background: '#f8fafc', color: '#94a3b8', fontSize: '11px' }}>
                              Đang tải...
                            </div>
                          )}
                          {media.length === 0 && index === 0 ? (
                            <span className="upload-thumb-cover-tag">Ảnh bìa</span>
                          ) : (
                            <span className="upload-thumb-cover-tag" style={{ background: '#059669' }}>Mới</span>
                          )}
                          <button
                            type="button"
                            className="upload-thumb-remove-btn"
                            title="Gỡ ảnh này"
                            aria-label={`Gỡ ảnh ${file.name}`}
                            onClick={() => removeSelectedFile(index)}
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

              {mediaError ? <div className="state error" role="alert" style={{ marginTop: 10 }}>{mediaError}</div> : null}
            </div>

            <div className="btn-row">
              <button type="submit" className="btn primary" disabled={submitting || !options.contactMethods.length}>{submitting ? 'Đang lưu nội dung và ảnh…' : 'Lưu và gửi duyệt lại'}</button>
              <button type="button" className="btn gray" onClick={() => navigateLegacy('myDetail', { id:post.id })}>Hủy</button>
            </div>
            {message.tone !== 'idle' ? <div className={`state ${message.tone === 'ok' ? 'ok' : 'error'} add-submit-state`} role="status">{message.text}</div> : null}
          </form>
        )}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
