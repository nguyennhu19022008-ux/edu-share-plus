import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { navigateLegacy } from '../app/legacyRouter';
import StudentHeader from '../components/student/StudentHeader';
import type {
  OwnerConditionGrade,
  OwnerContactMethod,
  OwnerTradeType,
  OwnerVisibilityScope,
} from '../features/my-posts/ownerPostModel';
import {
  createMyPost,
  loadOwnerPostReferenceOptions,
  type OwnerPostReferenceOptions,
} from '../features/my-posts/ownerPostService';
import { validatePostMediaFiles } from '../features/storage/mediaModel';
import { uploadPostMedia } from '../features/storage/mediaService';
import { estimateSchoolPrice, validateInputPrice, type ItemCondition } from '../features/estimator/priceEstimator';

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

type SubmitState =
  | { tone:'idle'; message:'' }
  | { tone:'ok'; message:string }
  | { tone:'error'; message:string };

function positiveMoney(value:FormDataEntryValue | null):number | null {
  const raw = String(value ?? '').trim().replace(/[^0-9]/g, '');
  if (!raw) return null;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export default function AddPostPage() {
  const [options, setOptions] = useState<OwnerPostReferenceOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState('');
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [tradeType, setTradeType] = useState<OwnerTradeType>('lend');
  const [visibilityScope, setVisibilityScope] = useState<OwnerVisibilityScope>('inherit');
  const [preferredContactMethod, setPreferredContactMethod] = useState<OwnerContactMethod>('email');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>({ tone:'idle', message:'' });
  const [submitting, setSubmitting] = useState(false);
  const [formCategoryName, setFormCategoryName] = useState('');
  const [formCondition, setFormCondition] = useState<ItemCondition>('good_85');
  const [formSalePrice, setFormSalePrice] = useState<number>(0);
  const [formOriginalPrice, setFormOriginalPrice] = useState<number>(0);

  const isSale = tradeType === 'low_price_sale';

  const priceEstimate = useMemo(() => {
    if (!isSale) return null;
    return estimateSchoolPrice({
      categoryCodeOrName: formCategoryName,
      condition: formCondition,
      originalRetailPrice: formOriginalPrice > 0 ? formOriginalPrice : undefined,
    });
  }, [isSale, formCategoryName, formCondition, formOriginalPrice]);

  const priceValidation = useMemo(() => {
    if (!priceEstimate || formSalePrice <= 0) return { isValid: true };
    return validateInputPrice(formSalePrice, priceEstimate);
  }, [priceEstimate, formSalePrice]);

  useEffect(() => {
    let cancelled = false;
    setOptionsLoading(true);
    setOptionsError('');

    void loadOwnerPostReferenceOptions()
      .then((nextOptions) => {
        if (cancelled) return;
        setOptions(nextOptions);
        setVisibilityScope(nextOptions.visibilityScopes[0] ?? 'inherit');
        setPreferredContactMethod(nextOptions.contactMethods[0] ?? 'email');
      })
      .catch((error:unknown) => {
        if (cancelled) return;
        setOptions(null);
        setOptionsError(error instanceof Error ? error.message : 'Không thể tải dữ liệu đăng bài.');
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [optionsVersion]);

  const onMediaChange = (event:ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    const validationError = validatePostMediaFiles(files);
    if (validationError) {
      setSelectedFiles([]);
      setMediaError(validationError);
      event.currentTarget.value = '';
      return;
    }
    setSelectedFiles(files);
    setMediaError('');
  };

  const onSubmit = async (event:FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting || !options) return;

    const validationError = validatePostMediaFiles(selectedFiles);
    if (validationError) {
      setMediaError(validationError);
      return;
    }

    const data = new FormData(event.currentTarget);
    const categoryId = String(data.get('categoryId') ?? '').trim();
    const title = String(data.get('title') ?? '').trim();
    const description = String(data.get('description') ?? '').trim();
    const salePrice = isSale ? positiveMoney(data.get('salePrice')) : null;
    const originalPurchasePrice = isSale ? positiveMoney(data.get('originalPurchasePrice')) : null;
    const originalPriceIsEstimate = isSale ? data.has('originalPriceIsEstimate') : null;
    const purchaseDate = isSale ? String(data.get('purchaseDate') ?? '').trim() || null : null;
    const conditionGrade = isSale
      ? String(data.get('conditionGrade') ?? '').trim() as OwnerConditionGrade
      : null;
    const brand = isSale ? String(data.get('brand') ?? '').trim() || null : null;
    const model = isSale ? String(data.get('model') ?? '').trim() || null : null;

    if (!categoryId || title.length < 5 || description.length < 10) {
      setSubmitState({ tone:'error', message:'Vui lòng nhập danh mục, tiêu đề và mô tả hợp lệ.' });
      return;
    }

    if (isSale && !salePrice) {
      setSubmitState({
        tone:'error',
        message:'Bán giá rẻ cần nhập giá bán mong muốn.',
      });
      return;
    }

    setSubmitting(true);
    setSubmitState({ tone:'idle', message:'' });

    let result;
    try {
      result = await createMyPost({
        categoryId,
        title,
        description,
        tradeType,
        salePrice,
        visibilityScope,
        preferredContactMethod,
        originalPurchasePrice,
        originalPriceIsEstimate,
        purchaseDate,
        conditionGrade,
        brand,
        model,
      });
    } catch (error) {
      setSubmitState({
        tone:'error',
        message:error instanceof Error ? error.message : 'Không thể tạo bài lúc này.',
      });
      setSubmitting(false);
      return;
    }

    if (selectedFiles.length) {
      try {
        const mediaResult = await uploadPostMedia(result.id, selectedFiles);
        if (mediaResult.failed.length) {
          window.alert(`Bài đã được tạo, nhưng ${mediaResult.failed.length} ảnh chưa gắn được. Bạn có thể thử lại trong trang chỉnh sửa.`);
        }
      } catch {
        window.alert('Bài đã được tạo, nhưng ảnh chưa thể tải lên. Bạn có thể thử lại trong trang chỉnh sửa.');
      }
    }

    setSubmitState({
      tone:'ok',
      message:'Đã gửi bài ở trạng thái chờ giáo viên duyệt.',
    });
    navigateLegacy('myDetail', { id:result.id });
  };

  const canSubmit = Boolean(
    options
    && options.categories.length
    && options.contactMethods.length
    && options.visibilityScopes.length,
  );

  return (
    <>
      <StudentHeader activePage="add" />
      <main className="container narrow ecom-page add-post-page">
        <section className="ecom-page-title">
          <div>
            <span className="eyebrow">ĐĂNG BÁN / CHIA SẺ</span>
            <h1>Đăng bài mới</h1>
            <p>Bài mới được gửi ở trạng thái chờ giáo viên kiểm duyệt trước khi công khai.</p>
          </div>
          <button className="btn gray" type="button" onClick={() => navigateLegacy('myPosts')}>Bài của tôi</button>
        </section>

        {optionsLoading ? <div className="state">Đang tải danh mục và chính sách đăng bài…</div> : null}
        {optionsError ? (
          <div className="state error">
            {optionsError}
            <div className="btn-row">
              <button className="btn gray" type="button" onClick={() => setOptionsVersion((value) => value + 1)}>Thử lại</button>
            </div>
          </div>
        ) : null}

        {options ? (
          <form className="card form-shell ecom-form-card" onSubmit={onSubmit}>
            <div className="form-guide">
              <div className="guide-item"><i>1</i><b>Mô tả chính xác</b><span>Nêu rõ tình trạng và cách trao đổi mong muốn.</span></div>
              <div className="guide-item"><i>2</i><b>Đúng phạm vi</b><span>Phạm vi công khai không thể vượt chính sách của trường.</span></div>
              <div className="guide-item"><i>3</i><b>Chờ duyệt</b><span>Giáo viên sẽ kiểm tra trước khi bài xuất hiện trên Marketplace.</span></div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label className="req" htmlFor="add-title">Tiêu đề</label>
                <input id="add-title" name="title" required minLength={5} maxLength={160} placeholder="Ví dụ: Máy tính cầm tay Casio còn tốt" />
              </div>

              <div className="field">
                <label className="req" htmlFor="add-trade">Loại bài đăng</label>
                <select id="add-trade" name="tradeType" required value={tradeType} onChange={(event) => setTradeType(event.target.value as OwnerTradeType)}>
                  {TRADE_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="req" htmlFor="add-category">Danh mục</label>
                <select
                  id="add-category"
                  name="categoryId"
                  required
                  defaultValue=""
                  onChange={(event) => {
                    const found = options.categories.find((c) => c.id === event.target.value);
                    if (found) setFormCategoryName(found.name);
                  }}
                >
                  <option value="" disabled>Chọn danh mục</option>
                  {options.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="req" htmlFor="add-visibility">Phạm vi hiển thị</label>
                <select id="add-visibility" name="visibilityScope" value={visibilityScope} onChange={(event) => setVisibilityScope(event.target.value as OwnerVisibilityScope)}>
                  {options.visibilityScopes.map((scope) => <option value={scope} key={scope}>{VISIBILITY_LABELS[scope]}</option>)}
                </select>
              </div>
            </div>

            <div className="field">
              <label className="req" htmlFor="add-description">Mô tả tình trạng đồ</label>
              <textarea id="add-description" name="description" required minLength={10} maxLength={5000} placeholder="Nêu tình trạng, số lượng, lớp phù hợp và cách giao nhận mong muốn." />
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="add-class">Lớp hiện tại</label>
                <input id="add-class" value={options.currentClassName ?? 'Toàn trường / chưa có lớp hiện tại'} readOnly />
              </div>
              <div className="field">
                <label className="req" htmlFor="add-contact-method">Kênh liên hệ</label>
                {options.contactMethods.length ? (
                  <select id="add-contact-method" name="preferredContactMethod" value={preferredContactMethod} onChange={(event) => setPreferredContactMethod(event.target.value as OwnerContactMethod)}>
                    {options.contactMethods.map((method) => <option value={method} key={method}>{CONTACT_LABELS[method]}</option>)}
                  </select>
                ) : (
                  <div className="state error">Hồ sơ chưa có email hoặc số điện thoại liên hệ. Hãy cập nhật hồ sơ trước khi đăng bài.</div>
                )}
                <div className="form-note">Bài chỉ lưu lựa chọn kênh liên hệ; thông tin riêng tư vẫn nằm trong hồ sơ của bạn.</div>
              </div>
            </div>

            {isSale ? (
              <section className="card ecom-form-card">
                <h2>Thông tin bán giá rẻ & Gợi ý tham khảo</h2>
                <p className="form-note">Học sinh được chủ động định giá món đồ theo nhu cầu thực tế.</p>

                {priceEstimate ? (
                  <div style={{ margin: '12px 0 16px', padding: '14px 16px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <strong style={{ color: '#0f172a', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 16v-4" />
                          <path d="M12 8h.01" />
                        </svg>
                        Gợi ý mức giá tham khảo:
                      </strong>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb' }}>
                        {new Intl.NumberFormat('vi-VN').format(priceEstimate.suggestedMinPrice)}đ - {new Intl.NumberFormat('vi-VN').format(priceEstimate.suggestedMaxPrice)}đ
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
                      {priceEstimate.adviceMessage} (Bạn có thể tự do đặt giá phù hợp theo ý muốn).
                    </p>
                  </div>
                ) : null}

                <div className="grid-2">
                  <div className="field">
                    <label className="req" htmlFor="add-sale-price">Giá bán mong muốn (VNĐ)</label>
                    <input
                      id="add-sale-price"
                      name="salePrice"
                      inputMode="numeric"
                      required
                      placeholder="Ví dụ: 70000"
                      onChange={(e) => setFormSalePrice(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-original-price">Giá mua ban đầu (Giá gốc - Tùy chọn)</label>
                    <input
                      id="add-original-price"
                      name="originalPurchasePrice"
                      inputMode="numeric"
                      placeholder="Ví dụ: 180000 (nếu nhớ)"
                      onChange={(e) => setFormOriginalPrice(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="add-condition">Tình trạng</label>
                    <select
                      id="add-condition"
                      name="conditionGrade"
                      defaultValue="good_85"
                      onChange={(e) => setFormCondition(e.target.value as ItemCondition)}
                    >
                      {CONDITION_OPTIONS.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="field"><label htmlFor="add-purchase-date">Ngày mua gần đúng</label><input id="add-purchase-date" name="purchaseDate" type="date" max={new Date().toISOString().slice(0, 10)} /></div>
                  <div className="field"><label htmlFor="add-brand">Thương hiệu</label><input id="add-brand" name="brand" maxLength={120} placeholder="Ví dụ: Casio" /></div>
                  <div className="field"><label htmlFor="add-model">Mẫu / model</label><input id="add-model" name="model" maxLength={120} placeholder="Ví dụ: fx-580VN X" /></div>
                </div>
                <label className="field" htmlFor="add-price-estimate">
                  <span>Giá mua ban đầu là số ước tính</span>
                  <input id="add-price-estimate" name="originalPriceIsEstimate" type="checkbox" />
                </label>
              </section>
            ) : null}

            <div className="field upload-zone">
              <label htmlFor="add-media"><b>Ảnh minh họa</b></label>
              <input id="add-media" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onMediaChange} />
              <div className="form-note">Tối đa 5 ảnh, mỗi ảnh không quá 5 MiB. Chỉ JPEG, PNG hoặc WebP. Ảnh được lưu trong bucket private.</div>
              {selectedFiles.length ? (
                <ul>
                  {selectedFiles.map((file) => <li key={`${file.name}-${file.size}`}>{file.name} • {(file.size / 1024 / 1024).toFixed(2)} MiB</li>)}
                </ul>
              ) : null}
              {mediaError ? <div className="state error" role="alert">{mediaError}</div> : null}
            </div>

            <button type="submit" className="btn primary full" disabled={submitting || !canSubmit}>
              {submitting ? 'Đang gửi bài và ảnh…' : 'Gửi bài chờ duyệt'}
            </button>
            {submitState.tone !== 'idle' ? (
              <div className={`state ${submitState.tone === 'ok' ? 'ok' : 'error'} add-submit-state`} role="status">{submitState.message}</div>
            ) : null}
          </form>
        ) : null}
      </main>
      <footer className="page-footer">Edu Share+ • Chia sẻ đồ dùng học tập an toàn trong trường</footer>
    </>
  );
}
