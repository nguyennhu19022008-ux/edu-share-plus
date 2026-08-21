import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
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
import { validatePostMediaFiles, type SignedMedia } from '../features/storage/mediaModel';
import {
  listPostMedia,
  removeMyPostMedia,
  uploadPostMedia,
} from '../features/storage/mediaService';

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

  const onMediaChange = (event:ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    const validationError = validatePostMediaFiles(files, media.length);
    if (validationError) {
      setSelectedFiles([]);
      setMediaError(validationError);
      event.currentTarget.value = '';
      return;
    }
    setSelectedFiles(files);
    setMediaError('');
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
    if (isSale && (!salePrice || !originalPurchasePrice || !conditionGrade)) {
      setMessage({ tone:'error', text:'Bán giá rẻ cần giá bán, giá mua ban đầu và tình trạng món đồ.' });
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
                  <div className="field"><label className="req" htmlFor="edit-sale-price">Giá bán</label><input id="edit-sale-price" name="salePrice" inputMode="numeric" required defaultValue={post.salePrice ?? ''} /></div>
                  <div className="field"><label className="req" htmlFor="edit-original-price">Giá mua ban đầu</label><input id="edit-original-price" name="originalPurchasePrice" inputMode="numeric" required defaultValue={post.originalPurchasePrice ?? ''} /></div>
                  <div className="field">
                    <label className="req" htmlFor="edit-condition">Tình trạng</label>
                    <select id="edit-condition" name="conditionGrade" required value={conditionGrade} onChange={(event) => setConditionGrade(event.target.value as OwnerConditionGrade)}>
                      <option value="" disabled>Chọn tình trạng</option>
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

            <div className="field upload-zone">
              <label htmlFor="edit-media"><b>Ảnh minh họa private</b></label>
              {media.length ? (
                <div className="owner-post-grid">
                  {media.map((item) => (
                    <article className="card" key={item.fileId}>
                      <img className="upload-preview" src={item.signedUrl} alt={item.altText ?? 'Ảnh bài đăng'} loading="lazy" decoding="async" />
                      <button className="btn danger small" type="button" disabled={removingFileId === item.fileId || submitting} onClick={() => void onRemoveMedia(item)}>
                        {removingFileId === item.fileId ? 'Đang gỡ…' : 'Gỡ ảnh'}
                      </button>
                    </article>
                  ))}
                </div>
              ) : <div className="form-note">Bài hiện chưa có ảnh.</div>}

              <input
                id="edit-media"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={media.length >= 5 || submitting}
                onChange={onMediaChange}
              />
              <div className="form-note">Đang có {media.length}/5 ảnh. Ảnh mới chỉ được upload sau khi nội dung bài lưu thành công.</div>
              {selectedFiles.length ? (
                <ul>{selectedFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MiB</li>)}</ul>
              ) : null}
              {mediaError ? <div className="state error" role="alert">{mediaError}</div> : null}
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
