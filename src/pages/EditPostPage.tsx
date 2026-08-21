import { FormEvent, useEffect, useState } from 'react';
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

    if (!postId) {
      setDetail(null);
      setOptions(null);
      setLoading(false);
      return () => { cancelled = true; };
    }

    void Promise.all([getMyPost(postId), loadOwnerPostReferenceOptions()])
      .then(([nextDetail, nextOptions]) => {
        if (cancelled) return;
        setDetail(nextDetail);
        setOptions(nextOptions);
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
        <main className="container narrow ecom-page"><div className="state">Đang tải bài đăng…</div></main>
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

  const onSubmit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || submitting) return;

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

    try {
      const result = await updateMyPost(post.id, {
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
      setMessage({ tone:'ok', text:'Đã lưu. Bài đã chuyển về trạng thái chờ giáo viên duyệt lại.' });
      navigateLegacy('myDetail', { id:result.id });
    } catch (error) {
      setMessage({ tone:'error', text:error instanceof Error ? error.message : 'Không thể cập nhật bài đăng.' });
      setSubmitting(false);
    }
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
          <div className="state">
            Bài đang ở trạng thái approved. Sau khi lưu, bài tạm rời Marketplace và chuyển về chờ giáo viên duyệt lại.
          </div>
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
              <div className="field">
                <label className="req" htmlFor="edit-title">Tiêu đề</label>
                <input id="edit-title" name="title" required minLength={5} maxLength={160} defaultValue={post.title} />
              </div>
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

            <div className="field">
              <label className="req" htmlFor="edit-description">Mô tả tình trạng món đồ</label>
              <textarea id="edit-description" name="description" required minLength={10} maxLength={5000} defaultValue={post.description} />
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="edit-class">Lớp hiện tại</label>
                <input id="edit-class" readOnly value={options.currentClassName ?? 'Toàn trường / chưa có lớp hiện tại'} />
              </div>
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
              <b>Ảnh minh họa</b>
              <div className="form-note">Chỉnh sửa media được giữ cho Phase 5F (Storage). Phase 5E không tạo object URL hoặc giả vờ ảnh đã được lưu.</div>
            </div>

            <div className="btn-row">
              <button type="submit" className="btn primary" disabled={submitting || !options.contactMethods.length}>{submitting ? 'Đang lưu…' : 'Lưu và gửi duyệt lại'}</button>
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
